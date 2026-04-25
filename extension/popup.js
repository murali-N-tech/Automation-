const tokenEl = document.getElementById('token');
const appIdEl = document.getElementById('applicationId');
const saveBtn = document.getElementById('save');

chrome.storage.local.get(['apoToken', 'apoApplicationId'], (data) => {
  tokenEl.value = data.apoToken || '';
  appIdEl.value = data.apoApplicationId || '';
});

saveBtn.addEventListener('click', async () => {
  const apoToken = tokenEl.value.trim();
  const apoApplicationId = appIdEl.value.trim();

  chrome.storage.local.set({ apoToken, apoApplicationId }, async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { type: 'APO_AUTOFILL' });
    window.close();
  });
});
