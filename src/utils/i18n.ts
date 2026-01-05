import enMessages from '@locales/en/messages.json';
import browser from 'webextension-polyfill';

import { storageFacade } from '@/core/services/StorageFacade';
import { StorageKeys } from '@/core/types/common';

type Language = 'en';

const normalizeLang = (lang: string | undefined): Language => {
  return 'en';
};

const extract = (raw: any): Record<string, string> => {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach((k) => {
      const v = (raw as any)[k];
      if (v && typeof v.message === 'string') out[k] = v.message;
    });
  }
  return out;
};

const dictionaries: Record<Language, Record<string, string>> = {
  en: extract(enMessages as any),
};

/**
 * Get the current language preference
 * 1. First check user's saved preference in storage
 * 2. Fall back to browser UI language
 * 3. Default to English
 */
export async function getCurrentLanguage(): Promise<Language> {
  try {
    // Try to get user's saved language preference
    const stored = await storageFacade.getSetting<string | undefined>(StorageKeys.LANGUAGE);
    if (stored && typeof stored === 'string') {
      return normalizeLang(stored);
    }
  } catch (error) {
    console.warn('[i18n] Failed to get saved language:', error);
  }

  // Fall back to browser UI language
  try {
    const browserLang = browser.i18n.getUILanguage();
    return normalizeLang(browserLang);
  } catch {
    return 'en';
  }
}

/**
 * Get translation for a key using the current language preference
 * This function works in both React and non-React contexts (e.g., content scripts)
 */
export async function getTranslation(key: string): Promise<string> {
  const language = await getCurrentLanguage();
  return dictionaries[language][key] ?? dictionaries.en[key] ?? key;
}

/**
 * Get translation synchronously using cached language
 * This is less accurate but faster for scenarios where async is not possible
 */
let cachedLanguage: Language | null = null;

export function getTranslationSync(key: string): string {
  const language = cachedLanguage || 'en';
  return dictionaries[language][key] ?? dictionaries.en[key] ?? key;
}

/**
 * Initialize the i18n system and cache the current language
 * Should be called early in the application lifecycle
 */
export async function initI18n(): Promise<void> {
  cachedLanguage = await getCurrentLanguage();

  // Listen for language changes
  storageFacade.subscribe(
    StorageKeys.LANGUAGE,
    (change, areaName) => {
      if (areaName === 'sync' && typeof change.newValue === 'string') {
        cachedLanguage = normalizeLang(change.newValue);
      }
    },
    { area: 'sync' }
  );
}

/**
 * Create a translator function that uses cached language
 * This is useful for classes that need a simple t() function
 */
export function createTranslator(): (key: string) => string {
  return (key: string) => getTranslationSync(key);
}
