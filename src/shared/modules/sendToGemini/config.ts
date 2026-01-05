import type { MenuIds, ContextWorkflow, TargetTab, GeminiModel } from './types';

export const MENU_IDS: MenuIds = {
    rootLink: 'ytg-root-link',
    rootPage: 'ytg-root-page',
    sendGemini: 'ytg-send-gemini',
    sendSelectionGemini: 'ytg-send-selection-gemini',
    sendImageGemini: 'ytg-send-image-gemini',
    sendChatgpt: 'ytg-send-chatgpt',
    addQueue: 'ytg-add-queue',
    addQueuePage: 'ytg-add-queue-page',
    addQueueImage: 'ytg-add-queue-image',
    sendLinkGemini: 'ytg-send-link-gemini',
    sendPageGemini: 'ytg-send-page-gemini',
    sendCurrentGemini: 'ytg-send-current-gemini',
    sendCurrentChatgpt: 'ytg-send-current-chatgpt',
    quickGeminiLink: 'ytg-quick-gemini-link',
    quickGeminiPage: 'ytg-quick-gemini-page',
    quickGeminiSelection: 'ytg-quick-gemini-selection',
    quickGeminiImage: 'ytg-quick-gemini-image',
    quickGeminiVideo: 'ytg-quick-gemini-video',
    sendGeminiOptions: 'ytg-send-gemini-options',
    sendGeminiCustomInstruction: 'ytg-send-gemini-custom-instruction',
    sendGeminiNoInstruction: 'ytg-send-gemini-no-instruction',
    sendVideoGemini: 'ytg-send-video-gemini',
} as const;

export interface InstructionPreset {
    id: string;
    label: string;
    icon: string;
    instruction: string;
}

export const INSTRUCTION_PRESETS: InstructionPreset[] = [
    { id: 'summarize', label: 'Summarize', icon: '📝', instruction: 'Summarize the key points concisely.' },
    { id: 'analyze', label: 'Analyze in Depth', icon: '🔍', instruction: 'Analyze this in depth. Identify themes, patterns, and insights.' },
    { id: 'explain', label: 'Explain Simply', icon: '💡', instruction: 'Explain this in simple terms, as if to a beginner.' },
    { id: 'translate', label: 'Translate to English', icon: '🌐', instruction: 'Translate this content to English.' },
    { id: 'critique', label: 'Critical Review', icon: '⚖️', instruction: 'Provide a balanced critical review with pros and cons.' },
];

export const TARGET_URL_PATTERNS: string[] = [
    '*://*.youtube.com/watch*',
    '*://*.youtube.com/shorts/*',
    '*://youtu.be/*',
];

export const DOCUMENT_URL_PATTERNS: string[] = [
    '*://*.youtube.com/watch*',
    '*://*.youtube.com/shorts/*',
];

export const DEFAULT_RANDOM_IMAGE_PROMPT = 'Describe this image in detail.';
export const DEFAULT_TEXT_PROMPT = 'Explain the following text:';
export const DEFAULT_TWO_CLICK_INSTRUCTION = 'summarize';
export const DEFAULT_CONTEXT_WORKFLOW: ContextWorkflow = 'one';
export const DEFAULT_GEMINI_AUTH_USER = '';
export const DEFAULT_TARGET_TAB: TargetTab = 'new';
export const DEFAULT_GEMINI_MODEL: GeminiModel = 'default';
export const DEBUG_LOG_LIMIT = 50;
export const GEMINI_BASE_URL = 'https://gemini.google.com/app';
export const DEFAULT_ANALYTICS_ENABLED = false;
export const TOAST_DURATION_MS = 3000;

export const IMAGE_EXTENSIONS = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.bmp',
    '.svg',
    '.tiff',
    '.avif',
] as const;
