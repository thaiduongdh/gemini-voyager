import { describe, it, expect, beforeEach, vi } from 'vitest';

import { FolderManager } from '../manager';

vi.mock('webextension-polyfill', () => ({
  default: {},
}));

vi.mock('@/core/services/StorageFacade', () => ({
  storageFacade: {
    isAvailable: vi.fn().mockReturnValue(false),
    getSettings: vi.fn().mockResolvedValue({}),
    setSetting: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@/utils/i18n', () => ({
  initI18n: vi.fn().mockResolvedValue(undefined),
  getTranslationSync: (key: string) => key,
}));

describe('FolderManager conversation organization', () => {
  let manager: any;

  beforeEach(() => {
    document.body.innerHTML = '<div></div>';
    manager = new FolderManager() as any;
    manager.saveData = vi.fn();
    manager.refresh = vi.fn();
    manager.data = {
      folders: [
        {
          id: 'f1',
          name: 'Folder 1',
          parentId: null,
          isExpanded: true,
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: 'f2',
          name: 'Folder 2',
          parentId: null,
          isExpanded: true,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      folderContents: {
        f1: [],
        f2: [],
      },
    };
  });

  it('adds a conversation once per folder', () => {
    manager.addConversationToFolder('f1', {
      type: 'conversation',
      conversationId: 'c1',
      title: 'Hello',
      url: 'https://example.com/c1',
    });

    expect(manager.data.folderContents.f1).toHaveLength(1);

    manager.addConversationToFolder('f1', {
      type: 'conversation',
      conversationId: 'c1',
      title: 'Hello',
      url: 'https://example.com/c1',
    });

    expect(manager.data.folderContents.f1).toHaveLength(1);
  });

  it('moves a conversation when a source folder is provided', () => {
    manager.data.folderContents.f1 = [
      {
        conversationId: 'c1',
        title: 'Hello',
        url: 'https://example.com/c1',
        addedAt: 1,
      },
    ];

    manager.addConversationToFolder('f2', {
      type: 'conversation',
      conversationId: 'c1',
      title: 'Hello',
      url: 'https://example.com/c1',
      sourceFolderId: 'f1',
    });

    expect(manager.data.folderContents.f1).toHaveLength(0);
    expect(manager.data.folderContents.f2).toHaveLength(1);
    expect(manager.saveData).toHaveBeenCalled();
  });

  it('adds multiple conversations and removes them from the source folder', () => {
    manager.data.folderContents.f1 = [
      {
        conversationId: 'c1',
        title: 'Alpha',
        url: 'https://example.com/c1',
        addedAt: 1,
      },
    ];

    manager.addConversationsToFolder(
      'f2',
      [
        {
          conversationId: 'c1',
          title: 'Alpha',
          url: 'https://example.com/c1',
          addedAt: 1,
        },
        {
          conversationId: 'c2',
          title: 'Beta',
          url: 'https://example.com/c2',
          addedAt: 2,
        },
      ],
      'f1'
    );

    expect(manager.data.folderContents.f2).toHaveLength(2);
    expect(manager.data.folderContents.f1).toHaveLength(0);
  });
});
