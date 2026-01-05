import browser from 'webextension-polyfill';

import { StorageKeys, type StorageKey } from '@/core/types/common';

type StorageAreaName = 'sync' | 'local';

type StorageGetInput<K extends StorageKey> = K[] | Record<K, unknown>;

type StorageDefaultsMap = Partial<Record<StorageKey, unknown>>;

type StorageChange = {
  oldValue?: unknown;
  newValue?: unknown;
};

export const StorageDefaults: StorageDefaultsMap = {
  [StorageKeys.TIMELINE_SCROLL_MODE]: 'flow',
  [StorageKeys.TIMELINE_HIDE_CONTAINER]: false,
  [StorageKeys.TIMELINE_DRAGGABLE]: false,
  [StorageKeys.TIMELINE_POSITION]: null,
  [StorageKeys.FOLDER_ENABLED]: true,
  [StorageKeys.FOLDER_HIDE_ARCHIVED]: false,
  [StorageKeys.CHAT_WIDTH]: 70,
  [StorageKeys.EDIT_INPUT_WIDTH]: 60,
  [StorageKeys.SIDEBAR_WIDTH]: 312,
  [StorageKeys.AISTUDIO_SIDEBAR_WIDTH]: 280,
  [StorageKeys.PROMPT_CUSTOM_WEBSITES]: [],
  [StorageKeys.PROMPT_TRIGGER_ENABLED]: true,
  [StorageKeys.FORMULA_COPY_FORMAT]: 'latex',
  [StorageKeys.WATERMARK_REMOVER_ENABLED]: true,
  [StorageKeys.CHAT_WIDTH_ENABLED]: true,
  [StorageKeys.CONVERSATION_STATS_ENABLED]: true,
  [StorageKeys.MESSAGE_TIMESTAMPS_ENABLED]: true,
  [StorageKeys.LANGUAGE]: 'en',
  [StorageKeys.SYNC_MODE]: 'disabled',
  [StorageKeys.SYNC_LAST_TIME]: null,
  [StorageKeys.SYNC_LAST_ERROR]: null,
  [StorageKeys.STG_ENABLED]: true,
  [StorageKeys.STG_ADVANCED_MENU]: false,
  [StorageKeys.STG_APPEND_INSTRUCTION]: true,
  [StorageKeys.STG_MODEL]: 'default',
  [StorageKeys.STG_TARGET_TAB]: 'new',
  [StorageKeys.STG_CUSTOM_PROMPT]: '',
  [StorageKeys.STG_QUEUE]: [],
  [StorageKeys.STG_META_CACHE]: {},
  [StorageKeys.STG_DEBUG_LOG]: [],
};

const isPromise = (value: unknown): value is Promise<unknown> =>
  !!value && typeof (value as Promise<unknown>).then === 'function';

export class StorageFacade {
  isAvailable(area: StorageAreaName): boolean {
    return !!this.getArea(area);
  }

  private getArea(area: StorageAreaName): chrome.storage.StorageArea | null {
    if (typeof chrome !== 'undefined' && chrome.storage?.[area]) {
      return chrome.storage[area];
    }
    if (typeof browser !== 'undefined' && (browser as any).storage?.[area]) {
      return (browser as any).storage[area] as chrome.storage.StorageArea;
    }
    return null;
  }

