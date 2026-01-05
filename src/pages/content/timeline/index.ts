import { TimelineManager } from './manager';

import { sharedObserverPool } from '@/core/services/SharedObserverPool';

function isGeminiConversationRoute(pathname = location.pathname): boolean {
  // Support account-scoped routes like /u/1/app or /u/0/gem/
  // Matches: "/app", "/gem/", "/u/<num>/app", "/u/<num>/gem/"
  return /^\/(?:u\/\d+\/)?(app|gem)(\/|$)/.test(pathname);
}

let timelineManagerInstance: TimelineManager | null = null;
let currentUrl = location.href;
let currentPathAndSearch = location.pathname + location.search;
let routeCheckIntervalId: number | null = null;
let routeListenersAttached = false;
let cleanupHandlers: (() => void)[] = [];

function initializeTimeline(): void {
  if (timelineManagerInstance) {
    try {
      timelineManagerInstance.destroy();
    } catch {}
    timelineManagerInstance = null;
  }
  try {
    document.querySelector('.gemini-timeline-bar')?.remove();
  } catch {}
  try {
    document.querySelector('.timeline-left-slider')?.remove();
  } catch {}
  try {
    document.getElementById('gemini-timeline-tooltip')?.remove();
  } catch {}
  timelineManagerInstance = new TimelineManager();
  timelineManagerInstance
    .init()
    .catch((err) => console.error('Timeline initialization failed:', err));
}

let urlChangeTimer: number | null = null;

function handleUrlChange(): void {
  if (location.href === currentUrl) return;

  const newPathAndSearch = location.pathname + location.search;
  const pathChanged = newPathAndSearch !== currentPathAndSearch;

  // Update current URL
  currentUrl = location.href;

  // Only reinitialize if pathname or search changed, not just hash
  if (!pathChanged) {
    console.log('[Timeline] Only hash changed, keeping existing timeline');
    return;
  }

  currentPathAndSearch = newPathAndSearch;

  // Clear any pending initialization
  if (urlChangeTimer) {
    clearTimeout(urlChangeTimer);
    urlChangeTimer = null;
  }

  if (isGeminiConversationRoute()) {
    // Add delay to allow DOM to update after SPA navigation
    console.log('[Timeline] URL changed to conversation route, scheduling initialization');
    urlChangeTimer = window.setTimeout(() => {
      console.log('[Timeline] Initializing timeline after URL change');
      initializeTimeline();
      urlChangeTimer = null;
    }, 500); // Wait for DOM to settle
  } else {
    console.log('[Timeline] URL changed to non-conversation route, cleaning up');
    if (timelineManagerInstance) {
      try {
        timelineManagerInstance.destroy();
      } catch {}
      timelineManagerInstance = null;
    }
    try {
      document.querySelector('.gemini-timeline-bar')?.remove();
    } catch {}
    try {
      document.querySelector('.timeline-left-slider')?.remove();
    } catch {}
    try {
      document.getElementById('gemini-timeline-tooltip')?.remove();
    } catch {}
  }
}

function attachRouteListenersOnce(): void {
  if (routeListenersAttached) return;
  routeListenersAttached = true;
  window.addEventListener('popstate', handleUrlChange);
  window.addEventListener('hashchange', handleUrlChange);
  routeCheckIntervalId = window.setInterval(() => {
    if (location.href !== currentUrl) handleUrlChange();
  }, 800);

  // Register cleanup handlers for proper resource management
  cleanupHandlers.push(() => {
    window.removeEventListener('popstate', handleUrlChange);
    window.removeEventListener('hashchange', handleUrlChange);
  });
}

/**
 * Cleanup function to prevent memory leaks
 * Disconnects all observers, clears intervals, and removes event listeners
 */
function cleanup(): void {
  // Clear the route check interval
  if (routeCheckIntervalId !== null) {
    clearInterval(routeCheckIntervalId);
    routeCheckIntervalId = null;
  }

  // Execute all registered cleanup handlers
  cleanupHandlers.forEach((handler) => {
    try {
      handler();
    } catch (e) {
      console.error('[Gemini Voyager] Failed to run cleanup handler:', e);
    }
  });
  cleanupHandlers = [];

  // Reset flag
  routeListenersAttached = false;
}

export function startTimeline(): void {
  // Immediately initialize if we're already on a conversation page
  if (document.body && isGeminiConversationRoute()) {
    initializeTimeline();
  }

  let unsubscribeInitial: (() => void) | null = null;
  unsubscribeInitial = sharedObserverPool.register(
    'body',
    () => {
      if (!document.body) return;
      if (isGeminiConversationRoute()) initializeTimeline();

      unsubscribeInitial?.();
      unsubscribeInitial = null;

      const unsubscribePage = sharedObserverPool.register(
        'body',
        () => handleUrlChange(),
        { childList: true, subtree: true },
        () => document.body
      );
      cleanupHandlers.push(() => unsubscribePage());

      attachRouteListenersOnce();
    },
    { childList: true, subtree: true },
    () => document.documentElement || document.body
  );
  cleanupHandlers.push(() => unsubscribeInitial?.());

  // Setup cleanup on page unload
  window.addEventListener('beforeunload', cleanup, { once: true });

  // Also cleanup on extension unload (if content script is removed)
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onSuspend?.addListener?.(cleanup);
  }
}
