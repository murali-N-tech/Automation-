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
const dashboardRoutes = require('./routes/dashboardRoutes');

// ── Services ──────────────────────────────────────────────────────────────────
const { fetchJobsFromJSearch } = require('./services/jsearchService');
const autoMatcher              = require('./services/autoMatcher');

// ── Models ────────────────────────────────────────────────────────────────────
const Job = require('./models/Job');

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
      // Future: enforce daily application limits per user
      // For now, just a placeholder that logs cleanly
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