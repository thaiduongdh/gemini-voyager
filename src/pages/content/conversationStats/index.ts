/**
 * Conversation Statistics - Shows message counts in the current conversation
 */

import { storageFacade } from '@/core/services/StorageFacade';
import { sharedObserverPool } from '@/core/services/SharedObserverPool';
import { StorageKeys } from '@/core/types/common';

const STATS_CONTAINER_ID = 'gv-conversation-stats';
const POLL_INTERVAL = 2000;

interface ConversationStats {
    userMessages: number;
    modelResponses: number;
    totalTurns: number;
}

function getUserMessageSelectors(): string[] {
    return [
        'user-query',
        '.user-query-container',
        '[data-message-author-role="user"]',
        'div[aria-label="User message"]',
        'div[aria-label="Prompt"]',
        '.user-message',
    ];
}

function getModelResponseSelectors(): string[] {
    return [
        'model-response',
        '.model-response',
        '[data-message-author-role="assistant"]',
        '[data-message-author-role="model"]',
        '.model-message',
        '.response-container',
    ];
}

function countMessages(): ConversationStats {
    const userSelectors = getUserMessageSelectors();
    const modelSelectors = getModelResponseSelectors();

    let userMessages = 0;
    let modelResponses = 0;

    // Count user messages
    for (const selector of userSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            userMessages = elements.length;
            break;
        }
    }

    // Count model responses
    for (const selector of modelSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            modelResponses = elements.length;
            break;
        }
    }

    return {
        userMessages,
        modelResponses,
        totalTurns: userMessages + modelResponses,
    };
}

function createStatsDisplay(stats: ConversationStats): HTMLElement {
    const container = document.createElement('div');
    container.id = STATS_CONTAINER_ID;
    container.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: var(--gm-sys-color-surface-container, #1e1e1e);
    color: var(--gm-sys-color-on-surface, #e3e3e3);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 500;
    font-family: 'Google Sans', sans-serif;
    z-index: 2147483647;
    opacity: 0.95;
    pointer-events: none;
    display: flex;
    gap: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.1);
    backdrop-filter: blur(4px);
  `;

    container.innerHTML = `
    <span title="User messages">👤 ${stats.userMessages}</span>
    <span title="Model responses">🤖 ${stats.modelResponses}</span>
    <span title="Total turns">💬 ${stats.totalTurns}</span>
  `;

    return container;
}

function updateStatsDisplay(): void {
    const stats = countMessages();

    // Don't show if no messages
    if (stats.totalTurns === 0) {
        const existing = document.getElementById(STATS_CONTAINER_ID);
        if (existing) existing.remove();
        return;
    }

    let container = document.getElementById(STATS_CONTAINER_ID);

    if (!container) {
        container = createStatsDisplay(stats);
        document.body.appendChild(container);
    } else {
        container.innerHTML = `
      <span title="User messages">👤 ${stats.userMessages}</span>
      <span title="Model responses">🤖 ${stats.modelResponses}</span>
      <span title="Total turns">💬 ${stats.totalTurns}</span>
    `;
    }
}

export function startConversationStats(): { destroy: () => void } {
    // Check if enabled in storage (default: true)
    let enabled = true;
    let intervalId: number | null = null;
    let observerUnsubscribe: (() => void) | null = null;
    let unsubscribeStorage: (() => void) | null = null;

    const init = () => {
        // Initial update
        updateStatsDisplay();

        // Poll for changes (conversation switches)
        intervalId = window.setInterval(updateStatsDisplay, POLL_INTERVAL);

        // Also observe for DOM changes
        observerUnsubscribe = sharedObserverPool.register(
            ['main', '.conversation-container', 'chat-window'],
            () => {
                updateStatsDisplay();
            },
            { childList: true, subtree: true },
            () => document.querySelector('main')
        );
    };

    storageFacade.getSettings({ [StorageKeys.CONVERSATION_STATS_ENABLED]: true }, (res) => {
        enabled = res?.[StorageKeys.CONVERSATION_STATS_ENABLED] !== false;
        if (enabled) {
            init();
        }
    });

    // Listen for setting changes
    unsubscribeStorage = storageFacade.subscribe(
        StorageKeys.CONVERSATION_STATS_ENABLED,
        (change, area) => {
            if (area !== 'sync') return;
            enabled = change.newValue !== false;
            if (enabled) {
                init();
            } else {
                // Cleanup
                if (intervalId) clearInterval(intervalId);
                if (observerUnsubscribe) {
                    observerUnsubscribe();
                    observerUnsubscribe = null;
                }
                const container = document.getElementById(STATS_CONTAINER_ID);
                if (container) container.remove();
            }
        },
        { area: 'sync' }
    );

    return {
        destroy: () => {
            if (intervalId) clearInterval(intervalId);
            if (observerUnsubscribe) observerUnsubscribe();
            unsubscribeStorage?.();
            const container = document.getElementById(STATS_CONTAINER_ID);
            if (container) container.remove();
        },
    };
}
