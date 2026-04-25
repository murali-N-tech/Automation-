const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Resume = require('../models/Resume');
const axios = require('axios');

// ✅ NEW: LLM Service (Gemma / OpenAI / etc.)
const llmService = require('./llmService');

class AutoMatcher {
  /**
   * Autonomously matches all unseen jobs for all users.
   * Runs via cron job.
   */
  async runNightlyMatching() {
    console.log('🤖 Starting automated nightly AI matching for all users...');

    try {
      // 1. Get all users
      const users = await User.find({});

      for (const user of users) {

        // 2. Get latest resume
        const resume = await Resume.findOne({ userId: user._id })
          .sort({ createdAt: -1 });

        if (!resume || !resume.parsedData || !resume.parsedData.skills) {
          continue;
        }

        const userSkills = resume.parsedData.skills;

        // 3. Get already applied jobs
        const appliedJobs = await Application.find({ userId: user._id })
          .select('jobId');

        const appliedJobIds = appliedJobs.map(app => app.jobId);

        // 4. Get unseen jobs
        const unseenJobs = await Job.find({
          _id: { $nin: appliedJobIds }
        });

        let newMatchesCount = 0;

        // 5. Process each job
        for (const job of unseenJobs) {
          try {

            // ===== STEP 1: AI SCORE (FastAPI) =====
            const matchRes = await axios.post(
              'http://localhost:8000/matcher/score-job',
              {
                resume_skills: userSkills,
                job_skills: job.requiredSkills || []
              }
            );

            const { ats_score, missing_keywords, recommendation } = matchRes.data;

            // ===== STEP 2: FILTER LOW QUALITY =====
            if (ats_score >= 40) {

              let generatedLetter = "";
              const isTopMatch = ats_score >= 75;

              // ===== STEP 3: LLM COVER LETTER =====
              if (isTopMatch) {
                try {
                  generatedLetter = await llmService.generateCoverLetter(
                    job.title || 'Software Engineer',
                    job.company?.name || 'the company',
                    userSkills
                  );
                } catch (llmErr) {
                  console.error(
                    `❌ LLM cover letter failed for job ${job._id}:`,
                    llmErr.message
                  );
                }
              }

              // ===== STEP 4: SAVE APPLICATION =====
              const application = new Application({
                userId: user._id,
                resumeId: resume._id,
                jobId: job._id,
                atsScore: ats_score,
                decision: recommendation,
                missingKeywords: missing_keywords,
                status: isTopMatch ? 'Ready to Apply' : 'Saved',
                coverLetter: generatedLetter // ⭐ Real LLM output
              });

              await application.save();
              newMatchesCount++;
            }

          } catch (err) {
            console.error(
              `❌ AI scoring error for job ${job._id}:`,
              err.message
            );
          }
        }

        console.log(
          `✅ Processed user ${user.email}: ${newMatchesCount} new matches generated.`
        );
      }

      console.log('🎉 Automated matching cycle complete.');

    } catch (error) {
      console.error('❌ Failed to run autonomous matching engine:', error);
    }
  }
}

module.exports = new AutoMatcher();