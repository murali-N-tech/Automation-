const axios = require('axios');

const fetchJobsFromJSearch = async (query = 'software engineer remote') => {
  console.log(`🔍 Fetching jobs from JSearch for: ${query}`);
  
  const options = {
    method: 'GET',
    url: 'https://jsearch.p.rapidapi.com/search',
    params: {
      query: query,
      page: '1',
      num_pages: '1' // Increase pages as needed for more jobs
    },
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
    }
  };

  try {
    const response = await axios.request(options);
    const jobs = response.data.data;
    
    // Normalize data before sending it back
    return jobs.map(job => ({
      title: job.job_title,
      company: job.employer_name,
      url: job.job_apply_link, // standardizing to match your DB
      description: job.job_description,
      location: job.job_city || job.job_country || 'Remote',
      salary: job.job_min_salary ? (job.job_min_salary + job.job_max_salary)/2 : null, // for scoring
      platform: detectPlatform(job.job_apply_link),
      source: 'jsearch',
      postedAt: job.job_posted_at_datetime_utc
    }));
  } catch (error) {
    console.error('❌ Error fetching from JSearch:', error.message);
    return [];
  }
};

// Helper to detect ATS platform for the queue limit
const detectPlatform = (url) => {
  if (!url) return 'unknown';
  if (url.includes('greenhouse.io')) return 'greenhouse';
  if (url.includes('lever.co')) return 'lever';
  if (url.includes('workday.com')) return 'workday';
  return 'other';
};

module.exports = { fetchJobsFromJSearch };