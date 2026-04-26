const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const Resume = require('../models/Resume');
const { jobApplyAutomationService, detectPlatform } = require('../services/jobApplyAutomation');

async function resolveResume(userId, explicitResumeId) {
    if (explicitResumeId) {
        const explicitResume = await Resume.findOne({
            _id: explicitResumeId,
            userId
        });

        if (explicitResume) return explicitResume;
    }

    return Resume.findOne({ userId }).sort({ createdAt: -1 });
}

async function resolveApplicationForAutomation({ userId, applicationId, jobId, resumeId }) {
    let application = null;

    if (applicationId) {
        application = await Application.findOne({
            _id: applicationId,
            userId
        });
    }

    let job = null;
    if (application?.jobId) {
        job = await Job.findById(application.jobId);
    } else if (jobId) {
        job = await Job.findById(jobId);
    }

    if (!job) {
        return { error: 'Job not found.' };
    }

    const user = await User.findById(userId);
    if (!user) {
        return { error: 'User not found.' };
    }

    const resume = await resolveResume(userId, resumeId || application?.resumeId);
    if (!resume) {
        return { error: 'No uploaded resume found for this user.' };
    }

    if (!application) {
        application = await Application.findOneAndUpdate(
            { userId, jobId: job._id },
            {
                $setOnInsert: {
                    userId,
                    jobId: job._id,
                    resumeId: resume._id,
                    status: 'Ready to Apply',
                    decision: 'Apply'
                }
            },
            {
                upsert: true,
                new: true
            }
        );
    } else if (!application.resumeId) {
        application.resumeId = resume._id;
        await application.save();
    }

    return { application, job, user, resume };
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

    const noteParts = [
        `Automation platform: ${application.automation.platform || 'other'}`,
        result.reason || 'No portal response.',
        result.uploadedResume ? 'Resume uploaded successfully.' : 'Resume upload not confirmed.',
        result.filledFields?.length ? `Filled ${result.filledFields.length} common fields.` : 'No common fields were auto-filled.',
        result.actionsTaken?.length ? `Workflow steps: ${result.actionsTaken.join(' -> ')}.` : '',
        result.validationErrors?.length ? `Validation: ${result.validationErrors.join(' | ')}.` : ''
    ];

    application.notes = noteParts.filter(Boolean).join(' ');

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
            application = await Application.findOne({
                _id: applicationId,
                userId: req.user.id
            });
        }

        if (!application) {
            application = await Application.findOne({
                userId: req.user.id,
                jobId: job._id
            });
        }

        if (!application) {
            return res.status(404).json({
                error: "Application record not found for this job."
            });
        }

        application.status = "Reviewing";
        application.notes = `Application prepared for automation/manual review on ${new Date().toLocaleString()}`;
        await application.save();

        return res.json({
            success: true,
            message: 'Application marked for automation/manual review.',
            applicationId: application._id,
            jobUrl: job.url,
            nextSteps: [
                'Trigger POST /api/apply/auto to let the backend attempt the submission.',
                'If the portal blocks automation, review the saved notes and screenshot path.',
                "Use POST /api/apply/complete to mark the final outcome if you finish manually."
            ]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: "Error initiating smart applications."
        });
    }
};


const getApplyContext = async (req, res) => {
    try {
        const applicationId = req.params.applicationId;

        const user = await User.findById(req.user.id).lean();

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const application = await Application.findOne({
            _id: applicationId,
            userId: req.user.id
        })
            .populate('jobId')
            .populate('resumeId')
            .lean();

        if (!application) {
            return res.status(404).json({ error: 'Application not found.' });
        }

        const latestResume =
            application.resumeId ||
            await Resume.findOne({ userId: req.user.id })
                .sort({ createdAt: -1 })
                .lean();

        const profile = {
            name: latestResume?.parsedData?.name || user.name || '',
            email: latestResume?.parsedData?.email || user.email || '',
            phone: latestResume?.parsedData?.phone || '',
            location: latestResume?.parsedData?.location || '',
            linkedin: latestResume?.parsedData?.linkedin || '',
            github: latestResume?.parsedData?.github || '',
            portfolio: latestResume?.parsedData?.portfolio || '',
            summary: latestResume?.parsedData?.summary || '',
            skills: latestResume?.parsedData?.skills || [],
            projects: latestResume?.parsedData?.projects || [],
            experience: latestResume?.parsedData?.experience || [],
            education: latestResume?.parsedData?.education || [],
        };

        // ✅ UPDATED RESPONSE WITH COVER LETTER
        return res.json({
            applicationId: application._id,
            profile,

            // ---> NEW: Send AI-generated cover letter <---
            coverLetter: application.coverLetter || '',

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
            },
            automation: application.automation || null
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: 'Error loading extension apply context.'
        });
    }
};


