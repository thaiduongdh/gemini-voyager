
import type { ContextWorkflow } from '../../../../shared/modules/sendToGemini/types';
import {
    MENU_IDS,
    TARGET_URL_PATTERNS,
    DOCUMENT_URL_PATTERNS,
    DEFAULT_CONTEXT_WORKFLOW,
    DEFAULT_TEXT_PROMPT,
    INSTRUCTION_PRESETS,
} from '../../../../shared/modules/sendToGemini/config';
import { detectContentType, isHttpUrl, QUEUE_KINDS } from '../../../../shared/modules/sendToGemini/utils';
import { STORAGE_KEYS } from '../../../../shared/modules/sendToGemini/storage';
import { appendDebugLog } from './logging';
import { handleGemini, handleGeminiImage, handleGeminiVideo } from './gemini_service';
import { handleChatGPT } from './chatgpt_service';
import { addQueueItem } from './queue_service';

import { storageFacade } from '@/core/services/StorageFacade';

let contextMenuRefreshInProgress = false;
let contextMenuRefreshQueued = false;
let menusInitialized = false;
let lastMenuMode: boolean | null = null;
let lastWorkflowMode: ContextWorkflow | null = null;
let contextWorkflowMode: ContextWorkflow = DEFAULT_CONTEXT_WORKFLOW;

const PRESET_MENU_PREFIX = 'ytg-preset-';

function normalizeContextWorkflow(value: unknown): ContextWorkflow {
    return String(value || '').toLowerCase() === 'two' ? 'two' : 'one';
}

function setContextWorkflowMode(value: unknown): void {
    contextWorkflowMode = normalizeContextWorkflow(value);
}

// Ensure listeners are added only once by exposing init function
export function initContextMenus() {
    // Context workflow is simplified - use default
    setContextWorkflowMode(DEFAULT_CONTEXT_WORKFLOW);

    // Dynamic menu updates
    const onShown = (chrome.contextMenus as any).onShown;
    if (onShown && !onShown.hasListeners()) { // Prevent duplicate listeners if possible, though 'hasListeners' checks current instance
        onShown.addListener((info: chrome.contextMenus.OnClickData) => {
            // ... logic same as original ...
            // Simplified for brevity, assume full logic copy
            // ACTUALLY I MUST COPY THE LOGIC or it won't work.
            // Since I don't have 'hasListeners' properly typed usually, I'll just add it.
            // However, if initContextMenus is called once, valid.
            handleOnShown(info);
        });
    }

    refreshContextMenus();
}

function handleOnShown(info: chrome.contextMenus.OnClickData) {
    if (contextMenuRefreshInProgress) return;
    const hasSelection = Boolean(info.selectionText?.trim());
    const isImage = info.mediaType === 'image';
    const isVideo = info.mediaType === 'video';
    const hasLink = Boolean(info.linkUrl);
    const showVideoAction = isVideo && isHttpUrl(info.srcUrl);

    const labelUrl = hasLink
        ? info.linkUrl
        : isVideo
            ? info.frameUrl || info.pageUrl
            : info.pageUrl;
    const contentType = detectContentType(labelUrl);
    const isYoutubeTarget = isYoutubeUrl(info.pageUrl) || isYoutubeUrl(info.linkUrl);
    const actionLabel = getActionLabel(contentType, isVideo);

    const hideImageOnYoutube = isYoutubeTarget && hasLink;
    const showImageAction = isImage && !hideImageOnYoutube;

    if (lastMenuMode === false) {
        chrome.contextMenus.update(MENU_IDS.quickGeminiSelection, { visible: hasSelection });
        chrome.contextMenus.update(MENU_IDS.quickGeminiImage, { visible: showImageAction });
        chrome.contextMenus.update(MENU_IDS.quickGeminiVideo, {
            visible: showVideoAction,
            title: actionLabel,
        });

        if (lastWorkflowMode === 'one') {
            chrome.contextMenus.update(MENU_IDS.quickGeminiLink, { title: actionLabel });
            chrome.contextMenus.update(MENU_IDS.quickGeminiPage, { title: actionLabel });
        }
    } else if (lastMenuMode === true) {
        chrome.contextMenus.update(MENU_IDS.sendSelectionGemini, { visible: hasSelection });
        chrome.contextMenus.update(MENU_IDS.sendImageGemini, { visible: showImageAction });
        chrome.contextMenus.update(MENU_IDS.sendVideoGemini, {
            visible: showVideoAction,
            title: actionLabel,
        });

        if (lastWorkflowMode === 'one') {
            chrome.contextMenus.update(MENU_IDS.sendLinkGemini, { title: actionLabel });
            chrome.contextMenus.update(MENU_IDS.sendPageGemini, { title: actionLabel });
        }

        const showYoutubeTree = !isYoutubeTarget;
        chrome.contextMenus.update(MENU_IDS.rootLink, { visible: showYoutubeTree && hasLink });
        chrome.contextMenus.update(MENU_IDS.rootPage, { visible: showYoutubeTree && !hasLink && !hasSelection && !isImage && !isVideo });
    }

    (chrome.contextMenus as any).refresh?.();
}


