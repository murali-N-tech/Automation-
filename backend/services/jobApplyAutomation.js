const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'uploads', 'automation');
const DEFAULT_NAV_TIMEOUT = Number(process.env.AUTO_APPLY_TIMEOUT_MS || 45000);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function detectPlatform(url = '') {
  const value = String(url || '').toLowerCase();

  if (value.includes('greenhouse.io')) return 'greenhouse';
  if (value.includes('lever.co')) return 'lever';
  if (value.includes('myworkdayjobs.com') || value.includes('workday.com')) return 'workday';
  if (value.includes('linkedin.com')) return 'linkedin';
  if (value.includes('indeed.com')) return 'indeed';
  return 'other';
}

function splitName(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || parts[0]
  };
}

function normalizeUrl(url = '') {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function parseOptionalBooleanEnv(name) {
  const value = process.env[name];
  if (value === undefined) return undefined;
  return ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase());
}

function parseDurationYears(duration = '') {
  const lower = String(duration || '').toLowerCase();
  if (!lower) return 0;

  let total = 0;
  const yearsMatch = lower.match(/(\d+(?:\.\d+)?)\s*\+?\s*(year|yr)/);
  const monthsMatch = lower.match(/(\d+(?:\.\d+)?)\s*(month|mo)/);

  if (yearsMatch) {
    total += Number(yearsMatch[1]) || 0;
  }

  if (monthsMatch) {
    total += (Number(monthsMatch[1]) || 0) / 12;
  }

  return total;
}

function estimateExperienceYears(experience = []) {
  if (!Array.isArray(experience) || experience.length === 0) {
    return 0;
  }

  const parsedTotal = experience.reduce((sum, item) => {
    return sum + parseDurationYears(item?.duration);
  }, 0);

  if (parsedTotal > 0) {
    return Math.max(1, Math.round(parsedTotal));
  }

  return experience.length;
}

function splitLocationParts(location = '') {
  const parts = String(location || '').split(',').map((part) => part.trim()).filter(Boolean);
  return {
    city: parts[0] || '',
    country: parts[parts.length - 1] || '',
    full: String(location || '').trim()
  };
}

function buildProfile({ user, resume, application, job }) {
  const parsed = resume?.parsedData || {};
  const fullName = parsed.name || user?.name || '';
  const { firstName, lastName } = splitName(fullName);
  const summary = parsed.summary || application?.coverLetter || '';
  const experienceYears = estimateExperienceYears(parsed.experience || []);
  const locationParts = splitLocationParts(parsed.location || '');

  return {
    fullName,
    firstName,
    lastName,
    email: parsed.email || user?.email || '',
    phone: parsed.phone || '',
    location: locationParts.full,
    city: locationParts.city,
    country: locationParts.country,
    linkedin: normalizeUrl(parsed.linkedin || ''),
    github: normalizeUrl(parsed.github || ''),
    portfolio: normalizeUrl(parsed.portfolio || ''),
    summary,
    coverLetter: application?.coverLetter || summary,
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    resumePath: resume?.rawFileUrl || '',
    jobTitle: job?.title || '',
    companyName: job?.company?.name || '',
    yearsOfExperience: experienceYears,
    answers: {
      workAuthorized: parseOptionalBooleanEnv('AUTO_APPLY_WORK_AUTHORIZED'),
      needsSponsorship: parseOptionalBooleanEnv('AUTO_APPLY_REQUIRE_SPONSORSHIP'),
      willingToRelocate: parseOptionalBooleanEnv('AUTO_APPLY_WILLING_TO_RELOCATE'),
      willingToRemote: parseOptionalBooleanEnv('AUTO_APPLY_WILLING_TO_WORK_REMOTE'),
      noticePeriod: process.env.AUTO_APPLY_NOTICE_PERIOD || '',
      currentCtc: process.env.AUTO_APPLY_CURRENT_CTC || '',
      expectedCtc: process.env.AUTO_APPLY_EXPECTED_CTC || '',
      currentCompany: process.env.AUTO_APPLY_CURRENT_COMPANY || '',
      linkedIn: normalizeUrl(parsed.linkedin || ''),
      github: normalizeUrl(parsed.github || ''),
      portfolio: normalizeUrl(parsed.portfolio || '')
    }
  };
}

