const puppeteer = require('puppeteer');
const path = require('path');

// Mock structure for "Smart Apply Assistant" using Puppeteer
class SmartApplyAssistant {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      // Create non-headless browser to allow "Human in the loop"
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
      });
    }
  }

  async autofillApplication(jobUrl, userProfile, resumePath) {
    await this.initBrowser();
    const page = await this.browser.newPage();

    try {
      console.log(`Navigating to ${jobUrl}...`);
      await page.goto(jobUrl, { waitUntil: 'networkidle2' });

      // Example Template-based automation:
      // Here, we would have logic tailored to specific job boards (e.g. Workday, Greenhouse, Ashby)
      // We search for common form fields by name, placeholder, or label.

      console.log('Attempting to fill basic form fields...');
      
      // First Name or Full Name
      const nameSelectors = ['input[name*="name" i]', 'input[id*="name" i]'];
      for (const selector of nameSelectors) {
         if (await page.$(selector)) {
             await page.type(selector, userProfile.name);
             break;
         }
      }

      // Email
      const emailSelectors = ['input[type="email"]', 'input[name*="email" i]'];
      for (const selector of emailSelectors) {
         if (await page.$(selector)) {
             await page.type(selector, userProfile.email);
             break;
         }
      }

      // Phone
      const phoneSelectors = ['input[type="tel"]', 'input[name*="phone" i]'];
      for (const selector of phoneSelectors) {
         if (await page.$(selector)) {
             await page.type(selector, userProfile.phone || '555-555-5555');
             break;
         }
      }

      // Resume Upload handling (Mock path injection for demonstration)
      // const uploadSelectors = ['input[type="file"]'];
      // if (resumePath) {
      //   for (const selector of uploadSelectors) {
      //     const fileInput = await page.$(selector);
      //     if (fileInput) {
      //         await fileInput.uploadFile(path.resolve(resumePath));
      //         break;
      //     }
      //   }
      // }

      console.log('Autofill complete. Waiting for user review to submit.');

      // Human-in-the-loop: We do NOT click submit automatically. 
      // The user reviews the details, fills out custom CAPTCHAs, and submits manually.
      
      return { success: true, message: 'Application autofilled. Please review and submit in the opened window.' };
    } catch (error) {
      console.error('Error during autofill:', error);
      return { success: false, error: error.message };
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new SmartApplyAssistant();