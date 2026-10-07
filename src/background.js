chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(null, items => {
    if (chrome.runtime.lastError) return;
    const obsoleteKeys = Object.keys(items).filter(key => /^(req_|api_)/.test(key));
    if (obsoleteKeys.length) {
      chrome.storage.local.remove(obsoleteKeys, () => {
        const error = chrome.runtime.lastError;
        if (error) console.warn('J-Spy: old records could not be removed:', error.message);
      });
    }
  });
});
