export type QueueKind = 'youtube' | 'page' | 'image';

export interface QueueItem {
    url: string;
    kind: QueueKind;
}

export const QUEUE_KINDS = {
    youtube: 'youtube',
    page: 'page',
    image: 'image',
} as const;

export type ContentType =
    | 'video'
    | 'short'
    | 'playlist'
    | 'channel'
    | 'github'
    | 'image'
    | 'page';

export type ContextWorkflow = 'one' | 'two';
export type TargetTab = 'new' | 'active';
export type GeminiModel = 'default' | 'flash' | 'pro' | 'ultra';

export interface ExtensionSettings {
    stg_showFloatingBubble: boolean;
    stg_showAdvancedMenu: boolean;
    stg_appendYoutubeInstruction: boolean;
    stg_contextWorkflow: ContextWorkflow;
    stg_randomImagePrompt: string;
    stg_twoClickInstruction: string;
    stg_geminiAuthUser: string;
    stg_targetTab: TargetTab;
    stg_geminiModel: GeminiModel;
    stg_customPrompt: string;
    stg_videoQueue: QueueItem[];
    stg_videoMetaCache: Record<string, VideoMetadata>;
}

export interface VideoMetadata {
    title: string;
    thumbnail: string;
}

export interface ProcessQueueMessage {
    action: 'process_queue';
    queue: QueueItem[];
    target: 'gemini' | 'chatgpt';
    customPrompt?: string;
}

export interface SendUrlToGeminiMessage {
    action: 'send_url_to_gemini';
    url: string;
}

export interface SendUrlToChatGPTMessage {
    action: 'send_url_to_chatgpt';
    url: string;
}

export interface PromptGeminiMessage {
    action: 'prompt_gemini';
    prompt: string;
    url?: string;
    model?: GeminiModel;
}

export interface SendImageMessage {
    action: 'send_image';
    imageBase64: string;
    prompt?: string;
    model?: GeminiModel;
}

export interface SendVideoMessage {
    action: 'send_video';
    videoBytes?: ArrayBuffer;
    videoBase64?: string;
    mimeType?: string;
    prompt?: string;
    filename?: string;
    model?: GeminiModel;
}

export interface PromptChatGPTMessage {
    action: 'prompt_chatgpt';
    prompt: string;
}

export interface LogEventMessage {
    action: 'log_event';
    level: 'info' | 'error' | 'warn';
    message: string;
    meta?: unknown;
    context?: unknown;
}

export interface TestInjectionMessage {
    action: 'test_injection';
    target?: 'gemini' | 'chatgpt';
}

export interface QueueStatusMessage {
    action: 'queue_status';
    status: 'started' | 'progress' | 'complete' | 'error';
    target: 'gemini' | 'chatgpt';
    current?: number;
    total?: number;
    error?: string;
}

export type ExtensionMessage =
    | ProcessQueueMessage
    | SendUrlToGeminiMessage
    | SendUrlToChatGPTMessage
    | PromptGeminiMessage
    | SendImageMessage
    | SendVideoMessage
    | PromptChatGPTMessage
    | LogEventMessage
    | TestInjectionMessage
    | QueueStatusMessage;

export interface DebugLogEntry {
    timestamp: string;
    level: 'info' | 'error' | 'warn';
    message: string;
    meta?: unknown;
}

export interface MenuIds {
    rootLink: string;
    rootPage: string;
    sendGemini: string;
    sendSelectionGemini: string;
    sendImageGemini: string;
    sendChatgpt: string;
    addQueue: string;
    addQueuePage: string;
    addQueueImage: string;
    sendLinkGemini: string;
    sendPageGemini: string;
    sendCurrentGemini: string;
    sendCurrentChatgpt: string;
    quickGeminiLink: string;
    quickGeminiPage: string;
    quickGeminiSelection: string;
    quickGeminiImage: string;
    quickGeminiVideo: string;
    sendGeminiOptions: string;
    sendGeminiCustomInstruction: string;
    sendGeminiNoInstruction: string;
    sendVideoGemini: string;
}

export interface SplitQueue {
    videos: QueueItem[];
    pages: QueueItem[];
    images: QueueItem[];
}

export interface VideoFetchResult {
    bytes?: ArrayBuffer;
    sizeBytes?: number;
    mimeType?: string;
    error?: string;
}
