const axios = require('axios');
const mongoose = require('mongoose');

const AIInsight = require('../models/AIInsight');
const Application = require('../models/Application');
const Job = require('../models/Job');
const Resume = require('../models/Resume');

const AI_SERVICE = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const aiClient = axios.create({
  baseURL: AI_SERVICE,
  timeout: 30000
});

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function loadResumeForUser(userId, { resumeId, resume_data }) {
  if (resume_data && typeof resume_data === 'object') {
    return {
      resumeDoc: resumeId && isObjectId(resumeId)
        ? await Resume.findOne({ _id: resumeId, userId })
        : null,
      resumeData: resume_data
    };
  }

  let query = { userId };
  if (resumeId) {
    if (!isObjectId(resumeId)) {
      const err = new Error('Invalid resumeId.');
      err.status = 400;
      throw err;
    }
    query = { _id: resumeId, userId };
  }

  const resumeDoc = await Resume.findOne(query).sort({ createdAt: -1 });
  if (!resumeDoc) {
    const err = new Error('Resume not found. Upload a resume or provide resume_data.');
    err.status = 404;
    throw err;
  }

  return {
    resumeDoc,
    resumeData: resumeDoc.parsedData
  };
}

async function loadJobContext({ jobId, job_description, job_title, company_name }) {
  let jobDoc = null;
  let description = String(job_description || '').trim();
  let title = String(job_title || '').trim();
  let companyName = String(company_name || '').trim();

  if (jobId) {
    if (!isObjectId(jobId)) {
      const err = new Error('Invalid jobId.');
      err.status = 400;
      throw err;
    }

    jobDoc = await Job.findById(jobId);
    if (!jobDoc) {
      const err = new Error('Job not found.');
      err.status = 404;
      throw err;
    }

    description = description || jobDoc.description || '';
    title = title || jobDoc.title || '';
    companyName = companyName || jobDoc.company?.name || '';
  }

  if (!description) {
    const err = new Error('job_description or jobId is required.');
    err.status = 400;
    throw err;
  }

  return {
    jobDoc,
    jobDescription: description,
    jobTitle: title,
    companyName
  };
}

async function saveInsight({ userId, resumeId, jobId, type, title, input, output }) {
  return AIInsight.create({
    userId,
    resumeId: resumeId || null,
    jobId: jobId || null,
    type,
    title: title || '',
    input,
    output
  });
}

function serviceErrorResponse(res, error, fallbackMessage) {
  const status = error.response?.status || error.status || 500;
  const detail = error.response?.data?.detail || error.response?.data?.error || error.message || fallbackMessage;
  return res.status(status).json({ error: detail });
}

async function analyzeJob(req, res) {
  try {
    const { resumeId, resume_data, jobId, job_description, job_title, company_name } = req.body;
    const { resumeDoc, resumeData } = await loadResumeForUser(req.user.id, { resumeId, resume_data });
    const { jobDoc, jobDescription, jobTitle, companyName } = await loadJobContext({
      jobId,
      job_description,
      job_title,
      company_name
    });

    const aiResponse = await aiClient.post('/matcher/job-analysis', {
      resume_data: resumeData,
      job_description: jobDescription,
      job_title: jobTitle,
      company_name: companyName
    });

    const analysis = aiResponse.data;

    if (jobDoc && resumeDoc) {
      const existingApplication = await Application.findOne({
        userId: req.user.id,
        jobId: jobDoc._id,
        resumeId: resumeDoc._id
      });

      if (existingApplication) {
        existingApplication.atsScore = analysis.match_score;
        existingApplication.decision = analysis.match_score >= 70
          ? 'Apply'
          : (analysis.match_score >= 50 ? 'Improve' : 'Skip');
        existingApplication.missingKeywords = analysis.missing_skills || [];
        await existingApplication.save();
      }
    }

    const insight = await saveInsight({
      userId: req.user.id,
      resumeId: resumeDoc?._id,
      jobId: jobDoc?._id,
      type: 'job_analysis',
      title: `${jobTitle || 'Job'} analysis`,
      input: {
        jobTitle,
        companyName,
        jobDescription
      },
      output: analysis
    });

    return res.json({
      ...analysis,
      insightId: insight._id
    });
  } catch (error) {
    return serviceErrorResponse(res, error, 'Failed to analyze job match.');
  }
}

