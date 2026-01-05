// Floating UI content script for YouTube
// Ported from: Youtube send to Gemini (manual module)

import type { QueueItem } from '../../../../shared/modules/sendToGemini/types';
import { normalizeQueueItem, normalizeQueue, QUEUE_KINDS } from '../../../../shared/modules/sendToGemini/utils';

// Inlined CSS from floating_ui.css
const STG_CSS = `
/* Host element styling (applied via Shadow DOM :host selector) */
:host {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  font-family: 'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif;
  pointer-events: none;
  box-sizing: border-box;
  width: 64px;
  height: 64px;
  overflow: visible;
  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;
  --chatgpt-color: #0f9d7a;
  --chatgpt-hover: #0c7c61;
  --danger-color: #ef4444;
  --danger-hover: #dc2626;
  --bg-color: #0f172a;
  --panel-color: #111827;
  --text-color: #e5e7eb;
  --muted-color: #9ca3af;
  --shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  --border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Main Bubble Button */
.bubble-btn {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(145deg, var(--primary-color), #38bdf8);
  color: #fff;
  box-shadow: 0 14px 32px rgba(37, 99, 235, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.25s ease;
  border: none;
  outline: none;
  pointer-events: auto;
}

.bubble-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 40px rgba(37, 99, 235, 0.55);
}

.bubble-btn:active {
  transform: translateY(0);
}

.bubble-icon {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

/* Expanded Menu */
.menu-container {
  position: absolute;
  bottom: 78px;
  right: 0;
  background: var(--panel-color);
  border-radius: 16px;
  border: var(--border);
  box-shadow: var(--shadow);
  padding: 14px;
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  opacity: 0;
  transform: translateY(16px) scale(0.96);
  pointer-events: none;
  transition: all 0.18s ease;
  transform-origin: bottom right;
}

.menu-container.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.menu-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-header {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--muted-color);
  font-weight: 700;
  margin-bottom: 2px;
}

.row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.action-btn {
  border: var(--border);
  border-radius: 10px;
  padding: 9px 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-color);
  background: #1f2937;
  transition: all 0.18s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 38px;
}

.action-btn:hover {
  background: #273449;
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
}

.action-btn:active {
  transform: translateY(0);
}

.btn-icon {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.4px;
}

/* Specific Button Styles */
.btn-gemini {
  background: rgba(37, 99, 235, 0.12);
  color: #cbdcfb;
  border: 1px solid rgba(56, 189, 248, 0.35);
}

.btn-gemini:hover {
  background: rgba(37, 99, 235, 0.22);
}

.btn-chatgpt {
  background: rgba(15, 157, 122, 0.12);
  color: #c7f1e6;
  border: 1px solid rgba(15, 157, 122, 0.45);
}

.btn-chatgpt:hover {
  background: rgba(15, 157, 122, 0.22);
}

.btn-primary {
  background: linear-gradient(145deg, var(--primary-color), #38bdf8);
  color: white;
  border: none;
}

.btn-primary:hover {
  box-shadow: 0 12px 30px rgba(37, 99, 235, 0.35);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.14);
  color: #fecdd3;
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.22);
}

.btn-ghost {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-color);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.08);
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
  margin: 2px 0;
}

.row-compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* Badge */
.badge {
  background: #111827;
  color: #fef08a;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 800;
  position: absolute;
  top: -6px;
  right: -6px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
  border: 2px solid #1e293b;
  min-width: 18px;
  text-align: center;
  display: none;
}

.status-line {
  font-size: 12px;
  color: var(--muted-color);
  border: var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  background: #0b1323;
}

/* Drag and Drop State */
.bubble-btn.drag-over {
  transform: scale(1.06);
  background: linear-gradient(145deg, #16a34a, #22c55e);
  box-shadow: 0 16px 36px rgba(34, 197, 94, 0.4);
}
`;

