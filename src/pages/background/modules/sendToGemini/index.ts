
import type { ExtensionMessage, QueueItem } from '../../../../shared/modules/sendToGemini/types';
import {
    DEFAULT_CONTEXT_WORKFLOW,
    DEFAULT_RANDOM_IMAGE_PROMPT,
    DEFAULT_TWO_CLICK_INSTRUCTION,
    DEFAULT_GEMINI_AUTH_USER,
    DEFAULT_TARGET_TAB,
    DEFAULT_GEMINI_MODEL,
} from '../../../../shared/modules/sendToGemini/config';
import { parseYoutubeVideoId } from '../../../../shared/modules/sendToGemini/utils';
import { fetchTranscript } from './transcript_utils';
import { appendDebugLog } from './logging';
import { updateBadge, splitQueueByKind } from './queue_service';
import {
    handleGemini,
    handleGeminiImage,
    buildGeminiQueuePrompt,
    getStoredRandomImagePrompt,
    loadGeminiAuthUser,
    setGeminiAuthUserCache,
} from './gemini_service';
import { handleChatGPT } from './chatgpt_service';
import { refreshContextMenus, initContextMenus, setupContextMenuListeners } from './context_menus';
// Analytics removed for utilitarian build

function sendQueueStatus(
    status: 'started' | 'progress' | 'complete' | 'error',
    target: 'gemini' | 'chatgpt',
    options?: { current?: number; total?: number; error?: string }
): void {
    chrome.runtime.sendMessage({
        action: 'queue_status',
        status,
        target,
        ...options,
    }).catch(() => {
    });
}

function initListeners() {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.stg_videoQueue) {
                updateBadge();
            }
            if (changes.stg_showAdvancedMenu) {
                refreshContextMenus();
            }
            if (changes.stg_contextWorkflow) {
                refreshContextMenus();
            }
            if (changes.stg_geminiAuthUser) {
                setGeminiAuthUserCache(changes.stg_geminiAuthUser.newValue as string | number | null | undefined);
            }
        }
    });

    chrome.runtime.onMessage.addListener((request: ExtensionMessage) => {
        if (request.action === 'process_queue') {
            const queue: QueueItem[] = request.queue || [];
            const target: string = request.target || 'gemini';
            const customPrompt: string | undefined = request.customPrompt;

            if (queue.length === 0) return;

            if (target === 'gemini') {
                (async () => {
                    sendQueueStatus('started', 'gemini');

                    try {
                        const { videos, pages, images } = splitQueueByKind(queue);
                        const total = (videos.length > 0 || pages.length > 0 ? 1 : 0) + images.length;
                        let current = 0;

                        const promptText = buildGeminiQueuePrompt({ videos, pages }, customPrompt);
                        if (promptText) {
                            handleGemini(null, promptText);
                            current++;
                            sendQueueStatus('progress', 'gemini', { current, total });
                        }
                        if (images.length) {
                            const imagePrompt =
                                customPrompt?.trim() || (await getStoredRandomImagePrompt());
                            for (const item of images) {
                                try {
                                    await handleGeminiImage({ prompt: imagePrompt, imageUrls: [item.url] });
                                    current++;
                                    sendQueueStatus('progress', 'gemini', { current, total });
                                } catch (error) {
                                    console.error('Queue image flow failed', error);
                                }
                            }
                        }

                        appendDebugLog({
                            level: 'info',
                            message: 'Processing queue for Gemini',
                            meta: { videos: videos.length, pages: pages.length, images: images.length },
                        });
                        sendQueueStatus('complete', 'gemini');
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                        sendQueueStatus('error', 'gemini', { error: errorMsg });
                    }
                })();
            } else if (target === 'chatgpt') {
                // ChatGPT Logic similar to original background.ts
                // Ported simplified version:
                (async () => {
                    sendQueueStatus('started', 'chatgpt');
                    try {
                        const { videos } = splitQueueByKind(queue);
                        if (videos.length === 0) {
                            sendQueueStatus('error', 'chatgpt', { error: 'No videos in queue' });
                            return;
                        }

                        let fullTranscript = customPrompt ? `${customPrompt}\n\n` : 'Summarize video transcripts:\n\n';
                        let current = 0;
                        const total = videos.length;

                        for (const item of videos) {
                            const url = item.url;
                            const videoId = parseYoutubeVideoId(url);
                            current++;
                            sendQueueStatus('progress', 'chatgpt', { current, total });

                            if (videoId) {
                                try {
                                    const t = await fetchTranscript(videoId);
                                    fullTranscript += `--- ${url} ---\n${t}\n\n`;
                                } catch (e) {
                                    fullTranscript += `--- ${url} ---\n[Failed: ${e}]\n\n`;
                                }
                            }
                        }

                        const chatgptUrl = 'https://chatgpt.com/';
                        chrome.tabs.create({ url: chatgptUrl }, (newTab) => {
                            if (!newTab?.id) return;
                            const tabId = newTab.id;
                            const listener = (updatedTabId: number, changeInfo: any) => {
                                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                                    chrome.scripting.executeScript(
                                        {
                                            target: { tabId },
                                            files: ['modules/sendToGemini/chatgpt_injector.js'],
                                        },
                                        () => {
                                            setTimeout(() => {
                                                chrome.tabs.sendMessage(tabId, {
                                                    action: 'prompt_chatgpt',
                                                    prompt: fullTranscript,
                                                });
                                                sendQueueStatus('complete', 'chatgpt');
                                            }, 1000);
                                        }
                                    );
                                    chrome.tabs.onUpdated.removeListener(listener);
                                }
                            };
                            chrome.tabs.onUpdated.addListener(listener);
                        });

                    } catch (error) {
                        sendQueueStatus('error', 'chatgpt', { error: String(error) });
                    }
                })();
            }
        } else if (request.action === 'send_url_to_gemini') {
            handleGemini(request.url);
        } else if (request.action === 'send_url_to_chatgpt') {
            handleChatGPT(request.url);
        } else if (request.action === 'log_event') {
            appendDebugLog({
                level: request.level || 'info',
                message: request.message || '',
                meta: request.meta || request.context || null,
            });
        }
    });
}