async function launchBrowser({ headless } = {}) {
  return puppeteer.launch({
    headless: headless !== false,
    defaultViewport: { width: 1440, height: 1200 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gotoApplicationPage(page, url) {
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: DEFAULT_NAV_TIMEOUT
  });
  await wait(1500);
}

async function waitForPageSettled(page, delayMs = 2500) {
  await Promise.race([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null),
    wait(delayMs)
  ]);
}

async function openApplyEntryPoint(page) {
  const directApplyUrl = await page.evaluate(() => {
    const normalize = (value = '') => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const badMatches = ['linkedin', 'indeed', 'google', 'facebook', 'sign in', 'log in', 'login'];
    const goodMatches = ['apply', 'apply now', 'easy apply', 'submit application', 'start application'];

    const anchor = Array.from(document.querySelectorAll('a[href]')).find((node) => {
      const text = normalize(node.innerText || node.getAttribute('aria-label') || '');
      const href = normalize(node.href || '');
      if (!text && !href) return false;
      const good = goodMatches.some((item) => text.includes(item) || href.includes(item));
      const bad = badMatches.some((item) => text.includes(item) || href.includes(item));
      return good && !bad;
    });

    return anchor?.href || '';
  });

  if (directApplyUrl && directApplyUrl !== page.url()) {
    await page.goto(directApplyUrl, {
      waitUntil: 'domcontentloaded',
      timeout: DEFAULT_NAV_TIMEOUT
    }).catch(() => {});
    await wait(1500);
    return true;
  }

  const clickedButton = await page.evaluate(() => {
    const normalize = (value = '') => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const badMatches = ['linkedin', 'indeed', 'google', 'facebook', 'sign in', 'log in', 'login'];
    const goodMatches = ['apply', 'apply now', 'easy apply', 'submit application', 'start application'];

    const candidate = Array.from(document.querySelectorAll('button, [role="button"]')).find((node) => {
      const text = normalize(node.innerText || node.getAttribute('aria-label') || '');
      const good = goodMatches.some((item) => text.includes(item));
      const bad = badMatches.some((item) => text.includes(item));
      if (!good || bad || node.disabled) return false;
      const style = window.getComputedStyle(node);
      return style.visibility !== 'hidden' && style.display !== 'none';
    });

    if (!candidate) return false;
    candidate.click();
    return true;
  });

  if (clickedButton) {
    await waitForPageSettled(page);
    return true;
  }

  return false;
}

async function uploadResume(page, resumePath) {
  if (!resumePath || !fs.existsSync(resumePath)) {
    return false;
  }

  const selectors = [
    'input[type="file"]',
    'input[name*="resume" i]',
    'input[id*="resume" i]',
    'input[name*="cv" i]',
    'input[id*="cv" i]',
    'input[name*="attachment" i]',
    'input[id*="attachment" i]'
  ];

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (!input) continue;

    try {
      await input.uploadFile(resumePath);
      await wait(1200);
      return true;
    } catch (_err) {
      // Try the next file input.
    }
  }

  return false;
}

