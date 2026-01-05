
import { DEBUG_LOG_LIMIT } from '../../../../shared/modules/sendToGemini/config';
import { STORAGE_KEYS } from '../../../../shared/modules/sendToGemini/storage';

interface LogEntry {
    level?: 'info' | 'error' | 'warn';
    message?: string;
    meta?: unknown;
}

interface StoredLogEntry {
    ts: number;
    level: 'info' | 'error' | 'warn';
    message: string;
    meta: unknown;
}

export function appendDebugLog(entry: LogEntry): void {
    const payload: StoredLogEntry = {
        ts: Date.now(),
        level: entry.level || 'info',
        message: entry.message || '',
        meta: entry.meta || null,
    };

    chrome.storage.local.get({ [STORAGE_KEYS.debugLog]: [] }, (result) => {
        const rawLog = result[STORAGE_KEYS.debugLog];
        const list: StoredLogEntry[] = Array.isArray(rawLog) ? (rawLog as StoredLogEntry[]) : [];
        list.push(payload);
        if (list.length > DEBUG_LOG_LIMIT) {
            list.splice(0, list.length - DEBUG_LOG_LIMIT);
        }
        chrome.storage.local.set({ [STORAGE_KEYS.debugLog]: list });
    });
}
