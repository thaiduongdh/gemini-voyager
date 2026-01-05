# Gemini Voyager Improvement Roadmap

This document outlines a comprehensive plan to improve the code quality, architecture, and stability of the Gemini Voyager extension.

## 1. Executive Summary

The codebase is currently functional with clean TypeScript build and passing unit tests. However, several areas require attention to improve maintainability and scalability:
- **Storage Management:** Keys are scattered as "magic strings", and there are two competing storage abstractions.
- **Performance:** Multiple redundant `MutationObserver` instances run simultaneously.
- **Testing:** Critical feature paths (Timeline, Folder Manager) lack test coverage.
- **Architecture:** `sendToGemini` module integration needs alignment with core patterns.

---

## 2. Phase 1: Code Quality & Consistency (Immediate Priority)

### 1.1 Centralize Storage Keys
**Goal:** Eliminate scattered string literals for storage keys to prevent collisions and typos.

**Current Issues:**
- `Popup.tsx` and content scripts use hardcoded strings like `'geminiSidebarWidth'`, `'geminiEditInputWidth'`.
- `sendToGemini` module has its own `STORAGE_KEYS` object disconnected from the main application.

**Action Items:**
**Status:** Partly In-Progress (Uncommitted changes in `common.ts` and `GoogleDriveSyncService.ts`).

1.  **Update `src/core/types/common.ts`**:
    *Partially done:* `SYNC_*` and `STG_*` keys are locally present but uncommitted.
    Need to ensure all UI keys are added:
    ```typescript
    // UI Customization
    SIDEBAR_WIDTH: 'geminiSidebarWidth',
    EDIT_INPUT_WIDTH: 'geminiEditInputWidth',
    FOLDER_ENABLED: 'geminiFolderEnabled',
    FOLDER_HIDE_ARCHIVED: 'geminiFolderHideArchivedConversations',
    WATERMARK_REMOVER_ENABLED: 'geminiWatermarkRemoverEnabled',
    CHAT_WIDTH_ENABLED: 'gvChatWidthEnabled',
    
    // Feature Flags
    CONVERSATION_STATS_ENABLED: 'gvConversationStatsEnabled',
    MESSAGE_TIMESTAMPS_ENABLED: 'gvMessageTimestampsEnabled',

    // Sync
    SYNC_MODE: 'gvSyncMode',
    SYNC_ACCESS_TOKEN: 'gvAccessToken',
    SYNC_TOKEN_EXPIRY: 'gvTokenExpiry',
    SYNC_LAST_TIME: 'gvLastSyncTime',
    SYNC_LAST_ERROR: 'gvSyncError',

    // SendToGemini (Aliased)
    STG_ENABLED: 'gvSendToGeminiEnabled',
    STG_QUEUE: 'gvSendToGeminiQueue',
    // ... (include all stg keys)
    ```

2.  **Refactor `sendToGemini/storage.ts`**:
    Import `StorageKeys` from `common.ts` and alias them. This maintains the module's internal structure while linking it to the global source of truth.

3.  **Refactor Usage Sites**:
    Replace all string literals in `Popup.tsx`, `GoogleDriveSyncService.ts`, and content scripts with `StorageKeys.*` constants.

---

## 3. Phase 2: Architecture Foundation

### 2.1 Unified Storage Service
**Goal:** Provide a consistent, type-safe API for storage operations across the entire app.

**Current Issues:**
- Mix of `chrome.storage.sync.get`, `chrome.storage.local.get`, and `StorageService` class usage.
- No unified way to subscribe to changes.

**Action Items:**
1.  Create `StorageFacade` class:
    - Wraps both `Sync` and `Local` storage.
    - Provides typed methods: `getSetting<T>(key)`, `getData<T>(key)`.
    - Handles defaults automatically.
2.  Add Subscription System:
    - `storage.subscribe(key, callback)` for type-safe change listeners.
3.  Migrate all direct `chrome.storage` calls to use this facade.

### 2.2 Shared MutationObserver Pool
**Goal:** Reduce CPU overhead from DOM monitoring.

**Current Issues:**
- ~6 separate `MutationObserver` instances watch `document.body` simultaneously (Timeline, Folders, Stats, timestamps, etc.).

**Action Items:**
1.  Create `SharedObserverPool` service.
    - Single observer instance watching the root.
    - Registry of selector-callback pairs.
2.  Refactor features to register with the pool instead of creating their own observers.

---

## 4. Phase 3: Testing & Stability

**Goal:** Increase confidence in core features and prevent regressions.

**Current Status:** Low coverage (~80 tests, mostly utils).

**Action Items:**
1.  **DataBackupService Tests**: Verify backup creation and restoration logic.
2.  **StorageMonitor Tests**: Ensure quota warnings trigger correctly.
3.  **Timeline Manager Tests**: Test node mounting and state sync.
4.  **Folder Manager Tests**: Test conversation organization logic.
5.  **Integration Tests**: Add basic E2E flows (install -> open popup -> change setting).

---

## 5. Phase 4: Developer Experience (Polish)

**Goal:** Make the codebase easier to work with.

**Action Items:**
1.  **Feature Flags**: Implement a system for experimental features (`src/core/features/flags.ts`).
2.  **Lazy Loading**: Only import heavy feature modules (like Timeline) if they are enabled in settings.
3.  **Pre-commit Hooks**: Add Husky/Lint-staged to enforce `lint` and `typecheck` before commit.
4.  **Dev Mode Indicators**: Visual cue in the Popup when running a development build.

---

## Migration Notes

- **Data Safety:** The storage key migration (Phase 1) is purely a code refactor. The actual string values (e.g., `'geminiSidebarWidth'`) will remain unchanged, preserving all user data.
- **Dependencies:** architectural changes (Phase 2) should follow the storage key centralization to ensure a clean foundation.
