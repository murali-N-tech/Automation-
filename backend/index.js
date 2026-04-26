require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const cookieParser = require('cookie-parser');
const mongoose    = require('mongoose');
const cron        = require('node-cron');
const axios       = require('axios');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes      = require('./routes/authRoutes');
const resumeRoutes    = require('./routes/resumeRoutes');
const jobRoutes       = require('./routes/jobRoutes');
const applyRoutes     = require('./routes/applyRoutes');
const aiRoutes        = require('./routes/aiRoutes');
const skillRoutes     = require('./routes/skillRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// ── Services ──────────────────────────────────────────────────────────────────
const { fetchJobsFromJSearch } = require('./services/jsearchService');
const autoMatcher              = require('./services/autoMatcher');
const { jobApplyAutomationService, detectPlatform } = require('./services/jobApplyAutomation');

// ── Models ────────────────────────────────────────────────────────────────────
const Job = require('./models/Job');
const User = require('./models/User');
const Resume = require('./models/Resume');
const Application = require('./models/Application');

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();

const allowedWebOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);  // allow non-browser requests
    if (allowedWebOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
      return cb(null, true);
    }
    return cb(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'AI Placement Officer Backend' })
);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/resumes',   resumeRoutes);
app.use('/api/jobs',      jobRoutes);
app.use('/api/apply',     applyRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/skills',    skillRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Config ────────────────────────────────────────────────────────────────────
const PORT      = process.env.PORT      || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-placement-officer';
const AI_SERVICE = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ── Skill extractor helper ────────────────────────────────────────────────────
async function extractSkillsForJob(description = '') {
  if (!description.trim()) return [];
  try {
    const res = await axios.post(
      `${AI_SERVICE}/matcher/extract-job-skills`,
      { description },
      { timeout: 10000 }
    );
    return res.data?.required_skills || [];
  } catch {
    return [];
  }
}

async function persistCronAutomationOutcome(application, result) {
  application.automation = application.automation || {};
  application.automation.platform = result.platform || detectPlatform(result.currentUrl || '');
  application.automation.attempts = Number(application.automation.attempts || 0) + 1;
  application.automation.lastRunAt = new Date();
  application.automation.lastOutcome = result.submitted
    ? 'submitted'
    : (result.requiresManualAction ? 'manual_required' : 'failed');
  application.automation.lastError = result.success ? '' : (result.reason || '');
  application.automation.lastUrl = result.currentUrl || '';
  application.automation.screenshotPath = result.screenshotPath || '';
  application.automation.requiresManualAction = Boolean(result.requiresManualAction);
  application.notes = [
    `Automation platform: ${application.automation.platform || 'other'}`,
    result.reason || '',
    result.uploadedResume ? 'Resume uploaded successfully.' : 'Resume upload not confirmed.',
    result.actionsTaken?.length ? `Workflow steps: ${result.actionsTaken.join(' -> ')}.` : '',
    result.validationErrors?.length ? `Validation: ${result.validationErrors.join(' | ')}.` : ''
  ].filter(Boolean).join(' ');

  if (result.submitted) {
    application.status = 'Applied';
    application.appliedAt = new Date();
  } else if (result.requiresManualAction) {
    application.status = 'Reviewing';
  } else {
    application.status = 'Failed';
  }

  await application.save();
}

// ── DB + Server ───────────────────────────────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');

    // ── CRON 1: Fetch + score jobs every 6 hours ──────────────────
    cron.schedule('0 */6 * * *', async () => {
      console.log('🔄 [CRON] Running AI Job Fetch Pipeline…');
      try {
        // 1. Fetch from JSearch
        const rawJobs = await fetchJobsFromJSearch('Software Engineer Remote');
        let savedCount = 0;

        for (const jobData of rawJobs) {
          if (!jobData.url || !jobData.title) continue;

          // Deduplicate
          const exists = await Job.findOne({ url: jobData.url }).lean();
          if (exists) continue;

          // ✅ FIX: extract required skills before saving
          const requiredSkills = await extractSkillsForJob(jobData.description);

          await Job.create({ ...jobData, requiredSkills });
          savedCount++;
        }

        console.log(`✅ [CRON] Saved ${savedCount} new jobs.`);

        // 2. Run AI matching for all users
        console.log('🤖 [CRON] Running AI Matching Engine…');
        await autoMatcher.runNightlyMatching();
        console.log('✅ [CRON] Matching complete.');

      } catch (err) {
        console.error('❌ [CRON] Pipeline error:', err.message);
      }
    });

    // ── CRON 2: Rate-limit check every 30 minutes ─────────────────
    cron.schedule('*/30 * * * *', async () => {
      if (process.env.AUTO_APPLY_CRON_ENABLED !== 'true') {
        return;
      }

      const perUserLimit = Math.max(1, Math.min(Number(process.env.AUTO_APPLY_BATCH_LIMIT) || 3, 10));

      try {
        const users = await User.find({}).lean();

        for (const user of users) {
          const latestResume = await Resume.findOne({ userId: user._id }).sort({ createdAt: -1 });
          if (!latestResume?.rawFileUrl) {
            continue;
          }

          const readyApps = await Application.find({
            userId: user._id,
            status: { $in: ['Ready to Apply', 'Reviewing'] },
            decision: 'Apply'
          })
            .sort({ atsScore: -1, createdAt: -1 })
            .limit(perUserLimit)
            .populate('jobId')
            .populate('resumeId');

          for (const application of readyApps) {
            const job = application.jobId;
            if (!job?.url) continue;

            const result = await jobApplyAutomationService.apply({
              application,
              user,
              resume: application.resumeId || latestResume,
              job,
              finalSubmit: process.env.AUTO_APPLY_FINAL_SUBMIT !== 'false',
              headless: process.env.AUTO_APPLY_HEADLESS !== 'false'
            });

            await persistCronAutomationOutcome(application, result);
          }
        }
      } catch (err) {
        console.error('❌ [CRON] Auto apply error:', err.message);
      }
    });

    // ── Start server ──────────────────────────────────────────────
    app.listen(PORT, () =>
      console.log(`🚀 Backend running on http://localhost:${PORT}`)
    );
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
