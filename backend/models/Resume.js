const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    default: 'Default Resume'
  },
  // We embed the extracted JSON representing skills, education, and experience 
  // since this data is always accessed natively with the Resume document 
  // and fits within 16MB document size limits comfortably.
  parsedData: {
    skills: [String],
    projects: [{
      name: String,
      description: String,
      technologies: [String]
    }],
    experience: [{
      company: String,
      role: String,
      duration: String,
      description: String
    }],
    education: [{
      institution: String,
      degree: String,
      year: String
    }]
  },
  rawFileUrl: {
    type: String // URL to S3 or local path for the original PDF
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Resume', resumeSchema);