require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

// Route imports
const authRoutes = require('./routes/authRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applyRoutes = require('./routes/applyRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

const allowedWebOrigins = ['http://localhost:5173', 'http://localhost:5174'];

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);

  if (allowedWebOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
    return callback(null, true);
  }

  return callback(new Error('Not allowed by CORS'));
};

// Middleware
app.use(cors({ 
  origin: corsOrigin,
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

// Test Route
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Node.js Backend' }));

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/apply', applyRoutes);
app.use('/api/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-placement-officer';

// Initialize DB and server
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));