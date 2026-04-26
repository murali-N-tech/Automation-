const Job = require('../models/Job');
const Application = require('../models/Application');
const Resume = require('../models/Resume');
const User = require('../models/User');
const jobScraper = require('../services/jobScraper');
const llmService = require('../services/llmService');
const { jobApplyAutomationService, detectPlatform } = require('../services/jobApplyAutomation');
const axios = require('axios');

async function syncJobsInternal({ keyword, location }) {
    const urlToScrape = `https://example-job-board.com/search?q=${keyword}&l=${location}`;
    const searchTerm = keyword || 'Software Engineer';

    const scrapedJobs = jobScraper.fetchAllFreeJobs
        ? await jobScraper.fetchAllFreeJobs(searchTerm)
        : await jobScraper.scrapeGenericJobBoard(urlToScrape, searchTerm);

    const savedJobs = [];

    for (const jobData of scrapedJobs) {
        if (String(jobData.url || '').includes('w3schools.com')) {
            continue;
        }

        const existingJob = await Job.findOne({ url: jobData.url });
        if (existingJob) continue;

        let requiredSkills = [];
        try {
            const aiRes = await axios.post('http://localhost:8000/matcher/extract-job-skills', {
                description: jobData.description
            });
            requiredSkills = aiRes.data.required_skills || [];
        } catch (err) {
            console.error(`AI Extractor Error for ${jobData.title}:`, err.message);
        }

        const job = new Job({
            ...jobData,
            description: String(jobData.description || '').trim() || 'Description unavailable from source.',
            requiredSkills
        });
        await job.save();
        savedJobs.push(job);
    }

    return savedJobs;
}

async function matchJobsInternal(userId) {
    const resume = await Resume.findOne({ userId }).sort({ createdAt: -1 });
    if (!resume || !resume.parsedData || !resume.parsedData.skills) {
        const error = new Error('Resume missing or not correctly parsed.');
        error.statusCode = 400;
        throw error;
    }

    const userSkills = resume.parsedData.skills;
    const appliedJobs = await Application.find({ userId }).select('jobId');
    const appliedJobIds = appliedJobs.map((app) => app.jobId);
    const unseenJobs = await Job.find({ _id: { $nin: appliedJobIds } });

    const newMatches = [];

    for (const job of unseenJobs) {
        try {
            const matchRes = await axios.post('http://localhost:8000/matcher/score-job', {
                resume_skills: userSkills,
                job_skills: job.requiredSkills || []
            });

            const { ats_score, missing_keywords, recommendation } = matchRes.data;
            const isTopMatch = Number(ats_score) >= 75;

            let generatedLetter = '';
            if (isTopMatch) {
                generatedLetter = await llmService.generateCoverLetter(
                    job.title || 'Software Engineer',
                    job.company?.name || 'the company',
                    userSkills || []
                );
            }

            const application = new Application({
                userId,
                resumeId: resume._id,
                jobId: job._id,
                atsScore: ats_score,
                decision: recommendation,
                missingKeywords: missing_keywords,
                status: isTopMatch ? 'Ready to Apply' : 'Saved',
                coverLetter: generatedLetter
            });

            await application.save();
            newMatches.push(application);
        } catch (err) {
            console.error(`AI Scoring Error for Job ${job.title}:`, err.message);
        }
    }

    return newMatches;
}

