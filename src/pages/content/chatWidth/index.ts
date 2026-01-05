/**
 * Adjusts the chat area width based on user settings (stored as viewport %)
 */

import { storageFacade } from '@/core/services/StorageFacade';
import { sharedObserverPool } from '@/core/services/SharedObserverPool';
import { StorageKeys } from '@/core/types/common';

const STYLE_ID = 'gemini-voyager-chat-width';
const DEFAULT_PERCENT = 70;
const MIN_PERCENT = 30;
const MAX_PERCENT = 100;
const LEGACY_BASELINE_PX = 1200;

// Selectors based on the export functionality that already works
function getUserSelectors(): string[] {
  return [
    '.user-query-bubble-container',
    '.user-query-container',
    'user-query-content',
    'user-query',
    'div[aria-label="User message"]',
    'article[data-author="user"]',
    '[data-message-author-role="user"]',
  ];
}

function getAssistantSelectors(): string[] {
  return [
    'model-response',
    '.model-response',
    'response-container',
    '.response-container',
    '.presented-response-container',
    '[aria-label="Gemini response"]',
    '[data-message-author-role="assistant"]',
    '[data-message-author-role="model"]',
    'article[data-author="assistant"]',
  ];
}

const clampPercent = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const normalizePercent = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  if (value > MAX_PERCENT) {
    const approx = (value / LEGACY_BASELINE_PX) * 100;
    return clampPercent(approx, MIN_PERCENT, MAX_PERCENT);
  }
  return clampPercent(value, MIN_PERCENT, MAX_PERCENT);
};

function applyWidth(widthPercent: number) {
  const normalizedPercent = normalizePercent(widthPercent, DEFAULT_PERCENT);
  const widthValue = `${normalizedPercent}vw`;

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  const userSelectors = getUserSelectors();
  const assistantSelectors = getAssistantSelectors();

  // Build comprehensive CSS rules
  const userRules = userSelectors.map(sel => `${sel}`).join(',\n    ');
  const assistantRules = assistantSelectors.map(sel => `${sel}`).join(',\n    ');

  // A small gap to account for scrollbars
  const GAP_PX = 10;

  style.textContent = `
    /* Remove width constraints from outer containers that contain conversations */
    .content-wrapper:has(chat-window),
    .main-content:has(chat-window),
    .content-container:has(chat-window),
    .content-container:has(.conversation-container) {
      max-width: none !important;
    }

    /* Remove width constraints from main and conversation containers, but not buttons */
    [role="main"]:has(chat-window),
    [role="main"]:has(.conversation-container) {
      max-width: none !important;
    }

    /* Target chat window and related containers; A small gap to account for scrollbars */
    chat-window,
    .chat-container,
    chat-window-content,
    .chat-history-scroll-container,
    .chat-history,
    .conversation-container {
      max-width: none !important;
      padding-right: ${GAP_PX}px !important;
      box-sizing: border-box !important;
    }

    main > div:has(user-query),
    main > div:has(model-response),
    main > div:has(.conversation-container) {
      max-width: none !important;
      width: 100% !important;
    }

    /* Fallback for browsers without :has() support */
    @supports not selector(:has(*)) {
      .content-wrapper,
      .main-content,
      .content-container {
        max-width: none !important;
      }

      main > div:not(:has(button)):not(.main-menu-button) {
        max-width: none !important;
        width: 100% !important;
      }
    }

    /* User query containers */
    ${userRules} {
      max-width: ${widthValue} !important;
      width: min(100%, ${widthValue}) !important;
    }

    /* Model response containers */
    ${assistantRules} {
      max-width: ${widthValue} !important;
      width: min(100%, ${widthValue}) !important;
    }

    /* Additional deep targeting for nested elements */
    user-query,
    user-query > *,
    user-query > * > *,
    model-response,
    model-response > *,
    model-response > * > *,
    response-container,
    response-container > *,
    response-container > * > * {
      max-width: ${widthValue} !important;
    }

    /* Target specific internal containers that might have fixed widths */
    .presented-response-container,
    [data-message-author-role] {
      max-width: ${widthValue} !important;
    }

    /* Specific fix for user bubble background to fit content but respect max-width */
    .user-query-bubble-with-background {
      max-width: ${widthValue} !important;
      width: fit-content !important;
    }
  `;
}