async function smartFillVisibleFields(page, profile) {
  return page.evaluate((profileData) => {
    const normalize = (value = '') => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const boolToWord = (value) => value === true ? 'yes' : (value === false ? 'no' : '');

    const baseAnswers = [
      { keys: ['first name', 'given name', 'fname'], value: profileData.firstName },
      { keys: ['last name', 'surname', 'family name', 'lname'], value: profileData.lastName },
      { keys: ['full name', 'your name', 'candidate name'], value: profileData.fullName },
      { keys: ['email', 'email address'], value: profileData.email },
      { keys: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number'], value: profileData.phone },
      { keys: ['location', 'current location', 'address'], value: profileData.location },
      { keys: ['city'], value: profileData.city },
      { keys: ['country'], value: profileData.country },
      { keys: ['linkedin'], value: profileData.linkedin },
      { keys: ['github'], value: profileData.github },
      { keys: ['portfolio', 'website', 'personal site', 'url'], value: profileData.portfolio },
      { keys: ['cover letter', 'why are you interested', 'why do you want this job'], value: profileData.coverLetter },
      { keys: ['summary', 'about you', 'about yourself', 'professional summary'], value: profileData.summary },
      { keys: ['current company', 'current employer'], value: profileData.answers.currentCompany || '' },
      { keys: ['notice period', 'joining period', 'availability'], value: profileData.answers.noticePeriod || '' },
      { keys: ['current ctc', 'current salary', 'current compensation'], value: profileData.answers.currentCtc || '' },
      { keys: ['expected ctc', 'expected salary', 'salary expectation', 'salary expectations', 'expected compensation'], value: profileData.answers.expectedCtc || '' },
      { keys: ['years of experience', 'total experience', 'experience in years'], value: profileData.yearsOfExperience ? String(profileData.yearsOfExperience) : '' },
      { keys: ['work authorization', 'authorized to work', 'legally authorized'], value: boolToWord(profileData.answers.workAuthorized) },
      { keys: ['require sponsorship', 'need sponsorship', 'visa sponsorship'], value: boolToWord(profileData.answers.needsSponsorship) },
      { keys: ['relocate', 'willing to relocate'], value: boolToWord(profileData.answers.willingToRelocate) },
      { keys: ['remote', 'work remotely'], value: boolToWord(profileData.answers.willingToRemote) }
    ].filter((item) => item.value !== undefined && item.value !== null && String(item.value).trim() !== '');

    const describe = (element) => {
      const texts = [
        element.name,
        element.id,
        element.placeholder,
        element.getAttribute('aria-label'),
        element.getAttribute('data-qa'),
        element.getAttribute('data-testid'),
        element.getAttribute('autocomplete')
      ];

      if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) texts.push(label.innerText);
      }

      const nearestLabel = element.closest('label');
      if (nearestLabel) texts.push(nearestLabel.innerText);

      const wrapper = element.closest('[data-qa], [data-testid], .field, .form-field, .question') || element.parentElement;
      if (wrapper) {
        const heading = wrapper.querySelector('label, legend, .label, .question, .field-label');
        if (heading) texts.push(heading.innerText);
      }

      return normalize(texts.filter(Boolean).join(' '));
    };

    const matchAnswer = (descriptor) => {
      if (!descriptor) return null;
      return baseAnswers.find((item) => item.keys.some((key) => descriptor.includes(key)));
    };

    const fillTextLike = (element, value) => {
      element.focus();
      element.value = String(value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const chooseSelectValue = (element, value) => {
      const expected = normalize(value);
      if (!expected) return false;

      const options = Array.from(element.options || []);
      const exact = options.find((option) => {
        const text = normalize(`${option.label} ${option.text} ${option.value}`);
        return text === expected;
      });

      const partial = exact || options.find((option) => {
        const text = normalize(`${option.label} ${option.text} ${option.value}`);
        return text.includes(expected);
      });

      if (!partial) return false;

      element.value = partial.value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };

    const yesNoMatcher = (descriptor) => {
      const token = normalize(descriptor);
      if (!token) return '';

      const getWord = (boolValue) => boolToWord(boolValue);

      if (token.includes('work authorization') || token.includes('authorized to work') || token.includes('legally authorized')) {
        return getWord(profileData.answers.workAuthorized);
      }

      if (token.includes('sponsorship') || token.includes('visa')) {
        return getWord(profileData.answers.needsSponsorship);
      }

      if (token.includes('relocate')) {
        return getWord(profileData.answers.willingToRelocate);
      }

      if (token.includes('remote')) {
        return getWord(profileData.answers.willingToRemote);
      }

      return '';
    };

    const filled = [];
    const selects = Array.from(document.querySelectorAll('select'));
    const textLike = Array.from(document.querySelectorAll('input, textarea'));

    for (const element of textLike) {
      if (element.disabled || element.readOnly) continue;

      const type = normalize(element.getAttribute('type') || '');
      if (['hidden', 'submit', 'button', 'file'].includes(type)) continue;

      const descriptor = describe(element);

      if (type === 'checkbox') {
        if (
          descriptor.includes('privacy') ||
          descriptor.includes('terms') ||
          descriptor.includes('consent') ||
          descriptor.includes('data processing') ||
          descriptor.includes('acknowledg')
        ) {
          if (!element.checked) {
            element.click();
            filled.push(descriptor || 'checkbox');
          }
        }
        continue;
      }

      if (type === 'radio') {
        const answer = yesNoMatcher(descriptor);
        if (!answer) continue;

        const radioLabel = normalize(
          (element.value || '') +
          ' ' +
          (element.closest('label')?.innerText || '') +
          ' ' +
          (element.getAttribute('aria-label') || '')
        );

        const wantsYes = answer === 'yes';
        const shouldClick =
          (wantsYes && (radioLabel.includes('yes') || radioLabel.includes('authorized') || radioLabel.includes('accept'))) ||
          (!wantsYes && (radioLabel.includes('no') || radioLabel.includes('not')))
;

        if (shouldClick && !element.checked) {
          element.click();
          filled.push(descriptor || 'radio');
        }
        continue;
      }

      const answer = matchAnswer(descriptor);
      if (!answer) continue;

      if (element.tagName.toLowerCase() === 'textarea') {
        fillTextLike(element, answer.value);
        filled.push(descriptor || 'textarea');
        continue;
      }

      if (['email', 'tel', 'text', 'search', 'url', 'number'].includes(type) || !type) {
        fillTextLike(element, answer.value);
        filled.push(descriptor || 'input');
      }
    }

    for (const element of selects) {
      if (element.disabled) continue;
      const descriptor = describe(element);

      const directAnswer = matchAnswer(descriptor);
      const yesNoAnswer = yesNoMatcher(descriptor);
      const value = directAnswer?.value || yesNoAnswer;
      if (!value) continue;

      const changed = chooseSelectValue(element, value);
      if (changed) {
        filled.push(descriptor || 'select');
      }
    }

    return {
      filledFields: Array.from(new Set(filled))
    };
  }, profile);
}

async function fillCommonFields(page, profile) {
  const smartFill = await smartFillVisibleFields(page, profile);
  const uploadedResume = await uploadResume(page, profile.resumePath);

  return {
    uploadedResume,
    filledFields: smartFill.filledFields || []
  };
}

async function clickPrimaryAction(page, groups) {
  return page.evaluate((patternGroups) => {
    const normalize = (value = '') => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"], a[href]'));

    const isVisible = (node) => {
      const style = window.getComputedStyle(node);
      return style.visibility !== 'hidden' && style.display !== 'none';
    };

    for (const parts of patternGroups) {
      const regex = new RegExp(parts.join('|'), 'i');
      const candidate = buttons.find((node) => {
        const text = normalize(node.innerText || node.value || node.getAttribute('aria-label') || '');
        if (!text || !isVisible(node) || node.disabled) return false;

        if (text.includes('linkedin') || text.includes('indeed') || text.includes('google') || text.includes('facebook')) {
          return false;
        }

        return regex.test(text);
      });

      if (!candidate) continue;

      candidate.click();
      return { clicked: true, label: normalize(candidate.innerText || candidate.value || candidate.getAttribute('aria-label') || '') };
    }

    return { clicked: false, label: '' };
  }, groups);
}

async function detectPageState(page) {
  const text = await page.evaluate(() => document.body?.innerText || '');
  const lower = text.toLowerCase();

  if (
    lower.includes('captcha') ||
    lower.includes('verify you are human') ||
    lower.includes('cloudflare') ||
    lower.includes('bot detection')
  ) {
    return {
      blocked: true,
      requiresManualAction: true,
      reason: 'Captcha or bot protection detected.'
    };
  }

  if (
    lower.includes('sign in to apply') ||
    lower.includes('login to apply') ||
    lower.includes('log in to continue') ||
    lower.includes('create an account') ||
    lower.includes('sign in or create account')
  ) {
    return {
      blocked: true,
      requiresManualAction: true,
      reason: 'This portal requires login or account creation.'
    };
  }

  if (
    lower.includes('application submitted') ||
    lower.includes('thank you for applying') ||
    lower.includes('we have received your application') ||
    lower.includes('your application has been submitted') ||
    lower.includes('application received')
  ) {
    return {
      blocked: false,
      submitted: true,
      requiresManualAction: false,
      reason: 'Application submission confirmed by the portal.'
    };
  }

  return {
    blocked: false,
    submitted: false,
    requiresManualAction: false,
    reason: ''
  };
}

async function collectValidationErrors(page) {
  return page.evaluate(() => {
    const selectors = [
      '[aria-invalid="true"]',
      '.error',
      '.errors',
      '.field-error',
      '.invalid-feedback',
      '[data-testid*="error"]',
      '[class*="error"]'
    ];

    const messages = new Set();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const text = (node.innerText || node.textContent || '').trim();
        if (text && text.length <= 300) {
          messages.add(text);
        }
      });
    }

    return Array.from(messages).slice(0, 10);
  });
}

