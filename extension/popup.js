document.getElementById("go").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.runtime.sendMessage({ type: "start-loop", tabId: tab.id, prefs: { format: "xls", delayAfterExportMs: 5500, delayAfterNextMs: 6000, maxPages: 500 } });
});
document.getElementById("stop").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.runtime.sendMessage({ type: "stop-loop", tabId: tab.id });
});
