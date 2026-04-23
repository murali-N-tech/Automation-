const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  company: {
    name: String,
    logoUrl: String,
    website: String
  },
  description: {
    type: String, // raw JD
    required: true
  },
  requiredSkills: [{
    type: String,
    index: true
  }],
  url: {
    type: String,
    required: true,
    unique: true
  },
  salaryRange: String,
  location: String,
  remote: Boolean,
  postedAt: {
    type: Date,
    default: Date.now
  }
});

// Remove duplicate schema index logic since unique: true applies it automatically

module.exports = mongoose.model('Job', jobSchema);