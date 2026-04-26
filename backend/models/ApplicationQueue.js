const mongoose = require('mongoose');

const applicationQueueSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true
  },

  // 🔥 Composite AI Score (ATS + Recency + Fit + Salary etc.)
  score: {
    type: Number,
    required: true
  },

  // Priority Queue System
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
    index: true
  },

  // Platform identifier (important for automation scripts)
  platform: {
    type: String,
    required: true,
    enum: ['greenhouse', 'lever', 'workday', 'naukri', 'linkedin', 'other']
  },

  // ⚙️ State Machine
  status: {
    type: String,
    enum: [
      'pending',
      'queued_for_today',
      'applied',
      'ignored',
      'failed'
    ],
    default: 'pending',
    index: true
  },

  // Scheduling
  scheduledAt: Date,
  appliedAt: Date

}, { timestamps: true });

// Prevent duplicate queue entries
applicationQueueSchema.index({ userId: 1, jobId: 1 }, { unique: true });

// Optional: optimize scheduler queries
applicationQueueSchema.index({ status: 1, priority: -1, score: -1 });

module.exports = mongoose.model('ApplicationQueue', applicationQueueSchema);