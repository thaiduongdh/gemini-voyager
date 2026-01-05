import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

import Popup from '../Popup';

import { StorageKeys } from '@/core/types/common';

const { setSettings, storageFacadeMock } = vi.hoisted(() => {
  const setSettings = vi.fn().mockResolvedValue(undefined);
  const storageFacadeMock = {
    setSettings,
    getSettings: vi.fn((keysOrDefaults: any, callback?: (result: any) => void) => {
      const payload = Array.isArray(keysOrDefaults) ? {} : keysOrDefaults;
      if (typeof callback === 'function') {
        callback(payload);
      }
      return Promise.resolve(payload);
    }),
    getDataMap: vi.fn().mockResolvedValue({}),
    setSetting: vi.fn().mockResolvedValue(undefined),
    setDataMap: vi.fn().mockResolvedValue(undefined),
  };
  return { setSettings, storageFacadeMock };
});

vi.mock('@/core/services/StorageFacade', () => ({
  storageFacade: storageFacadeMock,
}));

vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../components/CloudSyncSettings', () => ({
  CloudSyncSettings: () => null,
}));

vi.mock('../components/KeyboardShortcutSettings', () => ({
  KeyboardShortcutSettings: () => null,
}));

vi.mock('../components/SendToGeminiSettings', () => ({
  SendToGeminiSettings: () => null,
}));

describe('Popup integration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    setSettings.mockClear();
    container.remove();
  });

  it('persists toggle changes to storage', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<Popup />);
    });

    const toggle = container.querySelector('#message-timestamps-enabled') as HTMLInputElement | null;
    expect(toggle).not.toBeNull();

    await act(async () => {
      if (!toggle) return;
      toggle.click();
    });

    expect(setSettings).toHaveBeenCalledWith({
      [StorageKeys.MESSAGE_TIMESTAMPS_ENABLED]: false,
    });

    await act(async () => {
      root.unmount();
    });
  });
});