async function optimizeResume(req, res) {
  try {
    const { resumeId, resume_data, jobId, job_description, target_variant } = req.body;
    const { resumeDoc, resumeData } = await loadResumeForUser(req.user.id, { resumeId, resume_data });
    const { jobDoc, jobDescription } = await loadJobContext({
      jobId,
      job_description
    });

    const aiResponse = await aiClient.post('/matcher/optimize-resume', {
      resume_data: resumeData,
      job_description: jobDescription,
      target_variant: target_variant || 'general'
    });

    const insight = await saveInsight({
      userId: req.user.id,
      resumeId: resumeDoc?._id,
      jobId: jobDoc?._id,
      type: 'resume_optimization',
      title: `Resume optimization (${target_variant || 'general'})`,
      input: {
        target_variant: target_variant || 'general',
        jobDescription
      },
      output: aiResponse.data
    });

    return res.json({
      ...aiResponse.data,
      insightId: insight._id
    });
  } catch (error) {
    return serviceErrorResponse(res, error, 'Failed to optimize resume.');
  }
}

async function generateCoverLetter(req, res) {
  try {
    const { resumeId, resume_data, jobId, job_description, job_title, company_name, applicationId } = req.body;
    const { resumeDoc, resumeData } = await loadResumeForUser(req.user.id, { resumeId, resume_data });
    const { jobDoc, jobDescription, jobTitle, companyName } = await loadJobContext({
      jobId,
      job_description,
      job_title,
      company_name
    });

    const aiResponse = await aiClient.post('/matcher/cover-letter-tailored', {
      resume_data: resumeData,
      job_description: jobDescription,
      job_title: jobTitle,
      company_name: companyName
    });

    if (applicationId && isObjectId(applicationId)) {
      await Application.findOneAndUpdate(
        { _id: applicationId, userId: req.user.id },
        { $set: { coverLetter: aiResponse.data.cover_letter } }
      );
    }

    const insight = await saveInsight({
      userId: req.user.id,
      resumeId: resumeDoc?._id,
      jobId: jobDoc?._id,
      type: 'cover_letter',
      title: `${jobTitle || 'Job'} cover letter`,
      input: {
        jobTitle,
        companyName,
        jobDescription
      },
      output: aiResponse.data
    });

    return res.json({
      ...aiResponse.data,
      insightId: insight._id
    });
  } catch (error) {
    return serviceErrorResponse(res, error, 'Failed to generate cover letter.');
  }
}

async function analyzeSkillGap(req, res) {
  try {
    const { resumeId, resume_data, jobIds, job_descriptions } = req.body;
    const { resumeDoc, resumeData } = await loadResumeForUser(req.user.id, { resumeId, resume_data });

    let descriptions = Array.isArray(job_descriptions)
      ? job_descriptions.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

    let jobs = [];
    if (Array.isArray(jobIds) && jobIds.length > 0) {
      const validIds = jobIds.filter(isObjectId);
      jobs = await Job.find({ _id: { $in: validIds } });
      descriptions = descriptions.concat(jobs.map((job) => job.description).filter(Boolean));
    }

    if (!descriptions.length) {
      const err = new Error('Provide job_descriptions or jobIds for skill gap analysis.');
      err.status = 400;
      throw err;
    }

    const aiResponse = await aiClient.post('/matcher/skill-gap', {
      resume_data: resumeData,
      job_descriptions: descriptions
    });

    const insight = await saveInsight({
      userId: req.user.id,
      resumeId: resumeDoc?._id,
      type: 'skill_gap',
      title: 'Skill gap analysis',
      input: {
        jobCount: descriptions.length,
        jobIds: jobs.map((job) => job._id.toString())
      },
      output: aiResponse.data
    });

    return res.json({
      ...aiResponse.data,
      insightId: insight._id
    });
  } catch (error) {
    return serviceErrorResponse(res, error, 'Failed to analyze skill gap.');
  }
}

module.exports = {
  analyzeJob,
  optimizeResume,
  generateCoverLetter,
  analyzeSkillGap
};
