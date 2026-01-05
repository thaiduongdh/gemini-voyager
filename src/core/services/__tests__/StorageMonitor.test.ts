import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { StorageMonitor } from '../StorageMonitor';

const setStorageEstimate = (usage: number, quota: number) => {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      estimate: vi.fn().mockResolvedValue({ usage, quota }),
    },
  });
};

describe('StorageMonitor', () => {
  const originalStorage = navigator.storage;

  beforeEach(() => {
    StorageMonitor.resetInstance();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: originalStorage,
    });
    StorageMonitor.resetInstance();
    vi.restoreAllMocks();
  });

  it('triggers warning callback at threshold', async () => {
    setStorageEstimate(95, 100);
    const monitor = StorageMonitor.getInstance({ showNotifications: true });
    const notify = vi.fn();
    monitor.setNotificationCallback(notify);

    await monitor.checkAndWarn();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toContain('95%');
    expect(notify.mock.calls[0][1]).toBe('error');
  });

  it('does not warn when below thresholds', async () => {
    setStorageEstimate(10, 100);
    const monitor = StorageMonitor.getInstance({ showNotifications: true });
    const notify = vi.fn();
    monitor.setNotificationCallback(notify);

    await monitor.checkAndWarn();

    expect(notify).not.toHaveBeenCalled();
  });

  it('does not repeat warnings for the same threshold', async () => {
    setStorageEstimate(90, 100);
    const monitor = StorageMonitor.getInstance({ showNotifications: true });
    const notify = vi.fn();
    monitor.setNotificationCallback(notify);

    await monitor.checkAndWarn();
    await monitor.checkAndWarn();

    expect(notify).toHaveBeenCalledTimes(1);
  });
});