const completeApplication = async (req, res) => {
    try {
        const { applicationId, outcome, notes } = req.body;

        if (!applicationId || !outcome) {
            return res.status(400).json({
                error: "applicationId and outcome are required."
            });
        }

        const application = await Application.findOne({
            _id: applicationId,
            userId: req.user.id
        });

        if (!application) {
            return res.status(404).json({
                error: "Application not found."
            });
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

        return res.json({
            success: true,
            application
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: "Error updating application status."
        });
    }
};
const updateCoverLetter = async (req, res) => {
    try {
        const applicationId = req.params.applicationId || req.body.applicationId;
        const { coverLetter } = req.body;

        if (!applicationId) {
            return res.status(400).json({ error: "applicationId is required." });
        }

        const application = await Application.findOne({ _id: applicationId, userId: req.user.id });
        
        if (!application) {
            return res.status(404).json({ error: "Application not found." });
        }

        application.coverLetter = coverLetter;
        await application.save();

        return res.json({ success: true, message: "Cover letter updated" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error updating cover letter." });
    }
};

const autoApplyToJob = async (req, res) => {
    try {
        const {
            applicationId,
            jobId,
            resumeId,
            finalSubmit = true,
            headless = process.env.AUTO_APPLY_HEADLESS !== 'false'
        } = req.body || {};

        const resolved = await resolveApplicationForAutomation({
            userId: req.user.id,
            applicationId,
            jobId,
            resumeId
        });

        if (resolved.error) {
            return res.status(404).json({ error: resolved.error });
        }

        const { application, job, user, resume } = resolved;

        const result = await jobApplyAutomationService.apply({
            application,
            user,
            resume,
            job,
            finalSubmit,
            headless
        });

        await persistAutomationOutcome(application, result);

        return res.json({
            success: result.success,
            applicationId: application._id,
            status: application.status,
            automation: application.automation,
            result
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: 'Error during automated application attempt.'
        });
    }
};

const autoApplyBatch = async (req, res) => {
    try {
        const {
            limit = 5,
            resumeId,
            finalSubmit = true,
            headless = process.env.AUTO_APPLY_HEADLESS !== 'false'
        } = req.body || {};

        const applications = await Application.find({
            userId: req.user.id,
            status: { $in: ['Ready to Apply', 'Reviewing'] },
            decision: 'Apply'
        })
            .sort({ atsScore: -1, createdAt: -1 })
            .limit(Math.max(1, Math.min(Number(limit) || 5, 20)))
            .populate('jobId')
            .populate('resumeId');

        if (!applications.length) {
            return res.json({
                success: true,
                processed: 0,
                results: []
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const latestResume = await resolveResume(req.user.id, resumeId);
        if (!latestResume) {
            return res.status(400).json({ error: 'No uploaded resume found for this user.' });
        }

        const results = [];

        for (const application of applications) {
            const job = application.jobId;
            if (!job?.url) {
                application.status = 'Failed';
                application.notes = 'Skipped by automation: job URL missing.';
                await application.save();
                results.push({
                    applicationId: application._id,
                    success: false,
                    status: application.status,
                    reason: application.notes
                });
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

            results.push({
                applicationId: application._id,
                jobId: job._id,
                jobTitle: job.title,
                success: result.success,
                status: application.status,
                platform: result.platform,
                reason: result.reason,
                screenshotPath: result.screenshotPath || ''
            });
        }

        return res.json({
            success: true,
            processed: results.length,
            applied: results.filter((item) => item.status === 'Applied').length,
            manualReview: results.filter((item) => item.status === 'Reviewing').length,
            failed: results.filter((item) => item.status === 'Failed').length,
            results
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: 'Error while running batch auto-apply.'
        });
    }
};

module.exports = {
    applyToJob,
    autoApplyToJob,
    autoApplyBatch,
    completeApplication,
    getApplyContext,
    updateCoverLetter
};
