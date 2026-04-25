const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const Resume = require('../models/Resume');

const applyToJob = async (req, res) => {
    try {
        const { applicationId, jobId } = req.body;
        if (!jobId) {
            return res.status(400).json({ error: "jobId is required." });
        }

        const user = await User.findById(req.user.id);
        const job = await Job.findById(jobId);

        if (!job || !user) {
             return res.status(404).json({ error: "Job or User not found." });
        }

        let application = null;
        if (applicationId) {
            application = await Application.findOne({ _id: applicationId, userId: req.user.id });
        }

        if (!application) {
            application = await Application.findOne({ userId: req.user.id, jobId: job._id });
        }

        if (!application) {
            return res.status(404).json({ error: "Application record not found for this job." });
        }

        application.status = "Reviewing";
        application.notes = `Extension-assisted apply started on ${new Date().toLocaleString()}`;
        await application.save();

        return res.json({
            success: true,
            message: 'Application marked for extension-assisted review.',
            applicationId: application._id,
            jobUrl: job.url,
            nextSteps: [
                'Open the job URL and use the AI Placement Officer Chrome extension.',
                'Review all autofilled values before final submit.',
                "After submitting, click 'Mark Applied' in the app."
            ]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error initiating smart applications." });
    }
};

const getApplyContext = async (req, res) => {
    try {
        const applicationId = req.params.applicationId;
        const user = await User.findById(req.user.id).lean();

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const application = await Application.findOne({ _id: applicationId, userId: req.user.id })
            .populate('jobId')
            .populate('resumeId')
            .lean();

        if (!application) {
            return res.status(404).json({ error: 'Application not found.' });
        }

        const latestResume = application.resumeId || await Resume.findOne({ userId: req.user.id }).sort({ createdAt: -1 }).lean();

        const profile = {
            name: user.name || '',
            email: user.email || '',
            phone: '',
            skills: latestResume?.parsedData?.skills || [],
            projects: latestResume?.parsedData?.projects || [],
            experience: latestResume?.parsedData?.experience || [],
        };

        return res.json({
            applicationId: application._id,
            profile,
            resume: {
                id: latestResume?._id || null,
                title: latestResume?.title || null,
                rawFileUrl: latestResume?.rawFileUrl || null,
            },
            job: {
                id: application.jobId?._id || null,
                title: application.jobId?.title || '',
                company: application.jobId?.company || null,
                location: application.jobId?.location || '',
                url: application.jobId?.url || '',
                description: application.jobId?.description || '',
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error loading extension apply context.' });
    }
};

const completeApplication = async (req, res) => {
    try {
        const { applicationId, outcome, notes } = req.body;

        if (!applicationId || !outcome) {
            return res.status(400).json({ error: "applicationId and outcome are required." });
        }

        const application = await Application.findOne({ _id: applicationId, userId: req.user.id });
        if (!application) {
            return res.status(404).json({ error: "Application not found." });
        }

        if (outcome === 'applied') {
            application.status = 'Applied';
            application.appliedAt = new Date();
        } else if (outcome === 'failed') {
            application.status = 'Failed';
        } else {
            application.status = 'Saved';
        }

        if (typeof notes === 'string' && notes.trim()) {
            application.notes = notes.trim();
        }

        await application.save();

        return res.json({ success: true, application });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error updating application status." });
    }
};

module.exports = { applyToJob, completeApplication, getApplyContext };