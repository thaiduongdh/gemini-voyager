import enMessages from '@locales/en/messages.json';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import browser from 'webextension-polyfill';

import { storageFacade } from '@/core/services/StorageFacade';
import { StorageKeys } from '@/core/types/common';

type Language = 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get initial language from browser UI language
  const getInitialLanguage = (): Language => {
    try {
      const browserLang = browser.i18n.getUILanguage();
      return normalizeLang(browserLang);
    } catch {
      return 'en';
    }
  };

  const [language, setLanguageState] = useState<Language>(getInitialLanguage());

  // Load saved language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const stored = await storageFacade.getSetting<string | undefined>(StorageKeys.LANGUAGE);
        if (stored && typeof stored === 'string') {
          setLanguageState(normalizeLang(stored));
        }
      } catch (error) {
        console.error('Failed to load language preference:', error);
      }
    };
    loadLanguage();
  }, []);

  // Listen for language changes from other tabs/contexts
  useEffect(() => {
    const unsubscribe = storageFacade.subscribe(
      StorageKeys.LANGUAGE,
      (change, areaName) => {
        if (areaName === 'sync' && typeof change.newValue === 'string') {
          setLanguageState(normalizeLang(change.newValue));
        }
      },
      { area: 'sync' }
    );
    return () => {
      unsubscribe();
    };
  }, []);

  const setLanguage = async (lang: Language) => {
    try {
      await storageFacade.setSetting(StorageKeys.LANGUAGE, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  };

  const t = (key: string): string => {
    return dictionaries[language][key] ?? dictionaries.en[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