function getContextUrl(info: chrome.contextMenus.OnClickData): string {
    return info.linkUrl || info.pageUrl || info.srcUrl || '';
}

function isYoutubeUrl(url: string | undefined): boolean {
    if (!url) return false;
    try {
        const host = new URL(url).hostname.replace(/^(www\.|m\.|music\.|gaming\.)/, '');
        return host === 'youtube.com' || host === 'youtu.be';
    } catch {
        return false;
    }
}

function getActionLabel(contentType: string, isVideo: boolean): string {
    if (isVideo) return '🎬 Send Video to Gemini';

    switch (contentType) {
        case 'short': return '📱 Analyze YouTube Short';
        case 'playlist': return '📋 Analyze Playlist';
        case 'channel': return '📺 Analyze Channel';
        case 'video': return '🎬 Watch Video on Gemini';
        case 'github': return '💻 Analyze GitHub Code';
        case 'image': return '🖼️ Analyze Image';
        case 'page': return '📄 Summarize Page';
        default: return '🚀 Send to Gemini';
    }
}

function createPresetSubmenu(parentId: string): void {
    INSTRUCTION_PRESETS.forEach((preset) => {
        chrome.contextMenus.create({
            id: `${PRESET_MENU_PREFIX}${preset.id}`,
            parentId,
            title: `${preset.icon} ${preset.label}`,
            contexts: ['link', 'page'],
        });
    });

    chrome.contextMenus.create({
        id: `${PRESET_MENU_PREFIX}separator`,
        parentId,
        type: 'separator',
        contexts: ['link', 'page'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.sendGeminiNoInstruction,
        parentId,
        title: '📤 Just Send URL',
        contexts: ['link', 'page'],
    });
}

function createQuickMenus(workflow: ContextWorkflow): void {
    if (workflow === 'one') {
        chrome.contextMenus.create({
            id: MENU_IDS.quickGeminiLink,
            title: '🚀 Send to Gemini',
            contexts: ['link'],
        });

        chrome.contextMenus.create({
            id: MENU_IDS.quickGeminiPage,
            title: '🚀 Send to Gemini',
            contexts: ['page'],
        });
    } else {
        chrome.contextMenus.create({
            id: MENU_IDS.sendGeminiOptions,
            title: '✨ Send to Gemini...',
            contexts: ['link', 'page'],
        });
        createPresetSubmenu(MENU_IDS.sendGeminiOptions);
    }

    chrome.contextMenus.create({
        id: MENU_IDS.quickGeminiSelection,
        title: '💬 Explain Selection',
        contexts: ['selection'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.quickGeminiImage,
        title: '🖼️ Analyze Image',
        contexts: ['image'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.quickGeminiVideo,
        title: '🎬 Analyze Video',
        contexts: ['video'],
    });
}

function createAdvancedMenus(workflow: ContextWorkflow): void {
    if (workflow === 'one') {
        chrome.contextMenus.create({
            id: MENU_IDS.sendLinkGemini,
            title: '🚀 Send to Gemini',
            contexts: ['link'],
        });

        chrome.contextMenus.create({
            id: MENU_IDS.sendPageGemini,
            title: '🚀 Send to Gemini',
            contexts: ['page'],
        });
    } else {
        chrome.contextMenus.create({
            id: MENU_IDS.sendGeminiOptions,
            title: '✨ Send to Gemini...',
            contexts: ['link', 'page'],
        });
        createPresetSubmenu(MENU_IDS.sendGeminiOptions);
    }

    chrome.contextMenus.create({
        id: MENU_IDS.rootLink,
        title: '🎬 YouTube Actions',
        contexts: ['link'],
        targetUrlPatterns: TARGET_URL_PATTERNS,
    });

    chrome.contextMenus.create({
        id: MENU_IDS.sendGemini,
        parentId: MENU_IDS.rootLink,
        title: '🚀 Send to Gemini',
        contexts: ['link'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.sendChatgpt,
        parentId: MENU_IDS.rootLink,
        title: '💬 Send to ChatGPT (Transcript)',
        contexts: ['link'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.addQueue,
        title: '📥 Add Link to Queue',
        contexts: ['link'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.addQueuePage,
        title: '📥 Add Page to Queue',
        contexts: ['page'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.addQueueImage,
        title: '📥 Add Image to Queue',
        contexts: ['image'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.rootPage,
        title: '🎬 YouTube Actions',
        contexts: ['page'],
        documentUrlPatterns: DOCUMENT_URL_PATTERNS,
    });

    chrome.contextMenus.create({
        id: MENU_IDS.sendCurrentGemini,
        parentId: MENU_IDS.rootPage,
        title: '🚀 Send to Gemini',
        contexts: ['page'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.sendCurrentChatgpt,
        parentId: MENU_IDS.rootPage,
        title: '💬 Send to ChatGPT',
        contexts: ['page'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.sendSelectionGemini,
        title: '💬 Explain Selection',
        contexts: ['selection'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.sendImageGemini,
        title: '🖼️ Analyze Image',
        contexts: ['image'],
    });

    chrome.contextMenus.create({
        id: MENU_IDS.sendVideoGemini,
        title: '🎬 Analyze Video',
        contexts: ['video'],
    });
}

export function refreshContextMenus(): void {
    if (contextMenuRefreshInProgress) {
        contextMenuRefreshQueued = true;
        return;
    }
    contextMenuRefreshInProgress = true;

    void storageFacade.getDataMap(
        { [STORAGE_KEYS.advancedMenu]: false },
        (result) => {
            const advancedMenu = result[STORAGE_KEYS.advancedMenu];
            const workflow = contextWorkflowMode;

            if (menusInitialized && lastMenuMode === advancedMenu && lastWorkflowMode === workflow) {
                contextMenuRefreshInProgress = false;
                return;
            }

            chrome.contextMenus.removeAll(() => {
                if (advancedMenu) {
                    createAdvancedMenus(workflow);
                } else {
                    createQuickMenus(workflow);
                }

                menusInitialized = true;
                lastMenuMode = Boolean(advancedMenu);
                lastWorkflowMode = workflow;
                contextMenuRefreshInProgress = false;

                appendDebugLog({
                    level: 'info',
                    message: 'Context menus refreshed',
                    meta: { advancedMenu, workflow },
                });

                if (contextMenuRefreshQueued) {
                    contextMenuRefreshQueued = false;
                    refreshContextMenus();
                }
            });
        }
    );
}

// Global click listener for context menus (must remain top-level or registered in init)
// I'll register it top-level but inside the file, it will be executed when imported?
// No, imports just execute side effects.
// I should move this listener INSIDE initContextMenus or export it.
// Listeners are persistent. If I register it multiple times (e.g. reload extension), it's fine.
// But calling 'init' multiple times might double register.
// I will export a setup function.

export function setupContextMenuListeners() {
    chrome.contextMenus.onClicked.addListener((info) => {
        let targetUrl = getContextUrl(info);
        if (
            info.menuItemId === MENU_IDS.quickGeminiPage ||
            info.menuItemId === MENU_IDS.sendCurrentGemini ||
            info.menuItemId === MENU_IDS.sendCurrentChatgpt ||
            info.menuItemId === MENU_IDS.sendPageGemini
        ) {
            targetUrl = info.pageUrl || targetUrl;
        }

        const menuId = String(info.menuItemId);

        if (menuId.startsWith(PRESET_MENU_PREFIX)) {
            const presetId = menuId.replace(PRESET_MENU_PREFIX, '');
            if (presetId === 'separator') return;

            const preset = INSTRUCTION_PRESETS.find((p) => p.id === presetId);
            if (preset && targetUrl) {
                const prompt = `${targetUrl}\n\n${preset.instruction}`;
                handleGemini(null, prompt);
                appendDebugLog({
                    level: 'info',
                    message: `Sent to Gemini with preset: ${preset.label}`,
                    meta: { url: targetUrl, preset: preset.id },
                });
            }
            return;
        }

        switch (info.menuItemId) {
            case MENU_IDS.quickGeminiLink:
            case MENU_IDS.sendGemini:
            case MENU_IDS.quickGeminiPage:
            case MENU_IDS.sendCurrentGemini:
            case MENU_IDS.sendLinkGemini:
            case MENU_IDS.sendPageGemini:
                if (!targetUrl) break;
                handleGemini(targetUrl);
                appendDebugLog({
                    level: 'info',
                    message: 'Sent URL to Gemini',
                    meta: { url: targetUrl, source: info.menuItemId },
                });
                break;

            case MENU_IDS.sendGeminiNoInstruction:
                if (!targetUrl) break;
                handleGemini(null, targetUrl);
                break;

            case MENU_IDS.quickGeminiSelection:
            case MENU_IDS.sendSelectionGemini: {
                const selectionText = (info.selectionText || '').trim();
                if (!selectionText) break;
                const prompt = `${DEFAULT_TEXT_PROMPT}\n\n${selectionText}`;
                handleGemini(null, prompt);
                break;
            }

            case MENU_IDS.quickGeminiImage:
            case MENU_IDS.sendImageGemini:
                if (info.srcUrl) {
                    handleGeminiImage({ imageUrls: [info.srcUrl] }).catch((error) =>
                        console.error('Image flow failed', error)
                    );
                }
                break;

            case MENU_IDS.sendChatgpt:
            case MENU_IDS.sendCurrentChatgpt:
                handleChatGPT(targetUrl);
                break;

            case MENU_IDS.addQueue:
                addQueueItem(info.linkUrl || targetUrl, menuId);
                break;

            case MENU_IDS.addQueuePage:
                addQueueItem(info.pageUrl || targetUrl, menuId);
                break;

            case MENU_IDS.addQueueImage:
                if (info.srcUrl) {
                    addQueueItem({ url: info.srcUrl, kind: QUEUE_KINDS.image }, menuId);
                }
                break;

            case MENU_IDS.quickGeminiVideo:
            case MENU_IDS.sendVideoGemini: {
                const videoUrl = info.srcUrl || '';
                if (!videoUrl) break;
                handleGeminiVideo({ videoUrl });
                break;
            }
        }
    });
}
