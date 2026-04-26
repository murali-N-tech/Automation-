const puppeteer = require('puppeteer');
const axios = require('axios');

const stripHtml = (value = '') => {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

class JobScraper {
  constructor() {
    // Keywords specifically helpful for students
    this.studentKeywords = [
      'intern',
      'internship',
      'entry level',
      'junior',
      'new grad',
      'student'
    ];
  }

  /**
   * Main method to trigger all free scrapers concurrently.
   */
  async fetchAllFreeJobs(searchKeyword = 'software engineer') {
    console.log(`🚀 Starting Job Scraper for: ${searchKeyword}`);

    const requestedPage = Number.parseInt(process.env.THE_MUSE_PAGE || '', 10);
    const startPage = Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : Math.floor(Math.random() * 5) + 1;

    const musePages = [startPage, startPage + 1, startPage + 2];
    const results = await Promise.allSettled([
      ...musePages.map((page) => this.fetchFromTheMuse(searchKeyword, page)),
      this.fetchFromArbeitnow(searchKeyword)
    ]);

    let allJobs = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allJobs = [...allJobs, ...result.value];
      } else {
        console.error('❌ A scraper failed:', result.reason);
      }
    });

    // Filter student-friendly jobs
    const studentJobs = this.filterForStudents(allJobs);

    console.log(
      `📊 Total jobs fetched: ${allJobs.length}, Student matches: ${studentJobs.length}`
    );

    return studentJobs.length > 0 ? studentJobs : allJobs;
  }

  // --- FREE API 1: The Muse ---
  async fetchFromTheMuse(searchKeyword, page = 1) {
    try {
      const { data } = await axios.get(
        'https://www.themuse.com/api/public/jobs',
        {
          params: {
            category: searchKeyword || 'Software Engineer',
            page
          },
          timeout: 10000
        }
      );

      return (data?.results || []).map((job) => ({
        title: job.name,
        company: {
          name: job.company.name,
          website: job.refs.landing_page
        },
        description: stripHtml(job.contents),
        url: job.refs.landing_page,
        location: job.locations[0]?.name || 'Flexible',
        source: 'The Muse',
        remote:
          job.locations[0]?.name
            ?.toLowerCase()
            .includes('remote') || false
      }));
    } catch (error) {
      console.error('❌ The Muse fetch failed:', error.message);
      return [];
    }
  }

  // --- FREE API 2: Arbeitnow ---
  async fetchFromArbeitnow(searchKeyword) {
    try {
      const { data } = await axios.get(
        'https://www.arbeitnow.com/api/job-board-api',
        {
          params: searchKeyword ? { search: searchKeyword } : undefined,
          timeout: 10000
        }
      );

      return (data?.data || []).map((job) => ({
        title: job.title,
        company: {
          name: job.company_name,
          website: job.url
        },
        description: stripHtml(job.description),
        url: job.url,
        location: job.location || 'Remote',
        source: 'Arbeitnow',
        remote: job.remote
      }));
    } catch (error) {
      console.error('❌ Arbeitnow fetch failed:', error.message);
      return [];
    }
  }

  // --- FILTER: Student Roles ---
  filterForStudents(jobs) {
    return jobs.filter((job) => {
      const lowerTitle = job.title.toLowerCase();
      return this.studentKeywords.some((keyword) =>
        lowerTitle.includes(keyword)
      );
    });
  }

  // --- FUTURE: Puppeteer Scraper ---
  async scrapeWithPuppeteer(url) {
    console.log(`🤖 Starting Puppeteer for ${url}...`);

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // Example placeholder
    // await page.goto(url);
    // const titles = await page.$$eval('.job-title', nodes => nodes.map(n => n.innerText));

    await browser.close();
    return [];
  }
}

module.exports = new JobScraper();