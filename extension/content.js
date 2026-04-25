window.addEventListener("message", async (event) => {
  if (event.source !== window || event.data.type !== "START_AUTOFILL") return;

  console.log("🚀 Hire-Me AI: Starting autofill...");

  try {
    // ================= FETCH DATA =================
    // Replace this with real backend call or chrome.storage in production
    const context = {
      profile: {
        name: "Chinthada Murali naga raju",
        email: "muralinaga826@example.com",
        phone: "9063453458",
        linkedin: "www.linkedin.com/in/chinthada-murali-nagaraju-0746912b9"
      },
      coverLetter: `Dear Hiring Manager,

I am excited to apply for this role. With experience in Python, React, and Node.js, I am confident I can contribute effectively.

Thank you for your time.

Sincerely,
Murali`
    };

    const profile = context.profile;

    // ================= HELPERS =================
    const setInputValue = (el, value) => {
      if (!el || !value) return false;
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };

    const firstMatch = (selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    // ================= FIELD SELECTORS =================
    const selectors = {
      firstName: [
        'input[name*="first"]',
        'input[id*="first"]',
        'input[placeholder*="First"]'
      ],
      lastName: [
        'input[name*="last"]',
        'input[id*="last"]',
        'input[placeholder*="Last"]'
      ],
      email: [
        'input[type="email"]',
        'input[name*="email"]'
      ],
      phone: [
        'input[type="tel"]',
        'input[name*="phone"]'
      ],
      coverLetter: [
        'textarea[name*="cover"]',
        'textarea[id*="cover"]',
        'textarea',
        'div[contenteditable="true"]'
      ]
    };

    // ================= NAME SPLIT =================
    const nameParts = (profile.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const filled = [];

    // ================= GENERIC AUTOFILL =================
    if (setInputValue(firstMatch(selectors.firstName), firstName)) {
      filled.push('first name');
    }

    if (setInputValue(firstMatch(selectors.lastName), lastName)) {
      filled.push('last name');
    }

    if (setInputValue(firstMatch(selectors.email), profile.email || '')) {
      filled.push('email');
    }

    if (setInputValue(firstMatch(selectors.phone), profile.phone || '')) {
      filled.push('phone');
    }

    // ================= NEW: COVER LETTER =================
    if (
      context.coverLetter &&
      setInputValue(firstMatch(selectors.coverLetter), context.coverLetter)
    ) {
      filled.push('cover letter');
    }

    // ================= GREENHOUSE SPECIAL HANDLING =================
    if (window.location.href.includes('greenhouse.io')) {
      console.log("🌿 Greenhouse detected - applying specific selectors");

      setInputValue(document.querySelector('#first_name'), firstName);
      setInputValue(document.querySelector('#last_name'), lastName);
      setInputValue(document.querySelector('#email'), profile.email);
      setInputValue(document.querySelector('#phone'), profile.phone);

      // LinkedIn field (common in Greenhouse)
      setInputValue(
        document.querySelector('[id*="linkedin"]'),
        profile.linkedin
      );
    }

    // ================= RESULT =================
    console.log(
      `✅ AI Smart Apply: Filled fields → ${filled.join(', ') || 'none'}`
    );

    alert("✅ Hire-Me AI: Autofill complete! Please review before submitting.");

  } catch (err) {
    console.error("❌ Autofill failed:", err);
  }
});