/**
 * YouTube Mobile App Simulator - Background Service Worker
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[YTM-Simulator] Extension installed. Setting default configurations.');
    chrome.storage.local.set({
      miniPlayerEnabled: true,
      backgroundAudio: true,
      autoMinimizeOnNav: true
    });
  }
});

// Listen for tab updates to ensure scripts are active
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('m.youtube.com')) {
    chrome.action.setBadgeText({ tabId, text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#FF0000' });
  }
});
