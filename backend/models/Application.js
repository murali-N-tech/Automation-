const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    required: true
  },

  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true
  },

  // Application Lifecycle Status
  status: {
    type: String,
    enum: [
      'Saved',
      'Ready to Apply',
      'Reviewing',
      'Applied',
      'Rejected',
      'Interviewing',
      'Offer',
      'Failed'
    ],
    default: 'Saved'
  },

  // ATS Matching Score (0–100)
  atsScore: {
    type: Number,
    min: 0,
    max: 100
  },

  // Decision Engine Output
  decision: {
    type: String,
    enum: ['Apply', 'Skip', 'Improve', 'Pending'],
    default: 'Pending'
  },

  missingKeywords: [String],

  appliedAt: Date,

  notes: String,

  coverLetter: String,

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Prevent duplicate applications
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);