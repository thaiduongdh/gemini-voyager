import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TimelineManager } from '../manager';

vi.mock('@/core/services/StorageFacade', () => ({
  storageFacade: {
    isAvailable: vi.fn().mockReturnValue(false),
    getSettings: vi.fn().mockResolvedValue({}),
    subscribe: vi.fn().mockReturnValue(() => {}),
    setSetting: vi.fn(),
  },
}));

vi.mock('@/core/services/KeyboardShortcutService', () => ({
  keyboardShortcutService: {
    init: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('../StarredMessagesService', () => ({
  StarredMessagesService: {
    getStarredMessagesForConversation: vi.fn().mockResolvedValue([]),
    addStarredMessage: vi.fn(),
    removeStarredMessage: vi.fn(),
  },
}));

describe('TimelineManager', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <div class="user-query-bubble-with-background">First</div>
        <div class="model-response">Reply 1</div>
        <div class="user-query-bubble-with-background">Second</div>
        <div class="model-response">Reply 2</div>
      </main>
    `;

    (globalThis as any).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    (globalThis as any).IntersectionObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts dots and syncs when turns change', async () => {
    const manager = new TimelineManager();
    await manager.init();

    (manager as any).recalculateAndRenderMarkers();
    expect(document.querySelectorAll('.timeline-dot')).toHaveLength(2);

    const main = document.querySelector('main') as HTMLElement;
    const newUser = document.createElement('div');
    newUser.className = 'user-query-bubble-with-background';
    newUser.textContent = 'Third';
    main.appendChild(newUser);

    (manager as any).recalculateAndRenderMarkers();
    expect(document.querySelectorAll('.timeline-dot')).toHaveLength(3);

    manager.destroy();
  });
});
