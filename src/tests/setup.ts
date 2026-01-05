/**
 * Test setup file
 * Configure test environment
 */

import { vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({
  default: {
    i18n: {
      getUILanguage: () => 'en',
    },
    runtime: {
      id: 'test',
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
      sync: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
    },
  },
}));

// Mock chrome API
globalThis.chrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    lastError: null,
  },
} as any;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Also expose localStorage globally (not just on window)
globalThis.localStorage = localStorageMock as any;

// Expose document globally
globalThis.document = window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Avoid jsdom canvas warnings during tests.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => null,
});

// Mock DOM API
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
