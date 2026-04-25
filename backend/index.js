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

// ================= SERVICES & MODELS =================
const jobScraper = require('./services/jobScraper');
const autoMatcher = require('./services/autoMatcher'); // ✅ NEW
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
  res.json({ status: 'ok', service: 'Node.js Backend' })
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

    // ================= CRON JOB =================
    // Runs every day at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🌙 Running nightly automation pipeline...');

      try {
        // ================= STEP 1: FETCH JOBS =================
        const newJobs = await jobScraper.fetchAllFreeJobs('Software Engineer');

        // ================= STEP 2: SAVE JOBS =================
        for (const jobData of newJobs) {
          await Job.findOneAndUpdate(
            { url: jobData.url },
            jobData,
            { upsert: true, new: true }
          );
        }

        console.log(`✅ Job sync complete. Saved ${newJobs.length} jobs.`);

        // ================= STEP 3: AUTO MATCHING =================
        console.log('🤖 Running AI job matching engine...');
        await autoMatcher.runNightlyMatching();

        console.log('✅ Matching process completed.');

      } catch (error) {
        console.error('❌ Error during automated background tasks:', error);
      }
    });

    // ================= START SERVER =================
    app.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));