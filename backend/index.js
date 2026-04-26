require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cron = require('node-cron');

// ================= ROUTES =================
const authRoutes = require('./routes/authRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applyRoutes = require('./routes/applyRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// ================= SERVICES =================
const { fetchJobsFromJSearch } = require('./services/jsearchService'); // ✅ NEW
const autoMatcher = require('./services/autoMatcher');

// ================= MODELS =================
const Job = require('./models/Job');

const app = express();

// ================= CORS CONFIG =================
const allowedWebOrigins = [
  'http://localhost:5173',
  'http://localhost:5174'
];

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);

  if (
    allowedWebOrigins.includes(origin) ||
    origin.startsWith('chrome-extension://')
  ) {
    return callback(null, true);
  }

  return callback(new Error('Not allowed by CORS'));
};

// ================= MIDDLEWARE =================
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// ================= HEALTH CHECK =================
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', service: 'Node.js Backend v2' })
);

// ================= ROUTES =================
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/apply', applyRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ================= CONFIG =================
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/ai-placement-officer';

// ================= DB + SERVER =================
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');

    // =====================================================
    // 🔥 CRON 1: AI JOB FETCH PIPELINE (EVERY 6 HOURS)
    // =====================================================
    cron.schedule('0 */6 * * *', async () => {
      console.log('🔄 Running v2 AI Job Fetch Pipeline...');

      try {
        // 1️⃣ Fetch Jobs (JSearch API)
        const newJobs = await fetchJobsFromJSearch('Software Engineer Remote');

        // 2️⃣ Save / Update Jobs
        for (const jobData of newJobs) {
          await Job.findOneAndUpdate(
            { url: jobData.url },
            jobData,
            { upsert: true, new: true }
          );
        }

        console.log(`✅ Saved ${newJobs.length} jobs to DB.`);

        // 3️⃣ AI Matching + Scoring Engine
        console.log('🤖 Running AI Matching & Scoring Engine...');

        /**
         * ⚡ IMPORTANT (inside autoMatcher)
         * Final Score =
         * 0.5 * AI Match +
         * 0.2 * Salary +
         * 0.2 * Company Quality +
         * 0.1 * Recency
         */
        await autoMatcher.runNightlyMatching();

        console.log('✅ Matching & Scoring Completed.');

      } catch (error) {
        console.error('❌ Pipeline Error:', error);
      }
    });

    // =====================================================
    // 🚦 CRON 2: RATE-LIMITED APPLY SCHEDULER (EVERY 30 MIN)
    // =====================================================
    cron.schedule('*/30 * * * *', async () => {
      console.log('🚦 Checking Application Queue limits...');

      try {
        /**
         * 🚀 FUTURE IMPLEMENTATION:
         * - Count today's applications per user
         * - Limit: 10/day
         * - Pick top scored jobs from ApplicationQueue
         * - Move:
         *   pending → queued_for_today
         */

        // Example pseudo-logic:
        // const todayCount = await ApplicationQueue.countDocuments({
        //   userId,
        //   status: 'applied',
        //   appliedAt: { $gte: startOfToday }
        // });

        // if (todayCount < 10) {
        //   move top priority jobs
        // }

      } catch (error) {
        console.error('❌ Scheduler Error:', error);
      }
    });

    // ================= START SERVER =================
    app.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));