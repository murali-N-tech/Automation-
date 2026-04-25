const ATS_MAPPERS = {
  greenhouse: {
    selectors: {
      firstName: ['input#first_name', 'input[name="first_name"]'],
      lastName: ['input#last_name', 'input[name="last_name"]'],
      email: ['input#email', 'input[name="email"]'],
      phone: ['input#phone', 'input[name="phone"]']
    }
  },
  lever: {
    selectors: {
      firstName: ['input[name="name"]'],
      email: ['input[name="email"]', 'input[type="email"]'],
      phone: ['input[name="phone"]', 'input[type="tel"]']
    }
  },
  workday: {
    selectors: {
      firstName: ['input[data-automation-id*="firstName"]'],
      lastName: ['input[data-automation-id*="lastName"]'],
      email: ['input[data-automation-id*="email"]', 'input[type="email"]'],
      phone: ['input[data-automation-id*="phone"]', 'input[type="tel"]']
    }
  }
};

function detectProvider() {
  const host = window.location.hostname;
  if (host.includes('greenhouse')) return 'greenhouse';
  if (host.includes('lever')) return 'lever';
  if (host.includes('workday')) return 'workday';
  return null;
}

function setInputValue(input, value) {
  if (!input || !value) return false;
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function firstMatch(selectors) {
  for (const selector of selectors || []) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

async function loadApplyContext() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apoToken', 'apoApplicationId'], async (data) => {
      const token = data.apoToken;
      const applicationId = data.apoApplicationId;
      if (!token || !applicationId) {
        alert('AI Smart Apply: Missing token or application id in extension popup.');
        return resolve(null);
      }

      try {
        const response = await fetch(`http://localhost:5000/api/apply/context/${applicationId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          alert('AI Smart Apply: Failed to load profile context from backend.');
          return resolve(null);
        }

        resolve(await response.json());
      } catch (err) {
        console.error(err);
        alert('AI Smart Apply: Unable to connect to backend API.');
        resolve(null);
      }
    });
  });
}

async function autofillForm() {
  const provider = detectProvider();
  if (!provider || !ATS_MAPPERS[provider]) return;

  const context = await loadApplyContext();
  if (!context) return;

  const profile = context.profile || {};
  const nameParts = (profile.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ');

  const selectors = ATS_MAPPERS[provider].selectors;
  const filled = [];

  if (setInputValue(firstMatch(selectors.firstName), firstName)) filled.push('first name');
  if (setInputValue(firstMatch(selectors.lastName), lastName)) filled.push('last name');
  if (setInputValue(firstMatch(selectors.email), profile.email || '')) filled.push('email');
  if (setInputValue(firstMatch(selectors.phone), profile.phone || '')) filled.push('phone');

  console.log(`AI Smart Apply: Filled fields (${provider}):`, filled.join(', ') || 'none');
  alert('AI Smart Apply: Form filled. Please review everything and submit manually.');
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'APO_AUTOFILL') {
    autofillForm();
  }
});
