/**
 * YouTube Mobile App Simulator - Main Context Injected Script
 * Solves background audio playback, visibility override, and custom SPA navigation events.
 */
(function () {
  'use strict';

  if (window.__yt_mobile_sim_injected__) return;
  window.__yt_mobile_sim_injected__ = true;

  console.log('[YTM-Simulator] Main context injected engine ready.');

  let backgroundAudioEnabled = true;
  let allowUserPause = false;
  let allowUserPauseTimeout = null;

  // Listen to messages from content script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'YTM_SIM_CONFIG') {
      if (typeof event.data.backgroundAudio === 'boolean') {
        backgroundAudioEnabled = event.data.backgroundAudio;
      }
    }
    if (event.data && event.data.type === 'YTM_SIM_FLOATING_STATE') {
      window.__ytm_is_floating__ = Boolean(event.data.isFloating);
    }
    if (event.data && event.data.type === 'YTM_SIM_ALLOW_PAUSE') {
      allowUserPause = true;
      if (allowUserPauseTimeout) clearTimeout(allowUserPauseTimeout);
      allowUserPauseTimeout = setTimeout(() => {
        allowUserPause = false;
      }, 1000);
    }
  });

  // 1. Override document.hidden and document.visibilityState for background audio
  try {
    Object.defineProperties(document, {
      hidden: {
        get: function () {
          return backgroundAudioEnabled ? false : Boolean(Object.getOwnPropertyDescriptor(Document.prototype, 'hidden').get.call(this));
        },
        configurable: true
      },
      visibilityState: {
        get: function () {
          return backgroundAudioEnabled ? 'visible' : Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState').get.call(this);
        },
        configurable: true
      }
    });
  } catch (e) {
    console.warn('[YTM-Simulator] Visibility API override warning:', e);
  }

  // 2. Intercept visibilitychange and blur event listeners
  const listenerMap = new WeakMap();
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (backgroundAudioEnabled && listener && (type === 'visibilitychange' || type === 'webkitvisibilitychange' || type === 'blur')) {
      let wrappedMap = listenerMap.get(listener);
      if (!wrappedMap) {
        wrappedMap = new Map();
        listenerMap.set(listener, wrappedMap);
      }
      let wrappedListener = wrappedMap.get(type);
      if (!wrappedListener) {
        wrappedListener = function (e) {
          if (backgroundAudioEnabled && (e.type === 'visibilitychange' || e.type === 'webkitvisibilitychange' || e.type === 'blur')) {
            e.stopImmediatePropagation();
            e.stopPropagation();
            return false;
          }
          return typeof listener === 'function' ? listener.apply(this, arguments) : listener.handleEvent(e);
        };
        wrappedMap.set(type, wrappedListener);
      }
      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    if (listener && (type === 'visibilitychange' || type === 'webkitvisibilitychange' || type === 'blur')) {
      const wrappedMap = listenerMap.get(listener);
      if (wrappedMap && wrappedMap.has(type)) {
        const wrappedListener = wrappedMap.get(type);
        return originalRemoveEventListener.call(this, type, wrappedListener, options);
      }
    }
    return originalRemoveEventListener.call(this, type, listener, options);
  };

  // 3. Intercept background audio pause calls
  const originalPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function () {
    if (backgroundAudioEnabled && document.visibilityState === 'visible' && document.hidden === false) {
      const stack = new Error().stack || '';
      if (stack.includes('visibilitychange') || stack.includes('onPageHide') || stack.includes('background')) {
        console.log('[YTM-Simulator] Intercepted automatic background pause call.');
        return;
      }
    }
    return originalPause.apply(this, arguments);
  };

  // 4. Intercept History API (pushState & replaceState) for Instant Navigation Detection
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (state, title, url) {
    const prevUrl = location.href;
    const res = originalPushState.apply(this, arguments);
    const nextUrl = location.href;
    if (prevUrl !== nextUrl) {
      window.dispatchEvent(new CustomEvent('ytm-sim-navigate', { detail: { from: prevUrl, to: nextUrl } }));
    }
    return res;
  };

  history.replaceState = function (state, title, url) {
    const prevUrl = location.href;
    const res = originalReplaceState.apply(this, arguments);
    const nextUrl = location.href;
    if (prevUrl !== nextUrl) {
      window.dispatchEvent(new CustomEvent('ytm-sim-navigate', { detail: { from: prevUrl, to: nextUrl } }));
    }
    return res;
  };
})();