async function captureScreenshot(page, applicationId) {
  ensureDir(SCREENSHOT_DIR);
  const fileName = `${applicationId || 'application'}_${Date.now()}.png`;
  const targetPath = path.join(SCREENSHOT_DIR, fileName);
  await page.screenshot({ path: targetPath, fullPage: true }).catch(() => {});
  return targetPath;
}

async function prepareForm(page, profile) {
  await page.waitForSelector('form, input, textarea, button, select', { timeout: 15000 }).catch(() => {});
  return fillCommonFields(page, profile);
}

async function advanceWorkflow(page, { finalSubmit, maxSteps = 5 }) {
  const transitions = [];

  if (finalSubmit === false) {
    return {
      transitions,
      state: await detectPageState(page)
    };
  }

  for (let step = 0; step < maxSteps; step += 1) {
    const state = await detectPageState(page);
    if (state.blocked || state.submitted) {
      return { transitions, state };
    }

    const action = await clickPrimaryAction(page, [
      ['submit', 'apply', 'send application', 'finish application'],
      ['review', 'next', 'continue', 'proceed']
    ]);

    if (!action.clicked) {
      return { transitions, state };
    }

    transitions.push(action.label || `step-${step + 1}`);
    await waitForPageSettled(page);
  }

  return {
    transitions,
    state: await detectPageState(page)
  };
}

