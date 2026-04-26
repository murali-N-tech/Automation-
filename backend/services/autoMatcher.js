/**
 * Hire-Me AI: AutoMatcher V2 (FINAL)
 * Hybrid AI + Heuristic Scoring Engine
 */

const User        = require('../models/User');
const Job         = require('../models/Job');
const Application = require('../models/Application');
const Resume      = require('../models/Resume');
const axios       = require('axios');
const llmService  = require('./llmService');

const AI_SERVICE  = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ================= SKILL EXTRACTION =================
async function ensureSkills(job) {
  if (job.requiredSkills && job.requiredSkills.length > 0) return job;

  try {
    const res = await axios.post(
      `${AI_SERVICE}/matcher/extract-job-skills`,
      { description: job.description || '' },
      { timeout: 10000 }
    );

    const skills = res.data?.required_skills || [];

    if (skills.length > 0) {
      job.requiredSkills = skills;
      await Job.findByIdAndUpdate(job._id, { requiredSkills: skills });
    }
  } catch (err) {
    console.warn(`⚠ Skill extraction failed for "${job.title}":`, err.message);
  }

  return job;
}

// ================= V2 SCORING ENGINE =================
const calculateSalaryScore = (salary) => {
  if (!salary) return 50;

  if (salary >= 1500000) return 100;
  if (salary >= 1000000) return 80;
  if (salary >= 600000)  return 60;
  return 40;
};

const calculateCompanyScore = (company) => {
  if (!company) return 50;

  const compName = typeof company === 'string'
    ? company.toLowerCase()
    : (company.name || '').toLowerCase();

  const topTier = [
    'google', 'amazon', 'microsoft', 'meta',
    'apple', 'netflix', 'adobe', 'atlassian', 'uber'
  ];

  if (topTier.some(t => compName.includes(t))) return 100;
  if (compName.length > 0) return 70;

  return 50;
};

const calculateRecencyScore = (dateString) => {
  if (!dateString) return 50;

  const jobDate = new Date(dateString);
  const today = new Date();

  const diffDays = Math.ceil(Math.abs(today - jobDate) / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) return 100;
  if (diffDays <= 3) return 90;
  if (diffDays <= 7) return 70;
  if (diffDays <= 14) return 50;
  if (diffDays <= 30) return 30;

  return 10;
};

// ================= MAIN CLASS =================
class AutoMatcher {

  /**
   * Nightly AI Matching Engine (Cron Job)
   */
  async runNightlyMatching() {
    console.log('🤖 Starting V2 AI MatchMaker...');

    try {
      const users = await User.find({}).lean();

      for (const user of users) {

        // ===== STEP 0: GET RESUME =====
        const resume = await Resume.findOne({ userId: user._id })
          .sort({ createdAt: -1 });

        if (!resume?.parsedData?.skills?.length) {
          console.log(`⚠ ${user.email}: No resume skills.`);
          continue;
        }

        const userSkills = resume.parsedData.skills;

        // ===== STEP 1: FILTER APPLIED JOBS =====
        const existingApps = await Application
          .find({ userId: user._id })
          .select('jobId')
          .lean();

        const appliedJobIds = existingApps.map(a => a.jobId.toString());

        const unseenJobs = await Job.find({
          _id: { $nin: appliedJobIds }
        });

        let newMatches = 0;

        for (const job of unseenJobs) {
          try {

            // ===== STEP 2: ENSURE SKILLS =====
            await ensureSkills(job);

            if (!job.requiredSkills || job.requiredSkills.length === 0) {
              console.log(`⏭ Skipping "${job.title}" — no skills.`);
              continue;
            }

            // ===== STEP 3: AI ATS SCORE =====
            const matchRes = await axios.post(
              `${AI_SERVICE}/matcher/score-job`,
              {
                resume_skills: userSkills,
                job_skills: job.requiredSkills
              },
              { timeout: 10000 }
            );

            const { ats_score, missing_keywords } = matchRes.data;

            // ===== STEP 4: COMPOSITE SCORE =====
            const aiScore       = Number(ats_score) || 0;
            const salaryScore   = calculateSalaryScore(job.salary);
            const companyScore  = calculateCompanyScore(job.company);
            const recencyScore  = calculateRecencyScore(job.postedAt || job.createdAt);

            const finalScore =
              (0.5 * aiScore) +
              (0.2 * salaryScore) +
              (0.2 * companyScore) +
              (0.1 * recencyScore);

            // ===== STEP 5: FILTER LOW QUALITY =====
            if (finalScore < 60) continue;

            const isTopMatch = finalScore >= 75;

            // ===== STEP 6: GENERATE COVER LETTER =====
            let generatedLetter = '';

            if (isTopMatch) {
              try {
                const companyName = typeof job.company === 'string'
                  ? job.company
                  : (job.company?.name || 'the company');

                generatedLetter = await llmService.generateCoverLetter(
                  job.title || 'Software Engineer',
                  companyName,
                  userSkills
                );

              } catch (llmErr) {
                console.error(`❌ LLM error for "${job.title}":`, llmErr.message);
              }
            }

            // ===== STEP 7: UPSERT APPLICATION =====
            await Application.findOneAndUpdate(
              { userId: user._id, jobId: job._id },
              {
                $setOnInsert: {
                  userId: user._id,
                  resumeId: resume._id,
                  jobId: job._id,
                  atsScore: Math.round(finalScore),
                  decision: isTopMatch ? 'Apply' : 'Improve',
                  missingKeywords: missing_keywords || [],
                  status: isTopMatch ? 'Ready to Apply' : 'Saved',
                  coverLetter: generatedLetter
                }
              },
              { upsert: true }
            );

            newMatches++;

          } catch (err) {
            if (err.code !== 11000) {
              console.error(`❌ Job "${job.title}" failed:`, err.message);
            }
          }
        }

        console.log(`✅ ${user.email}: ${newMatches} matches added.`);
      }

      console.log('🎉 V2 Matching Completed.');

    } catch (err) {
      console.error('❌ Matching engine failed:', err.message);
    }
  }
}

module.exports = new AutoMatcher();