function removeStyles() {
  const style = document.getElementById(STYLE_ID);
  if (style) {
    style.remove();
  }
}

export function startChatWidthAdjuster() {
  let currentWidthPercent = DEFAULT_PERCENT;
  let enabled = true;
  let observerUnsubscribe: (() => void) | null = null;
  let unsubscribeEnabled: (() => void) | null = null;
  let unsubscribeWidth: (() => void) | null = null;

  const setupObserver = () => {
    if (observerUnsubscribe) return;

    let debounceTimer: number | null = null;
    observerUnsubscribe = sharedObserverPool.register(
      'main',
      () => {
        if (!enabled) return;
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = window.setTimeout(() => {
          applyWidth(currentWidthPercent);
          debounceTimer = null;
        }, 200);
      },
      { childList: true, subtree: true },
      () => document.querySelector('main')
    );
  };

  // Load initial settings
  void storageFacade.getSettings(
    {
      [StorageKeys.CHAT_WIDTH]: DEFAULT_PERCENT,
      [StorageKeys.CHAT_WIDTH_ENABLED]: true
    },
    (res: { [StorageKeys.CHAT_WIDTH]?: number; [StorageKeys.CHAT_WIDTH_ENABLED]?: boolean }) => {
      enabled = res?.[StorageKeys.CHAT_WIDTH_ENABLED] !== false;

      if (enabled) {
        const storedWidth = res?.[StorageKeys.CHAT_WIDTH];
        const normalized = normalizePercent(storedWidth ?? DEFAULT_PERCENT, DEFAULT_PERCENT);
        currentWidthPercent = normalized;
        applyWidth(currentWidthPercent);
        setupObserver();

        if (typeof storedWidth === 'number' && storedWidth !== normalized) {
          try {
            void storageFacade.setSetting(StorageKeys.CHAT_WIDTH, normalized).catch(() => {});
          } catch (e) {
            console.warn('[Gemini Voyager] Failed to migrate chat width to %:', e);
          }
        }
      }
    }
  );

  // Listen for changes from storage
  unsubscribeEnabled = storageFacade.subscribe(
    StorageKeys.CHAT_WIDTH_ENABLED,
    (change, area) => {
      if (area !== 'sync') return;
      enabled = change.newValue !== false;
      if (enabled) {
        applyWidth(currentWidthPercent);
        setupObserver();
      } else {
        removeStyles();
        if (observerUnsubscribe) {
          observerUnsubscribe();
          observerUnsubscribe = null;
        }
      }
    },
    { area: 'sync' }
  );
  unsubscribeWidth = storageFacade.subscribe(
    StorageKeys.CHAT_WIDTH,
    (change, area) => {
      if (area !== 'sync' || !enabled) return;
      const newWidth = change.newValue;
      if (typeof newWidth === 'number') {
        const normalized = normalizePercent(newWidth, DEFAULT_PERCENT);
        currentWidthPercent = normalized;
        applyWidth(currentWidthPercent);

        if (normalized !== newWidth) {
          void storageFacade.setSetting(StorageKeys.CHAT_WIDTH, normalized).catch((e) => {
            console.warn('[Gemini Voyager] Failed to migrate chat width to % on change:', e);
          });
        }
      }
    },
    { area: 'sync' }
  );

  // Clean up on unload to prevent memory leaks
  window.addEventListener('beforeunload', () => {
    if (observerUnsubscribe) observerUnsubscribe();
    observerUnsubscribe = null;
    removeStyles();
    try {
      unsubscribeEnabled?.();
      unsubscribeWidth?.();
      unsubscribeEnabled = null;
      unsubscribeWidth = null;
    } catch (e) {
      console.error('[Gemini Voyager] Failed to remove storage listener on unload:', e);
    }
  }, { once: true });
}

