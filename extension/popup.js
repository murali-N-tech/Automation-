// ================= LOAD DATA BUTTON =================
document.getElementById('load-btn').addEventListener('click', async () => {
  const token = document.getElementById('jwt-token').value.trim();
  const appId = document.getElementById('app-id').value.trim();

  if (!token || !appId) {
    alert("Please enter both your JWT Token and the Application ID.");
    return;
  }

  document.getElementById('status-text').innerText =
    'Status: Fetching from server...';

  try {
    // 🔗 Fetch application context from backend
    const response = await fetch(
      `http://localhost:5000/api/apply/context/${appId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      throw new Error(
        "Failed to fetch application data. Check your Token/AppID."
      );
    }

    const dbData = await response.json();

    // 🔄 Map backend data → extension format
    const contextData = {
      profile: {
        name: dbData.profile?.name || "No Name Found",
        email: dbData.profile?.email || "",
        phone: dbData.profile?.phone || "",
        linkedin: dbData.profile?.linkedin || ""
      },
      coverLetter: dbData.coverLetter || ""
    };

    // 💾 Save to Chrome storage
    await chrome.storage.local.set({ applyData: contextData });

    document.getElementById('status-text').innerText =
      'Status: ✅ Data Loaded & Ready to Apply!';

    console.log("✅ Stored applyData:", contextData);

  } catch (err) {
    console.error(err);
    document.getElementById('status-text').innerText =
      'Status: ❌ Error loading data.';
    alert(err.message);
  }
});


// ================= AUTOFILL BUTTON =================
document.getElementById('autofill-btn').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab) {
    alert("No active tab found.");
    return;
  }

  try {
    // 🔥 Inject script into ALL frames (important for Greenhouse / Workday)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      function: triggerAutofill
    });

    document.getElementById('status-text').innerText =
      'Status: ⚡ Autofill triggered!';

  } catch (err) {
    console.error(err);
    alert("Failed to trigger autofill.");
  }
});


// ================= FUNCTION INJECTED INTO PAGE =================
function triggerAutofill() {
  // 🚀 Send message to content script
  window.postMessage({ type: "START_AUTOFILL" }, "*");
}