async function persistAutomationOutcome(application, result) {
    application.automation = application.automation || {};
    application.automation.platform = result.platform || detectPlatform(result.currentUrl || '');
    application.automation.attempts = Number(application.automation.attempts || 0) + 1;
    application.automation.lastRunAt = new Date();
    application.automation.lastOutcome = result.submitted
        ? 'submitted'
        : (result.requiresManualAction ? 'manual_required' : 'failed');
    application.automation.lastError = result.success ? '' : (result.reason || '');
    application.automation.lastUrl = result.currentUrl || '';
    application.automation.screenshotPath = result.screenshotPath || '';
    application.automation.requiresManualAction = Boolean(result.requiresManualAction);

    application.notes = [
        `Automation platform: ${application.automation.platform || 'other'}`,
        result.reason || '',
        result.uploadedResume ? 'Resume uploaded successfully.' : 'Resume upload not confirmed.',
        result.filledFields?.length ? `Filled ${result.filledFields.length} common fields.` : 'No common fields were auto-filled.',
        result.actionsTaken?.length ? `Workflow steps: ${result.actionsTaken.join(' -> ')}.` : '',
        result.validationErrors?.length ? `Validation: ${result.validationErrors.join(' | ')}.` : ''
    ].filter(Boolean).join(' ');

    if (result.submitted) {
        application.status = 'Applied';
        application.appliedAt = new Date();
    } else if (result.requiresManualAction) {
        application.status = 'Reviewing';
    } else {
        application.status = 'Failed';
    }

    await application.save();
    return application;
}

const syncJobs = async (req, res) => {
    try {
        const { keyword, location } = req.body || {};
        const savedJobs = await syncJobsInternal({ keyword, location });

        // Return the successfully scored jobs and synced data
        res.json({ message: "Job sync and parsing complete", syncedCount: savedJobs.length, newJobs: savedJobs });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to sync jobs" });
    }
};

const matchJobs = async (req, res) => {
    try {
        const newMatches = await matchJobsInternal(req.user.id);
        
        res.json({ message: `Successfully generated ${newMatches.length} new matches.`, newMatches });
    } catch (e) {
        console.error(e);
        res.status(e.statusCode || 500).json({ error: e.message || "Failed to run the matching engine" });
    }
};

const getRecommendations = async (req, res) => {
    try {
        // Find applications representing matches for the specified User
        const apps = await Application.find({ userId: req.user.id })
            .populate('jobId')
            .sort({ atsScore: -1 });

        const filtered = apps.filter((app) => !String(app.jobId?.url || '').includes('w3schools.com'));
            
        res.json(filtered);
    } catch (e) {
        res.status(500).json({ error: "Cannot fetch recommendations" });
    }
};

const runFullAutomation = async (req, res) => {
    try {
        const {
            keyword,
            location,
            applyLimit = 5,
            finalSubmit = true,
            headless = process.env.AUTO_APPLY_HEADLESS !== 'false'
        } = req.body || {};

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const latestResume = await Resume.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
        if (!latestResume) {
            return res.status(400).json({ error: 'Upload a resume before running full automation.' });
        }

        const savedJobs = await syncJobsInternal({ keyword, location });
        const newMatches = await matchJobsInternal(req.user.id);

        const readyApplications = await Application.find({
            userId: req.user.id,
            status: { $in: ['Ready to Apply', 'Reviewing'] },
            decision: 'Apply'
        })
            .sort({ atsScore: -1, createdAt: -1 })
            .limit(Math.max(1, Math.min(Number(applyLimit) || 5, 20)))
            .populate('jobId')
            .populate('resumeId');

        const automationResults = [];

        for (const application of readyApplications) {
            const job = application.jobId;
            if (!job?.url) {
                continue;
            }

            const resume = application.resumeId || latestResume;
            const result = await jobApplyAutomationService.apply({
                application,
                user,
                resume,
                job,
                finalSubmit,
                headless
            });

            await persistAutomationOutcome(application, result);

            automationResults.push({
                applicationId: application._id,
                jobTitle: job.title,
                status: application.status,
                success: result.success,
                platform: result.platform,
                reason: result.reason
            });
        }

        return res.json({
            success: true,
            fetchedJobs: savedJobs.length,
            newMatches: newMatches.length,
            processedApplications: automationResults.length,
            applied: automationResults.filter((item) => item.status === 'Applied').length,
            manualReview: automationResults.filter((item) => item.status === 'Reviewing').length,
            failed: automationResults.filter((item) => item.status === 'Failed').length,
            results: automationResults
        });
    } catch (e) {
        console.error(e);
        return res.status(e.statusCode || 500).json({
            error: e.message || 'Failed to run full automation pipeline.'
        });
    }
};

module.exports = { syncJobs, matchJobs, getRecommendations, runFullAutomation };
