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

  followUpDate: Date,

  labels: [String],

  coverLetter: String,

  timeline: [{
    status: String,
    changedAt: {
      type: Date,
      default: Date.now
    },
    note: String
  }],

  automation: {
    platform: {
      type: String,
      default: 'other'
    },
    attempts: {
      type: Number,
      default: 0
    },
    lastRunAt: Date,
    lastOutcome: String,
    lastError: String,
    lastUrl: String,
    screenshotPath: String,
    requiresManualAction: {
      type: Boolean,
      default: false
    }
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Prevent duplicate applications
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

applicationSchema.pre('save', function trackTimeline() {
  if (!Array.isArray(this.timeline)) {
    this.timeline = [];
  }

  if (this.isNew) {
    this.timeline.push({
      status: this.status,
      changedAt: this.createdAt || new Date(),
      note: this.notes || ''
    });
    return;
  }

  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      changedAt: new Date(),
      note: this.notes || ''
    });
  }
});

module.exports = mongoose.model('Application', applicationSchema);
