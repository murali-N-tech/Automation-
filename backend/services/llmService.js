const axios = require('axios');

class LLMService {
  /**
   * Generates a targeted cover letter using Google Gemma 3 via NVIDIA API.
   */
  async generateCoverLetter(jobTitle, companyName, skills) {
    const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
    // Ensure you add NVIDIA_API_KEY to your backend/.env file!
    const apiKey = process.env.NVIDIA_API_KEY; 

    // 1. Create a dynamic prompt using the job and user details
    const topSkills = skills.slice(0, 5).join(', '); // Grab up to 5 skills
    const prompt = `Write a professional, concise cover letter for the ${jobTitle} position at ${companyName}. Highlight my foundational experience in these skills: ${topSkills}. Keep the letter under 200 words and do not include placeholder brackets like [Your Address].`;

    const payload = {
      "model": "google/gemma-3n-e2b-it",
      "messages": [{"role": "user", "content": prompt}],
      "max_tokens": 512,
      "temperature": 0.5, // Slightly higher for a bit more creative writing
      "top_p": 0.70,
      "stream": false // Set to false so we get the whole response at once
    };

    try {
      const response = await axios.post(invokeUrl, payload, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json"
        }
      });
      
      // 2. Extract and return the generated text from the LLM
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error("NVIDIA API Error:", error?.response?.data || error.message);
      return "Failed to generate cover letter.";
    }
  }
}

module.exports = new LLMService();