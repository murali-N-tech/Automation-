/**
 * Hire-Me AI: Smart Apply — Content Script (UPGRADED)
 * Intelligent autofill with advanced selectors + multi-platform support
 */

window.addEventListener('message', async (event) => {
  if (event.source !== window || event.data?.type !== 'START_AUTOFILL') return;

  try {
    const storage = await chrome.storage.local.get(['applyData']);
    const context = storage.applyData;
    if (!context?.profile) return;

    const { profile, coverLetter } = context;

    const nameParts = (profile.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // ================= REACT-SAFE VALUE SETTER =================
    const setNativeValue = (el, value) => {
      if (!el || value === undefined || value === null) return false;
      const strVal = String(value);

      try {
        if (el.isContentEditable) {
          el.innerText = strVal;
        } else {
          const tag = el.tagName.toLowerCase();
          const descriptor =
            tag === 'textarea'
              ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
              : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

          if (descriptor?.set) descriptor.set.call(el, strVal);
          else el.value = strVal;
        }
      } catch {
        el.value = strVal;
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));

      return strVal.length > 0;
    };

    // ================= FIND ELEMENT =================
    const find = (selectors) => {
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el) return el;
        } catch {}
      }
      return null;
    };

    const filled = [];

    // ================= FIELD SELECTORS (UPGRADED) =================
    const selectors = {
      firstName: [
        'input[name*="first" i]', 'input[id*="first" i]', 'input[autocomplete="given-name"]',
        'input[placeholder*="first name" i]', 'input[aria-label*="first name" i]'
      ],
      lastName: [
        'input[name*="last" i]', 'input[id*="last" i]', 'input[autocomplete="family-name"]',
        'input[placeholder*="last name" i]', 'input[aria-label*="last name" i]'
      ],
      fullName: [
        'input[name="name"]', 'input[id="name"]',
        'input[autocomplete="name"]', 'input[placeholder*="full name" i]'
      ],
      email: [
        'input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]',
        'input[aria-label*="email" i]'
      ],
      phone: [
        'input[type="tel"]', 'input[name*="phone" i]', 'input[id*="phone" i]',
        'input[placeholder*="phone" i]', 'input[aria-label*="phone" i]'
      ],
      coverLetter: [
        'textarea[name*="cover" i]', 'textarea[id*="cover" i]',
        'textarea', 'div[contenteditable="true"]'
      ],
      linkedin: [
        'input[name*="linkedin" i]', 'input[id*="linkedin" i]',
        'input[placeholder*="linkedin" i]'
      ]
    };

    // ================= GENERIC FILL =================
    const fieldMap = [
      { key: 'firstName', value: firstName },
      { key: 'lastName', value: lastName },
      { key: 'fullName', value: profile.name },
      { key: 'email', value: profile.email },
      { key: 'phone', value: profile.phone },
      { key: 'coverLetter', value: coverLetter },
      { key: 'linkedin', value: profile.linkedin }
    ];

    for (const field of fieldMap) {
      if (!field.value || !selectors[field.key]) continue;

      const el = find(selectors[field.key]);
      if (el && setNativeValue(el, field.value)) {
        filled.push(field.key);
      }
    }

    // ================= GREENHOUSE SUPPORT =================
    if (document.querySelector('#first_name, .greenhouse-form')) {
      const ghMap = {
        '#first_name': firstName,
        '#last_name': lastName,
        '#email': profile.email,
        '#phone': profile.phone,
        '#cover_letter': coverLetter
      };

      for (const [sel, val] of Object.entries(ghMap)) {
        const el = document.querySelector(sel);
        if (el && val) setNativeValue(el, val);
      }
    }

    // ================= LEVER SUPPORT =================
    if (window.location.hostname.includes('lever.co') || document.querySelector('.lever-app')) {
      const leverMap = {
        '[name="name"]': profile.name,
        '[name="email"]': profile.email,
        '[name="phone"]': profile.phone,
        '[name="comments"]': coverLetter,
        'textarea.application-question': coverLetter
      };

      for (const [sel, val] of Object.entries(leverMap)) {
        const el = document.querySelector(sel);
        if (el && val) setNativeValue(el, val);
      }
    }

    // ================= WORKDAY SUPPORT =================
    if (
      window.location.hostname.includes('myworkday') ||
      window.location.hostname.includes('wd3.myworkday')
    ) {
      await new Promise((r) => setTimeout(r, 1200));

      const wdInputs = document.querySelectorAll('input[data-automation-id]');
      wdInputs.forEach((input) => {
        const id = input.getAttribute('data-automation-id') || '';

        if (id.includes('firstName') || id.includes('legalName')) setNativeValue(input, firstName);
        if (id.includes('lastName') || id.includes('familyName')) setNativeValue(input, lastName);
        if (id.includes('email')) setNativeValue(input, profile.email);
        if (id.includes('phone')) setNativeValue(input, profile.phone);
      });
    }

    // ================= SUCCESS UI =================
    if (filled.length > 0) {
      console.log(`✅ Hire-Me AI filled: ${filled.join(', ')}`);

      const banner = document.createElement('div');
      banner.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: #065f46;
        color: white;
        padding: 12px 18px;
        border-radius: 10px;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      `;

      banner.textContent = `✅ Hire-Me AI filled ${filled.length} field(s). Review before submitting.`;
      document.body.appendChild(banner);

      setTimeout(() => banner.remove(), 5000);
    }

  } catch (err) {
    console.error('❌ Hire-Me AI autofill error:', err);
  }
});