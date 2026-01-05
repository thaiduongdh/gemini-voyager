/**
 * Common types used throughout the application
 * Following strict type safety principles
 */

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export interface IDisposable {
  dispose(): void;
}

export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

/**
 * Brand type for type-safe IDs
 */
export type Brand<K, T> = K & { __brand: T };

export type ConversationId = Brand<string, 'ConversationId'>;
export type FolderId = Brand<string, 'FolderId'>;
export type TurnId = Brand<string, 'TurnId'>;

/**
 * Storage keys - centralized for type safety
 */
export const StorageKeys = {
  // Folder system
  FOLDER_DATA: 'gvFolderData',
  FOLDER_DATA_AISTUDIO: 'gvFolderDataAIStudio',

  // Timeline
  TIMELINE_SCROLL_MODE: 'geminiTimelineScrollMode',
  TIMELINE_HIDE_CONTAINER: 'geminiTimelineHideContainer',
  TIMELINE_DRAGGABLE: 'geminiTimelineDraggable',
  TIMELINE_POSITION: 'geminiTimelinePosition',
  TIMELINE_STARRED_MESSAGES: 'geminiTimelineStarredMessages',
  TIMELINE_SHORTCUTS: 'geminiTimelineShortcuts',

  // UI customization
  CHAT_WIDTH: 'geminiChatWidth',
  SIDEBAR_WIDTH: 'geminiSidebarWidth',
  AISTUDIO_SIDEBAR_WIDTH: 'gvAIStudioSidebarWidth',
  EDIT_INPUT_WIDTH: 'geminiEditInputWidth',
  FOLDER_ENABLED: 'geminiFolderEnabled',
  FOLDER_HIDE_ARCHIVED: 'geminiFolderHideArchivedConversations',
  WATERMARK_REMOVER_ENABLED: 'geminiWatermarkRemoverEnabled',
  CHAT_WIDTH_ENABLED: 'gvChatWidthEnabled',

  // Prompt Manager
  PROMPT_ITEMS: 'gvPromptItems',
  PROMPT_PANEL_LOCKED: 'gvPromptPanelLocked',
  PROMPT_PANEL_POSITION: 'gvPromptPanelPosition',
  PROMPT_TRIGGER_POSITION: 'gvPromptTriggerPosition',
  PROMPT_CUSTOM_WEBSITES: 'gvPromptCustomWebsites',
  PROMPT_TRIGGER_ENABLED: 'gvPromptTriggerEnabled',

  // Global settings
  LANGUAGE: 'language',
  FORMULA_COPY_FORMAT: 'gvFormulaCopyFormat',
  LATEST_VERSION_CACHE: 'gvLatestVersionCache',

  // Feature flags
  CONVERSATION_STATS_ENABLED: 'gvConversationStatsEnabled',
  MESSAGE_TIMESTAMPS_ENABLED: 'gvMessageTimestampsEnabled',

  // Sync
  SYNC_MODE: 'gvSyncMode',
  SYNC_ACCESS_TOKEN: 'gvAccessToken',
  SYNC_TOKEN_EXPIRY: 'gvTokenExpiry',
  SYNC_LAST_TIME: 'gvLastSyncTime',
  SYNC_LAST_ERROR: 'gvSyncError',

  // SendToGemini
  STG_ENABLED: 'gvSendToGeminiEnabled',
  STG_ADVANCED_MENU: 'gvSendToGeminiAdvancedMenu',
  STG_APPEND_INSTRUCTION: 'gvSendToGeminiAppendInstruction',
  STG_MODEL: 'gvSendToGeminiModel',
  STG_TARGET_TAB: 'gvSendToGeminiTargetTab',
  STG_CUSTOM_PROMPT: 'gvSendToGeminiCustomPrompt',
  STG_QUEUE: 'gvSendToGeminiQueue',
  STG_META_CACHE: 'gvSendToGeminiMetaCache',
  STG_DEBUG_LOG: 'gvSendToGeminiDebugLog',
} as const;

export type StorageKey = typeof StorageKeys[keyof typeof StorageKeys];
