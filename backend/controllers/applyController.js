const SmartApplyAssistant = require('../services/automator');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');

const applyToJob = async (req, res) => {
    try {
        const { applicationId, jobId } = req.body;
        // Verify user and job
        const job = await Job.findById(jobId);
        const user = req.user; // Token attached to req by requireAuth

        if (!job || !user) {
             return res.status(404).json({ error: "Job or User not found." });
        }

        // Simulating the user's data structure to fill out the form
        const userProfile = {
            name: user.name || "Test User",
            email: user.email || "test@example.com",
            phone: "555-0100"
        };
        
        let resumePath = null;
        // In real impl, we fetch resume path from the user's associated parsed resume in the DB

        // Trigger Puppeteer logic
        // This will launch Chrome so the user can verify fields manually (Human-in-the-loop)
        const result = await SmartApplyAssistant.autofillApplication(job.url, userProfile, resumePath);

        if (result.success) {
            // Update application status internally after initiating assist
            if (applicationId) {
                 await Application.findByIdAndUpdate(applicationId, { status: "Applied" });
            }

            return res.json({ success: true, message: result.message });
        } else {
            return res.status(500).json({ error: result.error });
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error initiating smart applications." });
    }
};

module.exports = { applyToJob };