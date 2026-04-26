const mongoose = require('mongoose');

const aiInsightSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    default: null
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    default: null
  },
  type: {
    type: String,
    enum: ['job_analysis', 'resume_optimization', 'cover_letter', 'skill_gap'],
    required: true,
    index: true
  },
  title: {
    type: String,
    default: ''
  },
  input: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  output: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

aiInsightSchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('AIInsight', aiInsightSchema);
