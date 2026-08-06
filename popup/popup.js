/**
 * YouTube Mobile App Simulator - Popup Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  const toggleMiniplayer = document.getElementById('toggle-miniplayer');
  const selectMiniplayerSize = document.getElementById('select-miniplayer-size');
  const toggleBackground = document.getElementById('toggle-background');
  const toggleAutominimize = document.getElementById('toggle-autominimize');
  const btnOpenYt = document.getElementById('btn-open-yt');

  // Load saved storage settings
  chrome.storage.local.get(['miniPlayerEnabled', 'miniPlayerWidth', 'backgroundAudio', 'autoMinimizeOnNav'], (res) => {
    if (res.miniPlayerEnabled !== undefined) toggleMiniplayer.checked = res.miniPlayerEnabled;
    if (res.miniPlayerWidth !== undefined) selectMiniplayerSize.value = res.miniPlayerWidth;
    if (res.backgroundAudio !== undefined) toggleBackground.checked = res.backgroundAudio;
    if (res.autoMinimizeOnNav !== undefined) toggleAutominimize.checked = res.autoMinimizeOnNav;
  });

  // Save settings on change & notify active tabs
  function saveAndNotify() {
    const settings = {
      miniPlayerEnabled: toggleMiniplayer.checked,
      miniPlayerWidth: parseInt(selectMiniplayerSize.value, 10) || 320,
      backgroundAudio: toggleBackground.checked,
      autoMinimizeOnNav: toggleAutominimize.checked
    };

    chrome.storage.local.set(settings, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'UPDATE_SETTINGS',
            settings: settings
          }).catch(() => {
            // Ignore error if tab is not m.youtube.com
          });
        }
      });
    });
  }

  toggleMiniplayer.addEventListener('change', saveAndNotify);
  selectMiniplayerSize.addEventListener('change', saveAndNotify);
  toggleBackground.addEventListener('change', saveAndNotify);
  toggleAutominimize.addEventListener('change', saveAndNotify);

  // Open YouTube Mobile Web in new tab
  btnOpenYt.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://m.youtube.com' });
  });
});
