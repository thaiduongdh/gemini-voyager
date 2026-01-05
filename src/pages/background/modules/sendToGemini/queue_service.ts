
import type { QueueItem } from '../../../../shared/modules/sendToGemini/types';
import { normalizeQueueItem, normalizeQueue, QUEUE_KINDS } from '../../../../shared/modules/sendToGemini/utils';
import { appendDebugLog } from './logging';

let badgeTimeout: ReturnType<typeof setTimeout> | null = null;

function setBadge(count: number): void {
    if (badgeTimeout) return;
    if (count > 0) {
        chrome.action.setBadgeText({ text: String(count) });
        chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

export function showTemporaryBadge(text: string, color = '#4caf50'): void {
    if (badgeTimeout) clearTimeout(badgeTimeout);
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
    badgeTimeout = setTimeout(() => {
        badgeTimeout = null;
        updateBadge();
    }, 2000);
}

export function updateBadge(): void {
    chrome.storage.local.get(['stg_videoQueue'], (result) => {
        const queue = result.stg_videoQueue || [];
        setBadge(queue.length);
    });
}

export function addQueueItem(item: string | { url: string; kind?: string }, source: string): void {
    const normalized = normalizeQueueItem(item);
    if (!normalized) {
        appendDebugLog({
            level: 'error',
            message: 'Queue add failed: invalid URL',
            meta: { source },
        });
        return;
    }
    chrome.storage.local.get(['stg_videoQueue'], (result) => {
        const queue = normalizeQueue(result.stg_videoQueue || []);
        if (queue.some((entry) => entry.url === normalized.url)) return;
        queue.push(normalized);
        chrome.storage.local.set({ stg_videoQueue: queue }, updateBadge);
        appendDebugLog({
            level: 'info',
            message: 'Added item to queue via context menu',
            meta: { url: normalized.url, kind: normalized.kind, source },
        });
    });
}

export function splitQueueByKind(queue: QueueItem[]): {
    items: QueueItem[];
    videos: QueueItem[];
    pages: QueueItem[];
    images: QueueItem[];
} {
    const items = normalizeQueue(queue);
    return {
        items,
        videos: items.filter((item) => item.kind === QUEUE_KINDS.youtube),
        pages: items.filter((item) => item.kind === QUEUE_KINDS.page),
        images: items.filter((item) => item.kind === QUEUE_KINDS.image),
    };
}
