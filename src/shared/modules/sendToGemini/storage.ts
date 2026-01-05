/**
 * Centralized storage keys and migration helper for sendToGemini module.
 * Migrates legacy stg_* keys to unified gv* prefix.
 */

import type { QueueItem, GeminiModel, TargetTab } from './types';

/** Storage key names - use these instead of hardcoded strings */
export const STORAGE_KEYS = {
    // Feature toggles
    enabled: 'gvSendToGeminiEnabled',
    advancedMenu: 'gvSendToGeminiAdvancedMenu',
    appendInstruction: 'gvSendToGeminiAppendInstruction',

    // Settings
    model: 'gvSendToGeminiModel',
    targetTab: 'gvSendToGeminiTargetTab',
    customPrompt: 'gvSendToGeminiCustomPrompt',

    // Queue & cache
    queue: 'gvSendToGeminiQueue',
    metaCache: 'gvSendToGeminiMetaCache',

    // Debug
    debugLog: 'gvSendToGeminiDebugLog',
} as const;

/** Legacy key mapping for migration */
const LEGACY_KEY_MAP: Record<string, string> = {
    stg_showFloatingBubble: STORAGE_KEYS.enabled,
    stg_showAdvancedMenu: STORAGE_KEYS.advancedMenu,
    stg_appendYoutubeInstruction: STORAGE_KEYS.appendInstruction,
    stg_geminiModel: STORAGE_KEYS.model,
    stg_targetTab: STORAGE_KEYS.targetTab,
    stg_customPrompt: STORAGE_KEYS.customPrompt,
    stg_videoQueue: STORAGE_KEYS.queue,
    stg_videoMetaCache: STORAGE_KEYS.metaCache,
    stg_debugLog: STORAGE_KEYS.debugLog,
};

/** Default values for settings */
export const STORAGE_DEFAULTS = {
    [STORAGE_KEYS.enabled]: true,
    [STORAGE_KEYS.advancedMenu]: false,
    [STORAGE_KEYS.appendInstruction]: true,
    [STORAGE_KEYS.model]: 'default' as GeminiModel,
    [STORAGE_KEYS.targetTab]: 'new' as TargetTab,
    [STORAGE_KEYS.customPrompt]: '',
    [STORAGE_KEYS.queue]: [] as QueueItem[],
    [STORAGE_KEYS.metaCache]: {} as Record<string, unknown>,
    [STORAGE_KEYS.debugLog]: [] as unknown[],
};

/**
 * Migrate legacy stg_* keys to gv* keys.
 * Call this once on extension startup (background script).
 */
export async function migrateStorageKeys(): Promise<void> {
    const legacyKeys = Object.keys(LEGACY_KEY_MAP);

    return new Promise((resolve) => {
        chrome.storage.local.get(legacyKeys, (result) => {
            const migrations: Record<string, unknown> = {};
            const keysToRemove: string[] = [];

            for (const [oldKey, newKey] of Object.entries(LEGACY_KEY_MAP)) {
                if (oldKey in result && result[oldKey] !== undefined) {
                    migrations[newKey] = result[oldKey];
                    keysToRemove.push(oldKey);
                }
            }

            if (Object.keys(migrations).length === 0) {
                resolve();
                return;
            }

            // Write new keys
            chrome.storage.local.set(migrations, () => {
                // Remove old keys
                chrome.storage.local.remove(keysToRemove, () => {
                    console.log('[SendToGemini] Migrated storage keys:', keysToRemove);
                    resolve();
                });
            });
        });
    });
}

/**
 * Get a setting value with type safety and defaults.
 */
export function getSetting<K extends keyof typeof STORAGE_DEFAULTS>(
    key: K,
    callback: (value: (typeof STORAGE_DEFAULTS)[K]) => void
): void {
    chrome.storage.local.get({ [key]: STORAGE_DEFAULTS[key] }, (result) => {
        callback(result[key] as (typeof STORAGE_DEFAULTS)[K]);
    });
}

/**
 * Set a setting value.
 */
export function setSetting<K extends keyof typeof STORAGE_DEFAULTS>(
    key: K,
    value: (typeof STORAGE_DEFAULTS)[K],
    callback?: () => void
): void {
    chrome.storage.local.set({ [key]: value }, () => {
        if (callback) callback();
    });
}
