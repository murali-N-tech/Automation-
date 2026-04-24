const puppeteer = require('puppeteer');
const axios = require('axios');

const stripHtml = (value = '') => {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

class JobScraper {
  /**
   * Mock example of a modular scraper.
   * In a real production scenario, you would have multiple methods here
   * (e.g., scrapeLinkedIn, scrapeIndeed, scrapeWellfound) handling different DOM structures.
   */
  async scrapeGenericJobBoard(url, searchKeyword) {
    console.log(`Starting mock scraper for: ${searchKeyword} on ${url}`);

    try {
      // Live source for real job links. This keeps dev velocity while avoiding fake form URLs.
      const { data } = await axios.get('https://remotive.com/api/remote-jobs', {
        params: { search: searchKeyword || 'software engineer' },
        timeout: 15000,
      });

      const liveJobs = (data?.jobs || [])
        .map((job) => ({
          title: job.title,
          company: {
            name: job.company_name,
            website: job.url,
          },
          description: stripHtml(job.description || ''),
          url: job.url,
          location: job.candidate_required_location || 'Remote',
          remote: true,
        }))
        .filter((job) => job.title && job.url && job.description)
        .slice(0, 20);

      if (liveJobs.length > 0) {
        console.log(`Fetched ${liveJobs.length} live jobs from provider.`);
        return liveJobs;
      }
    } catch (error) {
      console.error('Live provider fetch failed:', error.message);
    }

    // Safe fallback if provider is unavailable.
    return [
      {
        title: 'Full Stack Engineer - React/Node',
        company: { name: 'TechNova', website: 'https://jobs.ashbyhq.com/' },
        description: 'Build scalable web products using React, Node.js, and MongoDB. Experience with AWS and CI/CD is a plus.',
        url: 'https://jobs.ashbyhq.com/',
        location: 'Remote',
        remote: true,
      },
      {
        title: 'Python Backend Developer',
        company: { name: 'DataFleet', website: 'https://jobs.lever.co/' },
        description: 'Develop backend APIs using Python and FastAPI. Strong SQL, Docker, and system design fundamentals required.',
        url: 'https://jobs.lever.co/',
        location: 'Remote',
        remote: true,
      },
    ];
  }
}

module.exports = new JobScraper();
