const statusEl = document.getElementById('status-text');

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

// ================= LOAD DATA BUTTON =================
document.getElementById('load-btn').addEventListener('click', async () => {
  const token = document.getElementById('jwt-token').value.trim();
  const appId = document.getElementById('app-id').value.trim();

  if (!token || !appId) {
    setStatus('⚠ Enter both Token and Application ID.', 'error');
    return;
  }

  const loadBtn = document.getElementById('load-btn');
  loadBtn.disabled = true;
  loadBtn.textContent = 'Loading...';
  setStatus('Fetching from server...');

  try {
    const response = await fetch(
      `http://localhost:5000/api/apply/context/${appId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${response.status}`);
    }

    const dbData = await response.json();

    const contextData = {
      profile: {
        name:     dbData.profile?.name    || '',
        email:    dbData.profile?.email   || '',
        phone:    dbData.profile?.phone   || '',
        linkedin: dbData.profile?.linkedin || '',
        skills:   dbData.profile?.skills  || [],
      },
      coverLetter: dbData.coverLetter || '',
      job: {
        title:   dbData.job?.title   || '',
        company: dbData.job?.company || '',
        url:     dbData.job?.url     || '',
      },
    };

    await chrome.storage.local.set({ applyData: contextData });
    setStatus(`✅ Loaded: ${contextData.profile.name || 'Profile'} → ${contextData.job.title || 'Job'}`, 'success');

  } catch (err) {
    setStatus(`❌ ${err.message}`, 'error');
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = '① Load Job Data';
  }
});


// ================= AUTOFILL BUTTON =================
document.getElementById('autofill-btn').addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['applyData']);
  if (!stored.applyData) {
    setStatus('⚠ Load job data first (Step 1).', 'error');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    setStatus('❌ No active tab found.', 'error');
    return;
  }

  try {
    // Inject into all frames (needed for Greenhouse, Workday iframes)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => window.postMessage({ type: 'START_AUTOFILL' }, '*'),
    });
    setStatus('⚡ Autofill triggered! Check the page.', 'success');
  } catch (err) {
    setStatus(`❌ Autofill failed: ${err.message}`, 'error');
  }
});