function initFloatingUI() {
  // Only run on YouTube
  if (!window.location.hostname.includes('youtube.com')) return;

  // Create Host Element
  const host = document.createElement('div');
  host.id = 'yt-gemini-bubble-host';
  document.body.appendChild(host);

  // Attach Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject Styles
  const style = document.createElement('style');
  style.textContent = STG_CSS;
  shadow.appendChild(style);

  // Create UI Structure
  const container = document.createElement('div');
  container.innerHTML = `
      <div class="menu-container" id="menu">
        
        <!-- Current Video Section -->
      <div class="menu-section">
        <div class="menu-header">Current Video</div>
        <div class="row">
          <button class="action-btn btn-gemini" id="btn-gemini" title="Send to Gemini">
            <span class="btn-icon">G</span>Gemini
            </button>
            <button class="action-btn btn-chatgpt" id="btn-chatgpt" title="Send to ChatGPT">
              <span class="btn-icon">GPT</span>ChatGPT
            </button>
          </div>
          <button class="action-btn" id="btn-add-queue" title="Add to Queue">
            <span class="btn-icon">+</span>Add to Queue
          </button>
        </div>
    
        <div class="divider"></div>
    
        <!-- Queue Section -->
      <div class="menu-section">
          <div class="menu-header" id="queue-label">Queue (0)</div>
          <div class="row row-compact">
            <button class="action-btn btn-primary" id="btn-send-all">
              <span class="btn-icon">>>></span>Send All
            </button>
            <button class="action-btn btn-danger" id="btn-clear">
              <span class="btn-icon">X</span>Clear Queue
            </button>
          </div>
        </div>
    
        <div class="divider"></div>
    
        <div class="menu-section">
          <div class="menu-header">Status & Controls</div>
          <div class="row row-compact">
            <button class="action-btn btn-ghost" id="btn-toggle-advanced" title="Toggle advanced context menu">
              <span class="btn-icon">A</span>Advanced Menu
            </button>
            <button class="action-btn btn-ghost" id="btn-undo" title="Undo last add" disabled>
              <span class="btn-icon">↩</span>Undo Last Add
            </button>
          </div>
          <div class="status-line" id="last-action">Last: Ready</div>
        </div>
    
      </div>
    
      <!-- Bubble Button -->
      <button class="bubble-btn" id="bubble">
        <span class="bubble-icon">G</span>
        <span class="badge" id="badge">0</span>
      </button>
    `;
  shadow.appendChild(container);

  // Elements
  const bubble = shadow.getElementById('bubble') as HTMLButtonElement;
  const menu = shadow.getElementById('menu') as HTMLDivElement;
  const badge = shadow.getElementById('badge') as HTMLSpanElement;
  const queueLabel = shadow.getElementById('queue-label') as HTMLDivElement;

  const btnGemini = shadow.getElementById('btn-gemini') as HTMLButtonElement;
  const btnChatgpt = shadow.getElementById('btn-chatgpt') as HTMLButtonElement;
  const btnAddQueue = shadow.getElementById('btn-add-queue') as HTMLButtonElement;
  const btnSendAll = shadow.getElementById('btn-send-all') as HTMLButtonElement;
  const btnClear = shadow.getElementById('btn-clear') as HTMLButtonElement;
  const btnUndo = shadow.getElementById('btn-undo') as HTMLButtonElement;
  const btnToggleAdvanced = shadow.getElementById('btn-toggle-advanced') as HTMLButtonElement;
  const statusLine = shadow.getElementById('last-action') as HTMLDivElement;

  // State
  let isMenuOpen = false;
  const GEMINI_SHARE_BUTTON_ID = 'ytg-gemini-share-btn';
  const GEMINI_SHARE_STYLE_ID = 'ytg-gemini-share-style';
  const SHARE_PANEL_SELECTOR = 'ytd-unified-share-panel-renderer';
  let lastQueuedUrl: string | null = null;
  let advancedMenuOn = false;

  // Toggle Menu
  bubble.addEventListener('click', () => {
    // Primary Action: Send to Gemini immediately
    chrome.runtime.sendMessage({ action: 'send_url_to_gemini', url: window.location.href });

    // Visual feedback
    const bubbleIcon = bubble.querySelector('.bubble-icon');
    if (bubbleIcon) {
      const originalIcon = bubbleIcon.textContent;
      bubbleIcon.textContent = '🚀';
      setTimeout(() => {
        bubbleIcon.textContent = originalIcon;
      }, 1500);
    }
  });

  bubble.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    isMenuOpen = !isMenuOpen;
    if (isMenuOpen) {
      menu.classList.add('visible');
    } else {
      menu.classList.remove('visible');
    }
  });

  bubble.setAttribute('title', 'Left-click: Send to Gemini\nRight-click: Open Menu');

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== host && isMenuOpen) {
      isMenuOpen = false;
      menu.classList.remove('visible');
    }
  });

  // Logic
  function updateQueueUI(queue: QueueItem[]): void {
    const count = queue.length;
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'block' : 'none';
    queueLabel.textContent = `Queue (${count})`;

    if (count === 0) {
      btnSendAll.style.opacity = '0.5';
      btnSendAll.style.cursor = 'not-allowed';
      btnClear.style.opacity = '0.5';
      btnClear.style.cursor = 'not-allowed';
    } else {
      btnSendAll.style.opacity = '1';
      btnSendAll.style.cursor = 'pointer';
      btnClear.style.opacity = '1';
      btnClear.style.cursor = 'pointer';
    }
  }

  function setLastAction(text: string, undoUrl: string | null = null): void {
    statusLine.textContent = `Last: ${text}`;
    lastQueuedUrl = undoUrl;
    btnUndo.disabled = !undoUrl;
  }

  function updateAdvancedToggleButton(value: boolean): void {
    advancedMenuOn = value;
    btnToggleAdvanced.innerHTML = `<span class="btn-icon">A</span>Advanced: ${advancedMenuOn ? 'On' : 'Off'}`;
  }

  function loadQueue(): void {
    chrome.storage.local.get(['stg_videoQueue'], (result) => {
      updateQueueUI(normalizeQueue(result.stg_videoQueue));
    });
  }

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.stg_videoQueue) {
      updateQueueUI(normalizeQueue(changes.stg_videoQueue.newValue));
    }
    if (area === 'local' && changes.stg_showAdvancedMenu) {
      updateAdvancedToggleButton(changes.stg_showAdvancedMenu.newValue as boolean);
    }
  });

  // Actions
  btnGemini.addEventListener('click', () => {
    setLastAction('Sent to Gemini');
    chrome.runtime.sendMessage({ action: 'send_url_to_gemini', url: window.location.href });
  });

  btnChatgpt.addEventListener('click', () => {
    setLastAction('Sent to ChatGPT');
    chrome.runtime.sendMessage({ action: 'send_url_to_chatgpt', url: window.location.href });
  });

  btnAddQueue.addEventListener('click', () => {
    const url = window.location.href;
    const item = normalizeQueueItem({ url, kind: QUEUE_KINDS.youtube });
    if (!item) {
      setLastAction('Invalid URL');
      return;
    }
    chrome.storage.local.get(['stg_videoQueue'], (result) => {
      const queue = normalizeQueue(result.stg_videoQueue || []);
      if (!queue.some((entry) => entry.url === item.url)) {
        queue.push(item);
        chrome.storage.local.set({ stg_videoQueue: queue }, () => {
          setLastAction('Added to queue', url);
        });

        // Visual feedback
        const originalText = btnAddQueue.innerHTML;
        btnAddQueue.innerHTML = '<span class="btn-icon">OK</span>Added';
        setTimeout(() => {
          btnAddQueue.innerHTML = originalText;
        }, 1500);
      }
    });
  });

  btnSendAll.addEventListener('click', () => {
    chrome.storage.local.get(['stg_videoQueue'], (result) => {
      const queue = normalizeQueue(result.stg_videoQueue);
      if (queue.length > 0) {
        chrome.runtime.sendMessage({ action: 'process_queue', queue, target: 'gemini' });
        setLastAction('Sent entire queue to Gemini');
      } else {
        setLastAction('Queue is empty');
      }
    });
  });

  btnClear.addEventListener('click', () => {
    chrome.storage.local.get(['stg_videoQueue'], (result) => {
      const queue = normalizeQueue(result.stg_videoQueue);
      if (queue.length > 0) {
        chrome.storage.local.set({ stg_videoQueue: [] }, () => setLastAction('Cleared queue'));
      } else {
        setLastAction('Queue is already empty');
      }
    });
  });

  btnUndo.addEventListener('click', () => {
    if (!lastQueuedUrl) return;
    chrome.storage.local.get(['stg_videoQueue'], (result) => {
      const queue = normalizeQueue(result.stg_videoQueue || []);
      const idx = queue.map((item) => item.url).lastIndexOf(lastQueuedUrl!);
      if (idx >= 0) {
        queue.splice(idx, 1);
        chrome.storage.local.set({ stg_videoQueue: queue }, () => {
          setLastAction('Removed last add');
        });
      } else {
        setLastAction('Already removed');
      }
    });
  });

  btnToggleAdvanced.addEventListener('click', () => {
    const next = !advancedMenuOn;
    chrome.storage.local.set({ stg_showAdvancedMenu: next }, () => {
      updateAdvancedToggleButton(next);
    });
  });

  // Drag and Drop Logic
  bubble.addEventListener('dragover', (e) => {
    e.preventDefault();
    bubble.classList.add('drag-over');
  });

  bubble.addEventListener('dragleave', () => {
    bubble.classList.remove('drag-over');
  });

  bubble.addEventListener('drop', (e) => {
    e.preventDefault();
    bubble.classList.remove('drag-over');

    const url = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');

    const droppedItem = normalizeQueueItem(url);
    if (droppedItem) {
      chrome.storage.local.get(['stg_videoQueue'], (result) => {
        const queue = normalizeQueue(result.stg_videoQueue || []);
        if (!queue.some((entry) => entry.url === droppedItem.url)) {
          queue.push(droppedItem);
          chrome.storage.local.set({ stg_videoQueue: queue }, () =>
            setLastAction('Added dropped URL', droppedItem.url)
          );

          // Visual feedback
          const bubbleIcon = bubble.querySelector('.bubble-icon');
          if (bubbleIcon) {
            const originalIcon = bubbleIcon.textContent;
            bubbleIcon.textContent = 'OK';
            setTimeout(() => {
              bubbleIcon.textContent = originalIcon;
            }, 1500);
          }
        }
      });
    } else {
      // Error feedback
      const bubbleIcon = bubble.querySelector('.bubble-icon');
      if (bubbleIcon) {
        const originalIcon = bubbleIcon.textContent;
        bubbleIcon.textContent = '!';
        setTimeout(() => {
          bubbleIcon.textContent = originalIcon;
        }, 1500);
      }
    }
  });

  // Init
  function init(): void {
    loadQueue();

    // Check visibility setting
    chrome.storage.local.get(['stg_showFloatingBubble'], (result) => {
      if (result.stg_showFloatingBubble === false) {
        host.style.display = 'none';
      } else {
        host.style.display = 'block';
      }
    });

    chrome.storage.local.get(['stg_showAdvancedMenu'], (result) => {
      updateAdvancedToggleButton(result.stg_showAdvancedMenu === true);
    });

    watchSharePanelForGeminiButton();
  }

  init();

  // Listen for storage changes (queue and visibility)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.stg_videoQueue) {
        updateQueueUI(normalizeQueue(changes.stg_videoQueue.newValue));
      }
      if (changes.stg_showFloatingBubble) {
        host.style.display = changes.stg_showFloatingBubble.newValue ? 'block' : 'none';
      }
    }
  });

  function ensureGeminiShareStyles(): void {
    if (document.getElementById(GEMINI_SHARE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = GEMINI_SHARE_STYLE_ID;
    style.textContent = `
    .ytg-share-gemini-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 12px;
      background: #e8f0fe;
      color: #174ea6;
      font-weight: 700;
      border: 1px solid #d2e3fc;
      cursor: pointer;
      transition: transform 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
      box-shadow: 0 4px 10px rgba(23, 78, 166, 0.12);
    }
    .ytg-share-gemini-btn:hover {
      background: #dce7fc;
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(23, 78, 166, 0.18);
    }
    .ytg-share-gemini-btn:active {
      transform: translateY(0);
    }
    .ytg-share-gemini-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #2563eb, #38bdf8);
      color: white;
      font-weight: 800;
      font-size: 14px;
    }
    .ytg-share-gemini-label {
      font-size: 14px;
      letter-spacing: 0.2px;
    }
    .ytg-share-gemini-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
  `;
    document.head.appendChild(style);
  }

  function getSharePanelUrl(panel: HTMLElement): string {
    const input = panel.querySelector<HTMLInputElement>(
      'input#share-url, input[aria-label*="Link"], input[aria-label*="URL"], input[type="text"]'
    );
    if (input?.value) return input.value.trim();
    const textarea = panel.querySelector<HTMLTextAreaElement>('textarea');
    if (textarea?.value) return textarea.value.trim();
    return window.location.href;
  }

  function createGeminiShareButton(panel: HTMLElement): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = GEMINI_SHARE_BUTTON_ID;
    btn.type = 'button';
    btn.className = 'ytg-share-gemini-btn';
    btn.setAttribute('title', 'Send to Gemini');

    const icon = document.createElement('span');
    icon.className = 'ytg-share-gemini-icon';
    icon.textContent = 'G';

    const label = document.createElement('span');
    label.className = 'ytg-share-gemini-label';
    label.textContent = 'Send to Gemini';

    btn.appendChild(icon);
    btn.appendChild(label);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = getSharePanelUrl(panel);
      chrome.runtime.sendMessage({ action: 'send_url_to_gemini', url });
    });

    return btn;
  }

  function findShareTargetsContainer(panel: HTMLElement): HTMLElement | null {
    const selectors = [
      '#targets',
      '#target',
      '#target-section',
      'div#targets',
      'div#target-section',
      'div#scrollable-content',
      'div[role="list"]',
    ];
    for (const sel of selectors) {
      const el = panel.querySelector<HTMLElement>(sel);
      if (el) return el;
    }
    const candidate = panel.querySelector('yt-share-target-renderer, ytd-share-target-renderer');
    if (candidate?.parentElement) return candidate.parentElement as HTMLElement;
    return null;
  }

  function injectGeminiButtonIntoPanel(panel: HTMLElement): void {
    if (!panel || panel.dataset.ytgGeminiInjected === 'true') return;
    ensureGeminiShareStyles();

    const container = findShareTargetsContainer(panel) || panel;

    const row = document.createElement('div');
    row.className = 'ytg-share-gemini-row';

    const btn = createGeminiShareButton(panel);
    row.appendChild(btn);

    container.appendChild(row);
    panel.dataset.ytgGeminiInjected = 'true';
  }

  function watchSharePanelForGeminiButton(): void {
    document
      .querySelectorAll<HTMLElement>(SHARE_PANEL_SELECTOR)
      .forEach(injectGeminiButtonIntoPanel);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches?.(SHARE_PANEL_SELECTOR)) {
            injectGeminiButtonIntoPanel(node);
            continue;
          }
          const panel = node.querySelector?.<HTMLElement>(SHARE_PANEL_SELECTOR);
          if (panel) {
            injectGeminiButtonIntoPanel(panel);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// export function to be used by main entry point if needed
export default initFloatingUI;
