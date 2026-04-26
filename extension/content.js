window.addEventListener("message", async (event) => {
  if (event.source !== window || event.data.type !== "START_AUTOFILL") return;

  console.log("🚀 Hire-Me AI: Starting autofill in frame:", window.location.href);

  try {
    const storage = await chrome.storage.local.get(["applyData"]);
    const context = storage.applyData;

    if (!context || !context.profile) return; // Fail silently if no data, prevents spamming all frames

    const profile = context.profile;

    // 👉 NEW: Advanced React Input Setter
    const setInputValue = (el, value) => {
      if (!el || !value) return false;
      
      try {
        // Bypass React's overridden value setter
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        
        if (el.tagName.toLowerCase() === 'textarea') {
            nativeTextAreaValueSetter.call(el, value);
        } else {
            nativeInputValueSetter.call(el, value);
        }
        
        // Dispatch events so the framework registers the change
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      } catch(e) {
        // Fallback for non-React sites
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    };

    const firstMatch = (selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    const selectors = {
      firstName: ['input[name*="first"]', 'input[id*="first"]', 'input[autocomplete="given-name"]'],
      lastName: ['input[name*="last"]', 'input[id*="last"]', 'input[autocomplete="family-name"]'],
      email: ['input[type="email"]', 'input[name*="email"]'],
      phone: ['input[type="tel"]', 'input[name*="phone"]'],
      coverLetter: ['textarea[name*="cover"]', 'textarea[id*="cover"]', 'textarea']
    };

    const nameParts = (profile.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const filled = [];

    if (setInputValue(firstMatch(selectors.firstName), firstName)) filled.push('first name');
    if (setInputValue(firstMatch(selectors.lastName), lastName)) filled.push('last name');
    if (setInputValue(firstMatch(selectors.email), profile.email || '')) filled.push('email');
    if (setInputValue(firstMatch(selectors.phone), profile.phone || '')) filled.push('phone');
    if (context.coverLetter && setInputValue(firstMatch(selectors.coverLetter), context.coverLetter)) {
      filled.push('cover letter');
    }

    // Greenhouse specific fallback
    if (document.querySelector('#first_name')) {
      setInputValue(document.querySelector('#first_name'), firstName);
      setInputValue(document.querySelector('#last_name'), lastName);
      setInputValue(document.querySelector('#email'), profile.email);
      setInputValue(document.querySelector('#phone'), profile.phone);
      setInputValue(document.querySelector('[id*="linkedin"]'), profile.linkedin);
    }

    if (filled.length > 0 || document.querySelector('#first_name')) {
        console.log(`✅ AI Smart Apply filled fields!`);
        // Only alert if we actually filled something, so we don't alert 5 times for 5 hidden iframes
        alert("✅ Hire-Me AI: Autofill complete! Please review.");
    }

  } catch (err) {
    console.error("❌ Autofill failed:", err);
  }
});