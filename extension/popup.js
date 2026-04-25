document.getElementById('autofill-btn').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: triggerAutofill
  });
});

function triggerAutofill() {
  // This sends a signal to content.js
  window.postMessage({ type: "START_AUTOFILL" }, "*");
}
