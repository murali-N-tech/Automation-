const Job = require('../models/Job');
const Application = require('../models/Application');
const Resume = require('../models/Resume');
const jobScraper = require('../services/jobScraper');
const axios = require('axios');

const syncJobs = async (req, res) => {
    try {
        const { keyword, location } = req.body || {};
        
        // 1. Scrape the job board
        const urlToScrape = `https://example-job-board.com/search?q=${keyword}&l=${location}`;
        const scrapedJobs = await jobScraper.scrapeGenericJobBoard(urlToScrape, keyword || 'Software Engineer');
        
        const savedJobs = [];
        
        // 2. Parse required skills from Job Descriptions utilizing our Python AI service
        for (const jobData of scrapedJobs) {
            // Check if job exists by URL to avoid duplicates
            let existingJob = await Job.findOne({ url: jobData.url });
            if (existingJob) continue;
            
            // Call AI microservice to extract exact skill arrays and metadata
            let requiredSkills = [];
            try {
                const aiRes = await axios.post('http://localhost:8000/matcher/extract-job-skills', {
                    description: jobData.description
                });
                requiredSkills = aiRes.data.required_skills || [];
            } catch (err) {
                console.error(`AI Extractor Error for ${jobData.title}:`, err.message);
            }
            
            // Build new job
            const job = new Job({
                ...jobData,
                requiredSkills
            });
            await job.save();
            savedJobs.push(job);
        }

        // Return the successfully scored jobs and synced data
        res.json({ message: "Job sync and parsing complete", syncedCount: savedJobs.length, newJobs: savedJobs });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to sync jobs" });
    }
};

const matchJobs = async (req, res) => {
    try {
        // Find the user's latest parsed resume
        const resume = await Resume.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
        if (!resume || !resume.parsedData || !resume.parsedData.skills) {
            return res.status(400).json({ error: "Resume missing or not correctly parsed." });
        }

        const userSkills = resume.parsedData.skills;
        
        // Find all jobs that the user hasn't yet scored/applied to
        const appliedJobs = await Application.find({ userId: req.user.id }).select('jobId');
        const appliedJobIds = appliedJobs.map(app => app.jobId);
        
        const unseenJobs = await Job.find({ _id: { $nin: appliedJobIds } });
        
        const newMatches = [];
        
        for (const job of unseenJobs) {
            try {
                // Determine ATS score utilizing Python Matching Service
                const matchRes = await axios.post('http://localhost:8000/matcher/score-job', {
                    resume_skills: userSkills,
                    job_skills: job.requiredSkills || []
                });

                const { ats_score, missing_keywords, recommendation } = matchRes.data;
                
                // Create an Application tracking schema for this job
                const application = new Application({
                    userId: req.user.id,
                    resumeId: resume._id,
                    jobId: job._id,
                    atsScore: ats_score,
                    decision: recommendation,
                    missingKeywords: missing_keywords,
                    status: 'Saved' // Starts out as saved/recommended
                });
                
                await application.save();
                newMatches.push(application);
            } catch (err) {
                console.error(`AI Scoring Error for Job ${job.title}:`, err.message);
            }
        }
        
        res.json({ message: `Successfully generated ${newMatches.length} new matches.`, newMatches });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to run the matching engine" });
    }
};

const getRecommendations = async (req, res) => {
    try {
        // Find applications representing matches for the specified User
        const apps = await Application.find({ userId: req.user.id })
            .populate('jobId')
            .sort({ atsScore: -1 });
            
        res.json(apps);
    } catch (e) {
        res.status(500).json({ error: "Cannot fetch recommendations" });
    }
};

module.exports = { syncJobs, matchJobs, getRecommendations };