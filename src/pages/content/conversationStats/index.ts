/**
 * Conversation Statistics - Shows message counts in the current conversation
 */

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
    ];
}

function getModelResponseSelectors(): string[] {
    return [
        'model-response',
        '.model-response',
        '[data-message-author-role="assistant"]',
        '[data-message-author-role="model"]',
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
    bottom: 80px;
    left: 12px;
    background: var(--gm-sys-color-surface-container, #1e1e1e);
    color: var(--gm-sys-color-on-surface, #e3e3e3);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-family: 'Google Sans', sans-serif;
    z-index: 9999;
    opacity: 0.85;
    pointer-events: none;
    display: flex;
    gap: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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
    let observer: MutationObserver | null = null;

    const init = () => {
        // Initial update
        updateStatsDisplay();

        // Poll for changes (conversation switches)
        intervalId = window.setInterval(updateStatsDisplay, POLL_INTERVAL);

        // Also observe for DOM changes
        const main = document.querySelector('main');
        if (main) {
            observer = new MutationObserver(() => {
                updateStatsDisplay();
            });
            observer.observe(main, { childList: true, subtree: true });
        }
    };

    chrome.storage?.sync?.get({ gvConversationStatsEnabled: true }, (res) => {
        enabled = res?.gvConversationStatsEnabled !== false;
        if (enabled) {
            init();
        }
    });

    // Listen for setting changes
    const storageListener = (changes: any, area: string) => {
        if (area === 'sync' && 'gvConversationStatsEnabled' in changes) {
            enabled = changes.gvConversationStatsEnabled.newValue !== false;
            if (enabled) {
                init();
            } else {
                // Cleanup
                if (intervalId) clearInterval(intervalId);
                if (observer) observer.disconnect();
                const container = document.getElementById(STATS_CONTAINER_ID);
                if (container) container.remove();
            }
        }
    };

    chrome.storage?.onChanged?.addListener(storageListener);

    return {
        destroy: () => {
            if (intervalId) clearInterval(intervalId);
            if (observer) observer.disconnect();
            chrome.storage?.onChanged?.removeListener(storageListener);
            const container = document.getElementById(STATS_CONTAINER_ID);
            if (container) container.remove();
        },
    };
}
