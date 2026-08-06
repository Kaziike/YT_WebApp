/**
 * YouTube Mobile App Simulator - Content Script
 * Hybrid Architecture: Pre-unmount reparenting, Universal Video State Engine, and Hybrid Embed Fallback.
 * Features: Mini-player resizing (presets + touch/mouse corner drag), Shorts auto-close, Watch page enforcement.
 */
(function () {
  'use strict';

  console.log('[YTM-Simulator] Content script initialized on:', location.hostname);

  // Configuration
  let config = {
    miniPlayerEnabled: true,
    miniPlayerWidth: 320,
    backgroundAudio: true,
    autoMinimizeOnNav: true
  };

  // State Tracking
  let miniplayerEl = null;
  let activeVideoEl = null;
  let mainWatchVideoEl = null;
  let originalParent = null;
  let originalNextSibling = null;
  let lastWatchUrl = null;
  let isFloating = false;
  let isDragging = false;
  let isResizing = false;
  let dragOffset = { x: 0, y: 0 };
  let touchStartY = 0;
  let currentVideoTitle = 'YouTube Video';
  let cachedWatchVideoState = null;

  // 1. Inject Page-Context Script
  function injectMainScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('scripts/injected.js');
      script.onload = function () {
        this.remove();
        sendConfigToInjected();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.error('[YTM-Simulator] Injection error:', e);
    }
  }

  function sendConfigToInjected() {
    window.postMessage(
      {
        type: 'YTM_SIM_CONFIG',
        backgroundAudio: config.backgroundAudio
      },
      '*'
    );
  }

  // 2. Load and Sync Settings
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['miniPlayerEnabled', 'miniPlayerWidth', 'backgroundAudio', 'autoMinimizeOnNav'], (res) => {
        if (res.miniPlayerEnabled !== undefined) config.miniPlayerEnabled = res.miniPlayerEnabled;
        if (res.miniPlayerWidth !== undefined) config.miniPlayerWidth = res.miniPlayerWidth;
        if (res.backgroundAudio !== undefined) config.backgroundAudio = res.backgroundAudio;
        if (res.autoMinimizeOnNav !== undefined) config.autoMinimizeOnNav = res.autoMinimizeOnNav;
        applyMiniPlayerSize();
        sendConfigToInjected();
      });
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (req.type === 'UPDATE_SETTINGS') {
        config = { ...config, ...req.settings };
        applyMiniPlayerSize();
        sendConfigToInjected();
        if (!config.miniPlayerEnabled && isFloating) {
          restoreVideo();
        }
        showToast('Đã cập nhật cài đặt');
        sendResponse({ success: true });
      }
    });
  }

  // Apply Mini-Player Width & Height
  function applyMiniPlayerSize() {
    if (!miniplayerEl) return;
    const width = Math.max(220, Math.min(config.miniPlayerWidth || 320, 520));
    miniplayerEl.style.setProperty('width', width + 'px', 'important');
    
    // Also apply to CSS sticky floating player if present
    const pipPlayer = document.querySelector('.ytm-pip-floating');
    if (pipPlayer) {
      pipPlayer.style.setProperty('width', width + 'px', 'important');
      pipPlayer.style.setProperty('height', Math.round(width * 9 / 16) + 'px', 'important');
    }
  }

  // 3. Create Floating Mini-Player UI
  function createMiniPlayerUI() {
    if (document.getElementById('ytm-floating-miniplayer')) {
      miniplayerEl = document.getElementById('ytm-floating-miniplayer');
      applyMiniPlayerSize();
      return;
    }

    miniplayerEl = document.createElement('div');
    miniplayerEl.id = 'ytm-floating-miniplayer';
    miniplayerEl.className = 'ytm-hidden';

    miniplayerEl.innerHTML = `
      <div class="ytm-miniplayer-header" id="ytm-drag-handle">
        <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
          <div class="ytm-miniplayer-drag-indicator"></div>
          <span class="ytm-miniplayer-title" id="ytm-mini-title">YouTube Video</span>
        </div>
        <div class="ytm-miniplayer-controls">
          <button class="ytm-btn" id="ytm-btn-pip" title="Bật Picture-in-Picture hệ thống">
            <svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>
          </button>
          <button class="ytm-btn" id="ytm-btn-expand" title="Xem đầy đủ">
            <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
          </button>
          <button class="ytm-btn" id="ytm-btn-close" title="Đóng Mini-player">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      </div>
      <div class="ytm-miniplayer-body" id="ytm-mini-body">
        <div class="ytm-miniplayer-overlay" id="ytm-overlay-controls">
          <button class="ytm-overlay-btn" id="ytm-btn-playpause" title="Phát/Tạm dừng">
            <svg id="ytm-ic-pause" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            <svg id="ytm-ic-play" viewBox="0 0 24 24" style="display:none;"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      </div>
      <div class="ytm-miniplayer-resize-handle" id="ytm-resize-handle" title="Kéo để chỉnh kích thước"></div>
    `;

    document.body.appendChild(miniplayerEl);
    applyMiniPlayerSize();

    // Event listeners
    document.getElementById('ytm-btn-pip').addEventListener('click', toggleSystemPiP);
    document.getElementById('ytm-btn-expand').addEventListener('click', expandToWatch);
    document.getElementById('ytm-btn-close').addEventListener('click', closeMiniPlayer);
    document.getElementById('ytm-btn-playpause').addEventListener('click', togglePlayPause);
    
    document.getElementById('ytm-mini-body').addEventListener('click', (e) => {
      if (e.target.id === 'ytm-mini-body' || e.target.tagName === 'VIDEO') {
        const overlay = document.getElementById('ytm-overlay-controls');
        overlay.classList.toggle('ytm-visible');
      }
    });

    setupTouchAndDrag();
    setupResizeGesture();
  }

  function toggleSystemPiP() {
    findActiveVideo();
    if (activeVideoEl && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
      } else {
        activeVideoEl.requestPictureInPicture().catch((err) => console.warn('PiP error:', err));
      }
    }
  }

  // 4. Touch & Drag Gestures + Corner Resize Handler
  function setupTouchAndDrag() {
    const handle = document.getElementById('ytm-drag-handle');
    if (!handle) return;

    const onStart = (e) => {
      if (e.target.closest('.ytm-miniplayer-controls') || isResizing) return;
      isDragging = true;
      miniplayerEl.classList.add('ytm-dragging');

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      touchStartY = clientY;

      const rect = miniplayerEl.getBoundingClientRect();
      dragOffset.x = clientX - rect.left;
      dragOffset.y = clientY - rect.top;

      if (e.type === 'touchstart') {
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchcancel', onEnd);
      } else {
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
      }
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      let newX = clientX - dragOffset.x;
      let newY = clientY - dragOffset.y;

      const maxLeft = window.innerWidth - miniplayerEl.offsetWidth - 8;
      const maxTop = window.innerHeight - miniplayerEl.offsetHeight - 55;

      newX = Math.max(8, Math.min(newX, maxLeft));
      newY = Math.max(8, Math.min(newY, maxTop));

      miniplayerEl.style.left = newX + 'px';
      miniplayerEl.style.top = newY + 'px';
      miniplayerEl.style.bottom = 'auto';
      miniplayerEl.style.right = 'auto';

      if (e.cancelable) e.preventDefault();
    };

    const onEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      miniplayerEl.classList.remove('ytm-dragging');

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);

      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      if (clientY - touchStartY > 110) {
        closeMiniPlayer();
      }
    };

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
  }

  // Corner Drag Resize Gesture
  function setupResizeGesture() {
    const resizeHandle = document.getElementById('ytm-resize-handle');
    if (!resizeHandle) return;

    let startX = 0;
    let startWidth = 320;

    const onResizeStart = (e) => {
      e.stopPropagation();
      isResizing = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startWidth = miniplayerEl.offsetWidth;

      if (e.type === 'touchstart') {
        document.addEventListener('touchmove', onResizeMove, { passive: false });
        document.addEventListener('touchend', onResizeEnd);
      } else {
        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onResizeEnd);
      }
    };

    const onResizeMove = (e) => {
      if (!isResizing) return;
      const currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const deltaX = currentX - startX;
      const newWidth = Math.max(220, Math.min(startWidth + deltaX, 520));

      config.miniPlayerWidth = newWidth;
      applyMiniPlayerSize();

      if (e.cancelable) e.preventDefault();
    };

    const onResizeEnd = () => {
      if (!isResizing) return;
      isResizing = false;
      document.removeEventListener('mousemove', onResizeMove);
      document.removeEventListener('mouseup', onResizeEnd);
      document.removeEventListener('touchmove', onResizeMove);
      document.removeEventListener('touchend', onResizeEnd);

      // Save resized width to storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ miniPlayerWidth: config.miniPlayerWidth });
      }
    };

    resizeHandle.addEventListener('mousedown', onResizeStart);
    resizeHandle.addEventListener('touchstart', onResizeStart, { passive: false });
  }

  function resetMiniPlayerPosition() {
    if (miniplayerEl) {
      miniplayerEl.style.left = '';
      miniplayerEl.style.top = '';
      miniplayerEl.style.bottom = '';
      miniplayerEl.style.right = '';
    }
  }

  // 5. Video Utility & Persistent State Manager
  function getVideoIdFromUrl(urlStr) {
    try {
      const url = new URL(urlStr || location.href);
      return url.searchParams.get('v');
    } catch (e) {
      return null;
    }
  }

  function isInlinePreviewOrAd(v) {
    if (!v) return false;
    if (location.pathname === '/watch' && v.closest('ytm-watch, #player-container-id, #player, .html5-video-player')) {
      return false;
    }
    return Boolean(
      v.closest('ytm-inline-player-renderer, .inline-preview-player, ytm-reel-video-renderer, ytm-shorts, ytm-masthead-ad-primary-renderer, ytm-promoted-sparkles-web-renderer, ytm-statement-banner-renderer')
    );
  }

  function extractTitle() {
    const isWatch = location.pathname === '/watch';
    const watchContainer = isWatch
      ? document.querySelector('ytm-watch, #player-container-id, ytm-single-column-watch-next-results-renderer, #player, ytd-watch-flexy')
      : null;

    const titleCandidates = [
      'h1.slim-video-information-title',
      'h1.title',
      '.ytm-slim-video-metadata-title',
      'ytm-slim-video-metadata-renderer .title',
      '#title.ytd-watch-metadata'
    ];

    if (watchContainer) {
      for (let sel of titleCandidates) {
        const el = watchContainer.querySelector(sel);
        if (el && el.textContent.trim()) {
          currentVideoTitle = el.textContent.trim().replace(/- YouTube$/, '');
          return;
        }
      }
    }

    if (isWatch) {
      for (let sel of titleCandidates) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          currentVideoTitle = el.textContent.trim().replace(/- YouTube$/, '');
          return;
        }
      }
    }
  }

  function updateWatchVideoState() {
    const isWatch = location.pathname === '/watch';
    if (!isWatch) return;

    const vId = getVideoIdFromUrl(location.href);
    if (!vId) return;

    const watchContainer = document.querySelector('ytm-watch, #player-container-id, ytm-single-column-watch-next-results-renderer, #player, ytd-watch-flexy, .html5-video-player') || document;
    const v = watchContainer.querySelector('video');

    if (v && !isInlinePreviewOrAd(v)) {
      activeVideoEl = v;
      mainWatchVideoEl = v;
      v.setAttribute('data-ytm-watch-video', 'true');
      const p = v.closest('.html5-video-player') || v.parentElement;
      if (p) p.setAttribute('data-ytm-watch-player', 'true');

      extractTitle();

      cachedWatchVideoState = {
        videoId: vId,
        title: currentVideoTitle || 'YouTube Video',
        url: location.href,
        currentTime: Math.floor(v.currentTime || 0),
        timestamp: Date.now()
      };
      lastWatchUrl = location.href;

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ ytm_last_video: cachedWatchVideoState });
      }
    }
  }

  setInterval(updateWatchVideoState, 1000);

  function findActiveVideo() {
    const isWatch = location.pathname === '/watch';

    if (isWatch) {
      updateWatchVideoState();
      return activeVideoEl;
    }

    if (isFloating) {
      if (miniplayerEl) {
        const miniVid = miniplayerEl.querySelector('video');
        if (miniVid) {
          activeVideoEl = miniVid;
          return miniVid;
        }
      }
      if (mainWatchVideoEl && document.body.contains(mainWatchVideoEl)) {
        activeVideoEl = mainWatchVideoEl;
        return mainWatchVideoEl;
      }
    }

    return isFloating ? activeVideoEl : null;
  }

  ['play', 'playing', 'timeupdate', 'loadedmetadata'].forEach((evtType) => {
    window.addEventListener(
      evtType,
      (e) => {
        if (e.target && e.target.tagName === 'VIDEO') {
          if (isFloating && miniplayerEl && !miniplayerEl.contains(e.target)) {
            try {
              e.target.pause();
              e.target.muted = true;
            } catch (err) {}
            return;
          }

          if (location.pathname === '/watch') {
            updateWatchVideoState();
          }
        }
      },
      true
    );
  });

  function getPlayerToFloat() {
    findActiveVideo();
    if (activeVideoEl) {
      const player = activeVideoEl.closest('[data-ytm-watch-player="true"], .html5-video-player') || activeVideoEl.parentElement;
      if (player && player.closest('ytm-masthead-ad-primary-renderer, ytm-promoted-sparkles-web-renderer, ytm-inline-player-renderer, ytm-statement-banner-renderer')) {
        return null;
      }
      return player;
    }
    return null;
  }

  // 6. Float Mechanics & Hybrid Fallback Trigger (CSS Sticky Floating - Zero Reparenting!)
  function floatVideo() {
    const isWatch = location.pathname === '/watch';
    const isShorts = location.pathname.startsWith('/shorts');
    if (!config.miniPlayerEnabled || isFloating || isWatch || isShorts) return;

    updateWatchVideoState();
    const targetPlayer = getPlayerToFloat();

    if (targetPlayer && document.body.contains(targetPlayer)) {
      createMiniPlayerUI();
      document.body.classList.add('ytm-floating-active');
      const titleEl = document.getElementById('ytm-mini-title');
      titleEl.textContent = currentVideoTitle || (cachedWatchVideoState ? cachedWatchVideoState.title : 'YouTube Mobile Video');

      const width = Math.max(220, Math.min(config.miniPlayerWidth || 320, 520));
      targetPlayer.classList.add('ytm-pip-floating');
      targetPlayer.style.setProperty('position', 'fixed', 'important');
      targetPlayer.style.setProperty('bottom', '64px', 'important');
      targetPlayer.style.setProperty('right', '12px', 'important');
      targetPlayer.style.setProperty('width', width + 'px', 'important');
      targetPlayer.style.setProperty('height', Math.round(width * 9 / 16) + 'px', 'important');
      targetPlayer.style.setProperty('z-index', '2147483647', 'important');
      targetPlayer.style.setProperty('border-radius', '14px', 'important');
      targetPlayer.style.setProperty('box-shadow', '0 12px 36px rgba(0,0,0,0.8)', 'important');
      targetPlayer.style.setProperty('overflow', 'hidden', 'important');
      targetPlayer.style.setProperty('display', 'block', 'important');
      targetPlayer.style.setProperty('visibility', 'visible', 'important');
      targetPlayer.style.setProperty('opacity', '1', 'important');

      miniplayerEl.classList.remove('ytm-hidden');
      applyMiniPlayerSize();
      isFloating = true;

      window.postMessage({ type: 'YTM_SIM_FLOATING_STATE', isFloating: true }, '*');

      if (activeVideoEl) {
        activeVideoEl.style.setProperty('width', '100%', 'important');
        activeVideoEl.style.setProperty('height', '100%', 'important');
        activeVideoEl.style.setProperty('object-fit', 'contain', 'important');
        activeVideoEl.muted = false;
        if (activeVideoEl.volume < 0.1) activeVideoEl.volume = 1.0;
        activeVideoEl.play().catch(() => {});
      }

      updatePlayPauseState();
      showToast('Đang phát chế độ Mini-Player');
    } else {
      if (cachedWatchVideoState && cachedWatchVideoState.videoId) {
        floatSavedVideoEmbed(cachedWatchVideoState);
      }
    }
  }

  function floatSavedVideoEmbed(lastVideo) {
    const isWatch = location.pathname === '/watch';
    const isShorts = location.pathname.startsWith('/shorts');
    if (isFloating || !lastVideo || !lastVideo.videoId || isWatch || isShorts) return;

    createMiniPlayerUI();
    document.body.classList.add('ytm-floating-active');
    const miniBody = document.getElementById('ytm-mini-body');
    const titleEl = document.getElementById('ytm-mini-title');

    titleEl.textContent = lastVideo.title || 'YouTube Mobile Video';
    lastWatchUrl = lastVideo.url || `https://m.youtube.com/watch?v=${lastVideo.videoId}`;

    const overlay = document.getElementById('ytm-overlay-controls');
    miniBody.innerHTML = '';
    if (overlay) miniBody.appendChild(overlay);

    const startSec = Math.max(0, (lastVideo.currentTime || 0) - 2);
    const iframe = document.createElement('iframe');
    iframe.id = 'ytm-embed-player';
    iframe.src = `https://www.youtube-nocookie.com/embed/${lastVideo.videoId}?autoplay=1&start=${startSec}&enablejsapi=1&playsinline=1`;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';

    miniBody.appendChild(iframe);
    miniplayerEl.classList.remove('ytm-hidden');
    applyMiniPlayerSize();
    isFloating = true;

    showToast('Khôi phục Mini-Player');
  }

  function triggerMiniPlayerOnLeave() {
    const isWatch = location.pathname === '/watch';
    const isShorts = location.pathname.startsWith('/shorts');
    if (!config.miniPlayerEnabled || isFloating || isWatch || isShorts) return;

    updateWatchVideoState();

    if (cachedWatchVideoState && cachedWatchVideoState.videoId) {
      floatSavedVideoEmbed(cachedWatchVideoState);
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['ytm_last_video'], (res) => {
        if (res.ytm_last_video && res.ytm_last_video.videoId && location.pathname !== '/watch' && !location.pathname.startsWith('/shorts')) {
          floatSavedVideoEmbed(res.ytm_last_video);
        }
      });
    }
  }

  function restoreVideo() {
    document.body.classList.remove('ytm-floating-active');
    
    const targetPlayer = document.querySelector('.ytm-pip-floating, .html5-video-player, #player-container-id') || activeVideoEl;

    if (targetPlayer) {
      targetPlayer.classList.remove('ytm-pip-floating');
      targetPlayer.style.removeProperty('position');
      targetPlayer.style.removeProperty('bottom');
      targetPlayer.style.removeProperty('right');
      targetPlayer.style.removeProperty('width');
      targetPlayer.style.removeProperty('height');
      targetPlayer.style.removeProperty('z-index');
      targetPlayer.style.removeProperty('border-radius');
      targetPlayer.style.removeProperty('box-shadow');
      targetPlayer.style.removeProperty('overflow');
    }

    const miniBody = document.getElementById('ytm-mini-body');
    if (miniBody) {
      const embedIframe = miniBody.querySelector('#ytm-embed-player');
      if (embedIframe) embedIframe.remove();
    }

    if (miniplayerEl) {
      miniplayerEl.classList.add('ytm-hidden');
      resetMiniPlayerPosition();
    }
    isFloating = false;

    window.postMessage({ type: 'YTM_SIM_FLOATING_STATE', isFloating: false }, '*');
  }

  function expandToWatch() {
    if (lastWatchUrl) {
      restoreVideo();
      window.location.href = lastWatchUrl;
    } else {
      restoreVideo();
    }
  }

  function closeMiniPlayer() {
    window.postMessage({ type: 'YTM_SIM_ALLOW_PAUSE' }, '*');
    if (activeVideoEl) {
      activeVideoEl.pause();
    }
    restoreVideo();
    showToast('Đã đóng Mini-Player');
  }

  function togglePlayPause() {
    if (!activeVideoEl) return;
    window.postMessage({ type: 'YTM_SIM_ALLOW_PAUSE' }, '*');
    if (activeVideoEl.paused) {
      activeVideoEl.play();
    } else {
      activeVideoEl.pause();
    }
    updatePlayPauseState();
  }

  function updatePlayPauseState() {
    if (!activeVideoEl) return;
    const playIcon = document.getElementById('ytm-ic-play');
    const pauseIcon = document.getElementById('ytm-ic-pause');
    if (playIcon && pauseIcon) {
      if (activeVideoEl.paused) {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
      } else {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
      }
    }
  }

  // 7. Navigation Intercept Logic
  function handleNavigationChange(targetUrl) {
    const isWatch = location.pathname === '/watch';
    const isShorts = location.pathname.startsWith('/shorts');
    console.log('[YTM-Simulator] Navigation event. isWatch:', isWatch, 'isShorts:', isShorts, 'target:', targetUrl);

    if (isWatch || isShorts) {
      restoreVideo();
      if (isWatch) {
        lastWatchUrl = location.href;
        mainWatchVideoEl = null;
        activeVideoEl = null;

        setTimeout(() => {
          updateWatchVideoState();
        }, 300);
      }
    } else {
      triggerMiniPlayerOnLeave();
    }
  }

  window.addEventListener('ytm-sim-navigate', (e) => {
    handleNavigationChange(e.detail ? e.detail.to : location.href);
  });

  // Pre-unmount touch/pointer/click intercept on all mobile navigation links & bottom bar
  ['touchstart', 'pointerdown', 'click'].forEach((evtType) => {
    document.addEventListener(
      evtType,
      (e) => {
        const link = e.target.closest('a, ytm-pivot-bar-item-renderer, ytm-compact-link-renderer, .pivot-bar-item, ytm-header-bar, .header-bar, ytm-home-logo, #logo, [role="tab"]');
        if (link && config.miniPlayerEnabled) {
          const isWatch = location.pathname === '/watch';
          if (isWatch) {
            updateWatchVideoState();
            document.body.classList.add('ytm-floating-active');
            triggerMiniPlayerOnLeave();
          }
        }
      },
      true
    );
  });

  window.addEventListener('popstate', () => {
    const isWatch = location.pathname === '/watch';
    const isShorts = location.pathname.startsWith('/shorts');
    if (isWatch || isShorts) {
      restoreVideo();
    } else {
      triggerMiniPlayerOnLeave();
    }
  });

  let lastHref = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      handleNavigationChange(lastHref);
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  function showToast(msg) {
    let toast = document.getElementById('ytm-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ytm-toast';
      toast.className = 'ytm-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // Initialize Execution
  loadSettings();
  injectMainScript();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createMiniPlayerUI();
      if (location.pathname === '/watch' || location.pathname.startsWith('/shorts')) {
        restoreVideo();
        updateWatchVideoState();
      } else {
        setTimeout(triggerMiniPlayerOnLeave, 500);
      }
    });
  } else {
    createMiniPlayerUI();
    if (location.pathname === '/watch' || location.pathname.startsWith('/shorts')) {
      restoreVideo();
      updateWatchVideoState();
    } else {
      setTimeout(triggerMiniPlayerOnLeave, 500);
    }
  }
})();
