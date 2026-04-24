const puppeteer = require('puppeteer');
const path = require('path');

// Mock structure for "Smart Apply Assistant" using Puppeteer
class SmartApplyAssistant {
  constructor() {
    this.browser = null;
    this.idleCloseTimer = null;
    this.idleCloseMs = Number(process.env.AUTOMATOR_IDLE_CLOSE_MS || 15 * 60 * 1000);
  }

  scheduleBrowserClose() {
    if (this.idleCloseTimer) {
      clearTimeout(this.idleCloseTimer);
    }

    this.idleCloseTimer = setTimeout(async () => {
      try {
        await this.closeBrowser();
      } catch (err) {
        console.error('Auto-close browser failed:', err.message);
      }
    }, this.idleCloseMs);
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

    this.scheduleBrowserClose();
  }

  async autofillApplication(jobUrl, userProfile, resumePath) {
    await this.initBrowser();
    const page = await this.browser.newPage();
    const filledFields = [];
    const warnings = [];

    const typeIntoFirstMatch = async (selectors, value, label) => {
      for (const selector of selectors) {
        const input = await page.$(selector);
        if (!input) continue;

        await input.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await input.type(value);
        filledFields.push(label);
        return true;
      }

      return false;
    };

    try {
      console.log(`Navigating to ${jobUrl}...`);
      try {
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (navigationError) {
        warnings.push(`Navigation warning: ${navigationError.message}`);
      }

      // Example Template-based automation:
      // Here, we would have logic tailored to specific job boards (e.g. Workday, Greenhouse, Ashby)
      // We search for common form fields by name, placeholder, or label.

      console.log('Attempting to fill basic form fields...');
      
      // First Name or Full Name
      const nameSelectors = ['input[name*="name" i]', 'input[id*="name" i]'];
        await typeIntoFirstMatch(nameSelectors, userProfile.name, 'name');

      // Email
      const emailSelectors = ['input[type="email"]', 'input[name*="email" i]'];
        await typeIntoFirstMatch(emailSelectors, userProfile.email, 'email');

      // Phone
      const phoneSelectors = ['input[type="tel"]', 'input[name*="phone" i]'];
        await typeIntoFirstMatch(phoneSelectors, userProfile.phone || '555-555-5555', 'phone');

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
      
      return {
        success: true,
        message: warnings.length
          ? 'Application window opened in manual mode. Please review and complete the form manually.'
          : 'Application autofilled. Please review and submit in the opened window.',
        filledFields,
        warnings,
      };
    } catch (error) {
      try {
        await page.close();
      } catch {
        // Ignore close errors on failed page creation/navigation
      }
      console.error('Error during autofill:', error);
      return { success: false, error: error.message };
    }
  }

  async closeBrowser() {
    if (this.idleCloseTimer) {
      clearTimeout(this.idleCloseTimer);
      this.idleCloseTimer = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new SmartApplyAssistant();