const SmartApplyAssistant = require('../services/automator');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');

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

        // Simulating the user's data structure to fill out the form
        const userProfile = {
            name: user.name || "Candidate",
            email: user.email || "candidate@example.com",
            phone: "555-0100"
        };
        
        let resumePath = null;
        // In real impl, we fetch resume path from the user's associated parsed resume in the DB

        // Trigger Puppeteer logic
        // This will launch Chrome so the user can verify fields manually (Human-in-the-loop)
        const result = await SmartApplyAssistant.autofillApplication(job.url, userProfile, resumePath);

        if (result.success) {
            application.status = "Reviewing";
            application.notes = `Autofill started on ${new Date().toLocaleString()}`;
            await application.save();

            return res.json({
                success: true,
                message: result.message,
                applicationId: application._id,
                filledFields: result.filledFields || [],
                warnings: result.warnings || [],
                nextSteps: [
                    "Review the opened browser form and verify all autofilled fields.",
                    "Upload any required files and solve CAPTCHA manually.",
                    "Submit in browser, then click 'Mark Applied' in the app."
                ]
            });
        } else {
            application.status = "Failed";
            application.notes = `Autofill failed: ${result.error}`;
            await application.save();
            return res.status(500).json({ error: result.error });
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error initiating smart applications." });
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

module.exports = { applyToJob, completeApplication };