async function handleGreenhouse(page, profile, options) {
  await page.waitForSelector('form#application_form, form', { timeout: 15000 }).catch(() => {});
  const filled = await prepareForm(page, profile);
  const workflow = await advanceWorkflow(page, { finalSubmit: options.finalSubmit, maxSteps: 3 });
  return { ...filled, workflow };
}

async function handleLever(page, profile, options) {
  await page.waitForSelector('form', { timeout: 15000 }).catch(() => {});
  const filled = await prepareForm(page, profile);
  const workflow = await advanceWorkflow(page, { finalSubmit: options.finalSubmit, maxSteps: 3 });
  return { ...filled, workflow };
}

async function handleWorkday(page, profile, options) {
  const initialState = await detectPageState(page);
  if (initialState.blocked) {
    return { filledFields: [], uploadedResume: false, workflow: { transitions: [], state: initialState }, earlyState: initialState };
  }

  const filled = await prepareForm(page, profile);
  const workflow = await advanceWorkflow(page, { finalSubmit: options.finalSubmit, maxSteps: 5 });
  return { ...filled, workflow };
}

async function handleGeneric(page, profile, options) {
  const filled = await prepareForm(page, profile);
  const workflow = await advanceWorkflow(page, { finalSubmit: options.finalSubmit, maxSteps: 4 });
  return { ...filled, workflow };
}

