import { describe, it, expect, beforeEach } from 'vitest';

import { DataBackupService } from '../DataBackupService';

type TestPayload = { items: string[] };

const buildBackup = (data: TestPayload, timestamp: string) => ({
  data,
  metadata: {
    timestamp,
    version: '1.0',
    dataSize: JSON.stringify(data).length,
    itemCount: data.items.length,
  },
});

describe('DataBackupService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and restores primary backup', () => {
    const service = new DataBackupService<TestPayload>('test-backup');
    const payload = { items: ['a', 'b'] };

    const ok = service.createPrimaryBackup(payload);
    expect(ok).toBe(true);

    const recovered = service.recoverFromBackup();
    expect(recovered).toEqual(payload);
  });

  it('falls back to emergency backup when primary is stale', () => {
    const service = new DataBackupService<TestPayload>('test-backup');
    const stale = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const fresh = new Date().toISOString();

    localStorage.setItem(
      'gvBackup_test-backup_primary',
      JSON.stringify(buildBackup({ items: ['old'] }, stale))
    );
    localStorage.setItem(
      'gvBackup_test-backup_emergency',
      JSON.stringify(buildBackup({ items: ['new'] }, fresh))
    );

    const recovered = service.recoverFromBackup();
    expect(recovered).toEqual({ items: ['new'] });
  });

  it('captures beforeunload backup', () => {
    const service = new DataBackupService<TestPayload>('test-backup');
    const payload = { items: ['snapshot'] };

    service.setupBeforeUnloadBackup(() => payload);
    window.dispatchEvent(new Event('beforeunload'));

    const raw = localStorage.getItem('gvBackup_test-backup_beforeUnload');
    expect(raw).not.toBeNull();

    const parsed = raw ? (JSON.parse(raw) as { data: TestPayload }) : null;
    expect(parsed?.data).toEqual(payload);
  });
});