function initStorageDefaults() {
    chrome.storage.local.get(
        [
            'stg_showFloatingBubble',
            'stg_showAdvancedMenu',
            'stg_contextWorkflow',
            'stg_randomImagePrompt',
            'stg_twoClickInstruction',
            'stg_geminiAuthUser',
            'stg_targetTab',
            'stg_geminiModel',
        ],
        (result) => {
            const defaults: Record<string, unknown> = {};
            if (result.stg_showFloatingBubble === undefined) defaults.stg_showFloatingBubble = true;
            if (result.stg_showAdvancedMenu === undefined) defaults.stg_showAdvancedMenu = false;
            if (result.stg_contextWorkflow === undefined) defaults.stg_contextWorkflow = DEFAULT_CONTEXT_WORKFLOW;
            if (result.stg_randomImagePrompt === undefined)
                defaults.stg_randomImagePrompt = DEFAULT_RANDOM_IMAGE_PROMPT;
            if (result.stg_twoClickInstruction === undefined)
                defaults.stg_twoClickInstruction = DEFAULT_TWO_CLICK_INSTRUCTION;
            if (result.stg_geminiAuthUser === undefined) defaults.stg_geminiAuthUser = DEFAULT_GEMINI_AUTH_USER;
            if (result.stg_targetTab === undefined) defaults.stg_targetTab = DEFAULT_TARGET_TAB;
            if (result.stg_geminiModel === undefined) defaults.stg_geminiModel = DEFAULT_GEMINI_MODEL;
            if (Object.keys(defaults).length) {
                chrome.storage.local.set(defaults, refreshContextMenus);
            } else {
                refreshContextMenus();
            }
        }
    );
}

export function initSendToGeminiModule() {

    initStorageDefaults();
    updateBadge();
    loadGeminiAuthUser();
    initContextMenus();
    setupContextMenuListeners();
    initListeners();
}
