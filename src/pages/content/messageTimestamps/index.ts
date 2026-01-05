/**
 * Message Timestamps - Displays time at the end of each chat bubble
 * Since Gemini doesn't expose actual timestamps, we track when messages appear
 */

import { storageFacade } from '@/core/services/StorageFacade';
import { sharedObserverPool } from '@/core/services/SharedObserverPool';
import { StorageKeys } from '@/core/types/common';

const TIMESTAMP_CLASS = 'gv-message-timestamp';
const TIMESTAMP_ATTR = 'data-gv-timestamp';
const STYLE_ID = 'gv-message-timestamps-style';

// Store timestamps for messages we've seen
const messageTimestamps = new Map<string, number>();

function injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
    .${TIMESTAMP_CLASS} {
      display: block;
      font-size: 10px;
      color: var(--gm-sys-color-outline, #8e8e8e);
      margin-top: 4px;
      text-align: right;
      font-family: 'Google Sans', sans-serif;
      opacity: 0.7;
    }
    
    /* For user messages */
    user-query .${TIMESTAMP_CLASS},
    .user-query-container .${TIMESTAMP_CLASS},
    [data-message-author-role="user"] .${TIMESTAMP_CLASS} {
      text-align: right;
    }
    
    /* For model responses */
    model-response .${TIMESTAMP_CLASS},
    .model-response .${TIMESTAMP_CLASS},
    [data-message-author-role="assistant"] .${TIMESTAMP_CLASS},
    [data-message-author-role="model"] .${TIMESTAMP_CLASS} {
      text-align: left;
    }
  `;
    document.head.appendChild(style);
}

function formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    // Less than 1 minute
    if (diff < 60000) {
        return 'just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins}m ago`;
    }

    // Less than 24 hours - show time
    if (diff < 86400000) {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Show date and time
    return new Date(timestamp).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getMessageId(element: Element): string {
    // Try to get a unique ID from the element
    const turnId = element.getAttribute('data-turn-id');
    if (turnId) return turnId;

    // Use text content hash as fallback
    const text = element.textContent?.slice(0, 100) || '';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return `msg-${hash}`;
}

function getMessageSelectors(): string[] {
    return [
        'user-query',
        'model-response',
        '.user-query-container',
        '.model-response',
        '[data-message-author-role="user"]',
        '[data-message-author-role="assistant"]',
        '[data-message-author-role="model"]',
    ];
}

function processMessages(): void {
    const selectors = getMessageSelectors();

    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);

        elements.forEach((element) => {
            // Skip if already processed
            if (element.getAttribute(TIMESTAMP_ATTR)) return;

            // Skip if this element is nested inside another message element we are tracking
            const parentMessage = element.parentElement?.closest(selectors.join(','));
            if (parentMessage) return;

            const msgId = getMessageId(element);

            // Record timestamp if new message
            if (!messageTimestamps.has(msgId)) {
                messageTimestamps.set(msgId, Date.now());
            }

            const timestamp = messageTimestamps.get(msgId)!;

            // Find the best place to insert timestamp
            // Look for content container inside the message
            let contentContainer = element.querySelector('.message-content, .response-content, .presented-content');
            if (!contentContainer) {
                contentContainer = element;
            }

            // Start of duplicate check
            if (contentContainer.querySelector(`.${TIMESTAMP_CLASS}`)) {
                // If it exists but we need to update attribute on parent, do it (idempotent)
                element.setAttribute(TIMESTAMP_ATTR, 'true');
                return;
            }

            // Create timestamp element
            const timestampEl = document.createElement('span');
            timestampEl.className = TIMESTAMP_CLASS;
            timestampEl.textContent = formatTime(timestamp);
            timestampEl.title = new Date(timestamp).toLocaleString();

            contentContainer.appendChild(timestampEl);
            element.setAttribute(TIMESTAMP_ATTR, 'true');
        });
    }
}

function updateTimestamps(): void {
    const timestamps = document.querySelectorAll(`.${TIMESTAMP_CLASS}`);
    timestamps.forEach((el) => {
        const parent = el.closest(`[${TIMESTAMP_ATTR}]`);
        if (!parent) return;

        const msgId = getMessageId(parent);
        const timestamp = messageTimestamps.get(msgId);
        if (timestamp) {
            el.textContent = formatTime(timestamp);
        }
    });
}

export function startMessageTimestamps(): { destroy: () => void } {
    let enabled = true;
    let observerUnsubscribe: (() => void) | null = null;
    let updateInterval: number | null = null;
    let unsubscribeStorage: (() => void) | null = null;

    const init = () => {
        injectStyles();
        processMessages();

        // Update relative times every minute
        updateInterval = window.setInterval(updateTimestamps, 60000);

        // Observe for new messages
        let debounceTimer: number | null = null;
        observerUnsubscribe = sharedObserverPool.register(
            getMessageSelectors(),
            () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = window.setTimeout(processMessages, 200);
            },
            { childList: true, subtree: true },
            () => document.querySelector('main')
        );
    };

    const cleanup = () => {
        if (observerUnsubscribe) {
            observerUnsubscribe();
            observerUnsubscribe = null;
        }
        if (updateInterval) clearInterval(updateInterval);

        // Remove timestamps
        document.querySelectorAll(`.${TIMESTAMP_CLASS}`).forEach(el => el.remove());
        document.querySelectorAll(`[${TIMESTAMP_ATTR}]`).forEach(el => {
            el.removeAttribute(TIMESTAMP_ATTR);
        });

        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
    };

    storageFacade.getSettings({ [StorageKeys.MESSAGE_TIMESTAMPS_ENABLED]: true }, (res) => {
        enabled = res?.[StorageKeys.MESSAGE_TIMESTAMPS_ENABLED] !== false;
        if (enabled) {
            init();
        }
    });

    unsubscribeStorage = storageFacade.subscribe(
        StorageKeys.MESSAGE_TIMESTAMPS_ENABLED,
        (change, area) => {
            if (area !== 'sync') return;
            enabled = change.newValue !== false;
            if (enabled) {
                init();
            } else {
                cleanup();
            }
        },
        { area: 'sync' }
    );

    return {
        destroy: () => {
            cleanup();
            unsubscribeStorage?.();
            unsubscribeStorage = null;
            messageTimestamps.clear();
        },
    };
}
