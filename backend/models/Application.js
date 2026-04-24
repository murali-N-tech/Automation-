const mongoose = require('mongoose');

// We use database referencing for Applications rather than embedding them inside  
// the User document to avoid the MongoDB 16MB document limit and unbounded array sizes.
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
  status: {
    type: String,
    enum: ['Saved', 'Reviewing', 'Applied', 'Rejected', 'Interviewing', 'Offer', 'Failed'],
    default: 'Saved'
  },
  atsScore: {
    type: Number, // Percentage 0-100 indicating match per Decision Engine
    min: 0,
    max: 100
  },
  decision: {
    type: String,
    enum: ['Apply', 'Skip', 'Improve', 'Pending'],
    default: 'Pending'
  },
  missingKeywords: [String],
  appliedAt: {
    type: Date
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// A user should typically apply to the same job mostly once
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);