class JobApplyAutomationService {
  async apply({ application, user, resume, job, finalSubmit = true, headless = true }) {
    const platform = detectPlatform(job?.url);
    const profile = buildProfile({ user, resume, application, job });

    if (!profile.resumePath || !fs.existsSync(profile.resumePath)) {
      return {
        success: false,
        submitted: false,
        platform,
        requiresManualAction: true,
        reason: 'Stored resume file is missing. Upload the resume again before auto-apply.',
        filledFields: [],
        uploadedResume: false,
        validationErrors: []
      };
    }

    let browser;
    let screenshotPath = '';

    try {
      browser = await launchBrowser({ headless });
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(DEFAULT_NAV_TIMEOUT);
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );

      await gotoApplicationPage(page, job.url);
      await openApplyEntryPoint(page);

      const preState = await detectPageState(page);
      if (preState.blocked) {
        screenshotPath = await captureScreenshot(page, application?._id);
        return {
          success: false,
          submitted: false,
          platform,
          requiresManualAction: preState.requiresManualAction,
          reason: preState.reason,
          screenshotPath,
          currentUrl: page.url(),
          filledFields: [],
          uploadedResume: false,
          validationErrors: []
        };
      }

      let fillResult;
      if (platform === 'greenhouse') {
        fillResult = await handleGreenhouse(page, profile, { finalSubmit });
      } else if (platform === 'lever') {
        fillResult = await handleLever(page, profile, { finalSubmit });
      } else if (platform === 'workday') {
        fillResult = await handleWorkday(page, profile, { finalSubmit });
        if (fillResult.earlyState?.blocked) {
          screenshotPath = await captureScreenshot(page, application?._id);
          return {
            success: false,
            submitted: false,
            platform,
            requiresManualAction: true,
            reason: fillResult.earlyState.reason,
            screenshotPath,
            currentUrl: page.url(),
            filledFields: [],
            uploadedResume: false,
            validationErrors: []
          };
        }
      } else {
        fillResult = await handleGeneric(page, profile, { finalSubmit });
      }

      const workflowState = fillResult.workflow?.state || await detectPageState(page);
      const validationErrors = workflowState.submitted ? [] : await collectValidationErrors(page);

      if (!workflowState.submitted && finalSubmit !== false) {
        screenshotPath = await captureScreenshot(page, application?._id);
      }

      const success = finalSubmit === false
        ? Boolean(fillResult.uploadedResume || fillResult.filledFields.length > 0)
        : Boolean(workflowState.submitted);

      const requiresManualAction = finalSubmit === false
        ? false
        : Boolean(!workflowState.submitted);

      const reason = workflowState.reason ||
        (validationErrors.length
          ? `Portal still needs manual input: ${validationErrors[0]}`
          : (success ? 'Application form prepared successfully.' : 'Portal did not confirm submission.'));

      return {
        success,
        submitted: Boolean(workflowState.submitted),
        platform,
        requiresManualAction,
        reason,
        screenshotPath,
        currentUrl: page.url(),
        filledFields: fillResult.filledFields || [],
        uploadedResume: Boolean(fillResult.uploadedResume),
        validationErrors,
        actionsTaken: fillResult.workflow?.transitions || []
      };
    } catch (err) {
      return {
        success: false,
        submitted: false,
        platform,
        requiresManualAction: true,
        reason: err.message || 'Automation failed unexpectedly.',
        screenshotPath,
        filledFields: [],
        uploadedResume: false,
        validationErrors: []
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }
}

module.exports = {
  detectPlatform,
  buildProfile,
  JobApplyAutomationService,
  jobApplyAutomationService: new JobApplyAutomationService()
};
