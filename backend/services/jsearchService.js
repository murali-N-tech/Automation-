const axios = require('axios');

const fetchJobsFromJSearch = async (query = 'software engineer remote') => {
  console.log(`🔍 Fetching jobs from JSearch for: ${query}`);

  if (!process.env.RAPIDAPI_KEY) {
    console.warn('⚠ RAPIDAPI_KEY not set, skipping JSearch fetch.');
    return [];
  }

  const options = {
    method: 'GET',
    url: 'https://jsearch.p.rapidapi.com/search',
    params: {
      query,
      page: '1',
      num_pages: '2',
      date_posted: 'week',
    },
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
    timeout: 15000,
  };

  try {
    const response = await axios.request(options);
    const jobs = response.data?.data || [];

    return jobs
      .filter(job => job.job_apply_link && job.job_title && job.job_description)
      .map(job => ({
        title: job.job_title,
        // ✅ FIX: company must be an object to match Job schema
        company: {
          name: job.employer_name || 'Unknown Company',
          logoUrl: job.employer_logo || '',
          website: job.employer_website || '',
        },
        url: job.job_apply_link,
        description: (job.job_description || '').slice(0, 3000), // trim huge descriptions
        location: job.job_city
          ? `${job.job_city}${job.job_country ? ', ' + job.job_country : ''}`
          : (job.job_country || 'Remote'),
        remote: job.job_is_remote === true,
        // ✅ FIX: correct field name for Job schema
        salaryRange: job.job_min_salary
          ? `$${job.job_min_salary.toLocaleString()} – $${job.job_max_salary?.toLocaleString() || '?'}`
          : null,
        postedAt: job.job_posted_at_datetime_utc
          ? new Date(job.job_posted_at_datetime_utc)
          : new Date(),
        // Start empty — filled by AI extractor in cron pipeline
        requiredSkills: [],
        source: 'jsearch',
        platform: detectPlatform(job.job_apply_link),
      }));
  } catch (error) {
    console.error('❌ JSearch fetch failed:', error.message);
    return [];
  }
};

const detectPlatform = (url = '') => {
  if (!url) return 'other';
  if (url.includes('greenhouse.io'))   return 'greenhouse';
  if (url.includes('lever.co'))        return 'lever';
  if (url.includes('myworkday.com') || url.includes('wd3.myworkday')) return 'workday';
  if (url.includes('naukri.com'))      return 'naukri';
  if (url.includes('linkedin.com'))    return 'linkedin';
  return 'other';
};

module.exports = { fetchJobsFromJSearch };