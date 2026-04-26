/**
 * Hire-Me AI: LLM Service (V2)
 * Uses FastAPI AI backend for cover letter generation
 */

const axios = require('axios');

const AI_SERVICE = process.env.AI_SERVICE_URL || 'http://localhost:8000';

class LLMService {

  /**
   * Generate cover letter via Python AI service
   * @param {string} jobTitle
   * @param {string} companyName
   * @param {Array<string>} userSkills
   * @returns {Promise<string>}
   */
  async generateCoverLetter(jobTitle, companyName, userSkills = []) {
    try {
      console.log(`✨ Generating AI cover letter for ${companyName}...`);

      const response = await axios.post(
        `${AI_SERVICE}/matcher/generate-cover-letter`,
        {
          job_title: jobTitle || 'Software Engineer',
          company_name: companyName || 'the company',
          resume_skills: Array.isArray(userSkills) ? userSkills : []
        },
        {
          timeout: 15000
        }
      );

      const letter = response.data?.cover_letter;

      // Basic validation
      if (letter && letter.length > 50) {
        return letter;
      }

      console.warn('⚠ Empty/invalid AI response, using fallback.');
      return this._fallback(jobTitle, companyName, userSkills);

    } catch (error) {
      console.error(
        '❌ AI service error:',
        error?.response?.data || error.message
      );

      return this._fallback(jobTitle, companyName, userSkills);
    }
  }

  /**
   * Fallback cover letter (always safe)
   */
  _fallback(jobTitle, companyName, skills = []) {
    const topSkills = skills.slice(0, 3);
    const skillsStr = topSkills.length
      ? topSkills.join(', ')
      : 'software engineering and problem-solving';

    return `Dear Hiring Manager,

I am writing to express my strong interest in the ${jobTitle} position at ${companyName}. With experience in ${skillsStr}, I am confident in my ability to contribute effectively to your team.

I am eager to apply my skills and continue learning in a challenging environment.

Thank you for your time and consideration.

Sincerely,
Applicant`;
  }
}

module.exports = new LLMService();