  private getChangeEmitter():
    | {
        addListener: (cb: (changes: Record<string, StorageChange>, areaName: string) => void) => void;
        removeListener: (cb: (changes: Record<string, StorageChange>, areaName: string) => void) => void;
      }
    | null {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      return chrome.storage.onChanged;
    }
    if (typeof browser !== 'undefined' && (browser as any).storage?.onChanged) {
      return (browser as any).storage.onChanged;
    }
    return null;
  }

  private withDefaults<K extends StorageKey>(keysOrDefaults: StorageGetInput<K>): StorageGetInput<K> {
    if (Array.isArray(keysOrDefaults)) {
      const defaults: Record<string, unknown> = {};
      for (const key of keysOrDefaults) {
        if (StorageDefaults[key] !== undefined) {
          defaults[key] = StorageDefaults[key];
        }
      }
      return Object.keys(defaults).length > 0 ? (defaults as Record<K, unknown>) : keysOrDefaults;
    }
    return keysOrDefaults;
  }

  private async read<K extends StorageKey>(
    area: StorageAreaName,
    keysOrDefaults: StorageGetInput<K>
  ): Promise<Record<string, unknown>> {
    const storageArea = this.getArea(area);
    if (!storageArea) {
      if (Array.isArray(keysOrDefaults)) {
        return keysOrDefaults.reduce<Record<string, unknown>>((acc, key) => {
          if (StorageDefaults[key] !== undefined) {
            acc[key] = StorageDefaults[key];
          }
          return acc;
        }, {});
      }
      return { ...keysOrDefaults };
    }

    const normalizedInput = this.withDefaults(keysOrDefaults);
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      try {
        const maybePromise = storageArea.get(normalizedInput as any, (items) => {
          if (chrome?.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(items as Record<string, unknown>);
        });
        if (isPromise(maybePromise)) {
          maybePromise.then(resolve).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private async write(area: StorageAreaName, values: Record<string, unknown>): Promise<void> {
    const storageArea = this.getArea(area);
    if (!storageArea) return;
    await new Promise<void>((resolve, reject) => {
      try {
        const maybePromise = storageArea.set(values, () => {
          if (chrome?.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
        if (isPromise(maybePromise)) {
          maybePromise.then(() => resolve()).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private async removeKeys(area: StorageAreaName, keys: StorageKey | StorageKey[]): Promise<void> {
    const storageArea = this.getArea(area);
    if (!storageArea) return;
    await new Promise<void>((resolve, reject) => {
      try {
        const maybePromise = storageArea.remove(keys as any, () => {
          if (chrome?.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
        if (isPromise(maybePromise)) {
          maybePromise.then(() => resolve()).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async getSetting<T>(key: StorageKey, defaultValue?: T): Promise<T> {
    const result = await this.getSettings(
      defaultValue !== undefined ? ({ [key]: defaultValue } as Record<StorageKey, unknown>) : [key]
    );
    return result[key] as T;
  }

  async getData<T>(key: StorageKey, defaultValue?: T): Promise<T> {
    const result = await this.getDataMap(
      defaultValue !== undefined ? ({ [key]: defaultValue } as Record<StorageKey, unknown>) : [key]
    );
    return result[key] as T;
  }

  async getSettings<K extends StorageKey>(
    keysOrDefaults: StorageGetInput<K>,
    callback?: (result: Record<K, unknown>) => void
  ): Promise<Record<K, unknown>> {
    const result = (await this.read('sync', keysOrDefaults)) as Record<K, unknown>;
    if (callback) callback(result);
    return result;
  }

  async getDataMap<K extends StorageKey>(
    keysOrDefaults: StorageGetInput<K>,
    callback?: (result: Record<K, unknown>) => void
  ): Promise<Record<K, unknown>> {
    const result = (await this.read('local', keysOrDefaults)) as Record<K, unknown>;
    if (callback) callback(result);
    return result;
  }

  async setSetting<T>(key: StorageKey, value: T, callback?: () => void): Promise<void> {
    await this.setSettings({ [key]: value } as Record<StorageKey, unknown>, callback);
  }

  async setData<T>(key: StorageKey, value: T, callback?: () => void): Promise<void> {
    await this.setDataMap({ [key]: value } as Record<StorageKey, unknown>, callback);
  }

  async setSettings(values: Record<StorageKey, unknown>, callback?: () => void): Promise<void> {
    await this.write('sync', values);
    if (callback) callback();
  }

  async setDataMap(values: Record<StorageKey, unknown>, callback?: () => void): Promise<void> {
    await this.write('local', values);
    if (callback) callback();
  }

  async removeSetting(keys: StorageKey | StorageKey[], callback?: () => void): Promise<void> {
    await this.removeKeys('sync', keys);
    if (callback) callback();
  }

  async removeData(keys: StorageKey | StorageKey[], callback?: () => void): Promise<void> {
    await this.removeKeys('local', keys);
    if (callback) callback();
  }

  subscribe<K extends StorageKey>(
    key: K,
    callback: (change: StorageChange, areaName: string) => void,
    options?: { area?: StorageAreaName }
  ): () => void {
    const emitter = this.getChangeEmitter();
    if (!emitter) return () => {};

    const handler = (changes: Record<string, StorageChange>, areaName: string) => {
      if (options?.area && areaName !== options.area) return;
      if (changes[key]) {
        callback(changes[key], areaName);
      }
    };

    emitter.addListener(handler);
    return () => emitter.removeListener(handler);
  }
}

export const storageFacade = new StorageFacade();
