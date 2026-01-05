
import type { QueueItem, GeminiModel, TargetTab, VideoFetchResult } from '../../../../shared/modules/sendToGemini/types';
import { detectContentType, isHttpUrl } from '../../../../shared/modules/sendToGemini/utils';
import {
    DEFAULT_GEMINI_AUTH_USER,
    DEFAULT_TARGET_TAB,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_RANDOM_IMAGE_PROMPT,
    GEMINI_BASE_URL,
} from '../../../../shared/modules/sendToGemini/config';
import { appendDebugLog } from './logging';
import { showTemporaryBadge } from './queue_service';

let geminiAuthUser = DEFAULT_GEMINI_AUTH_USER;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const DEFAULT_VIDEO_PROMPT = 'Watch this video and summarize key points.';

function normalizeGeminiAuthUser(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

export function setGeminiAuthUserCache(value: string | number | null | undefined): void {
    geminiAuthUser = normalizeGeminiAuthUser(value);
}

export function loadGeminiAuthUser(): void {
    chrome.storage.local.get(
        { stg_geminiAuthUser: DEFAULT_GEMINI_AUTH_USER },
        ({ stg_geminiAuthUser }) => {
            setGeminiAuthUserCache(stg_geminiAuthUser as string | number | null | undefined);
        }
    );
}

export function buildGeminiPromptForUrl(
    url: string,
    customPrompt: string | null = null,
    appendInstruction = true
): string {
    if (!url) return '';

    const type = detectContentType(url);

    if (customPrompt) return `${url}\n\n${customPrompt}`;

    if (type === 'short') {
        return appendInstruction
            ? `${url}\n\nWatch and analyze this YouTube Short. Focus on the visual trends and quick narrative.`
            : url;
    }

    if (type === 'playlist') {
        return appendInstruction
            ? `${url}\n\nAnalyze this YouTube Playlist. Summarize the common themes and topics covered across these videos.`
            : url;
    }

    if (type === 'channel') {
        return appendInstruction
            ? `${url}\n\nAnalyze this YouTube Channel. Describe its content niche, typical video style, and target audience.`
            : url;
    }

    if (type === 'video') {
        return appendInstruction ? `${url}\n\nWatch, summarize and comment on this video.` : url;
    }

    if (type === 'github') {
        return `Analyze this GitHub repository/file. Explain its purpose, structure, and key functionality:\n${url}`;
    }

    return `Summarize and comment on this page:\n${url}`;
}

export function buildGeminiQueuePrompt(
    { videos, pages }: { videos: QueueItem[]; pages: QueueItem[] },
    customPrompt?: string
): string {
    const total = videos.length + pages.length;
    if (total === 0) return '';

    const trimmedPrompt = customPrompt?.trim();
    const lines: string[] = [];

    if (trimmedPrompt) {
        lines.push(trimmedPrompt);
    } else {
        if (total > 1) {
            lines.push(`Analyze the following ${total} items.`);
            lines.push('1. Identify common themes and connections between them.');
            lines.push('2. Provide a concise summary for each.');
            lines.push('3. Synthesize the key takeaways.');
        } else {
            lines.push('Summarize and comment on the following:');
        }
    }

    if (videos.length) {
        lines.push('', 'Videos:', ...videos.map((item) => item.url));
    }
    if (pages.length) {
        lines.push('', 'Pages:', ...pages.map((item) => item.url));
    }
    return lines.join('\n').trim();
}

function getGeminiUrl(): string {
    if (!geminiAuthUser) return GEMINI_BASE_URL;
    return `${GEMINI_BASE_URL}?authuser=${encodeURIComponent(geminiAuthUser)}`;
}

function openTargetTab(
    url: string,
    targetMode: TargetTab,
    callback: (tab: chrome.tabs.Tab) => void
): void {
    if (targetMode === 'active') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id) {
                chrome.tabs.update(tabs[0].id, { url }, (tab) => {
                    if (tab) callback(tab);
                });
            } else {
                chrome.tabs.create({ url }, (tab) => callback(tab));
            }
        });
    } else {
        chrome.tabs.create({ url }, (tab) => callback(tab));
    }
}

export function handleGemini(url: string | null, prompt: string | null = null): void {
    showTemporaryBadge('GO', '#34a853');

    chrome.storage.local.get(
        {
            stg_appendYoutubeInstruction: true,
            stg_targetTab: DEFAULT_TARGET_TAB,
            stg_geminiModel: DEFAULT_GEMINI_MODEL,
        },
        (settings) => {
            const geminiUrl = getGeminiUrl();
            const finalPrompt =
                prompt || buildGeminiPromptForUrl(url || '', null, settings.stg_appendYoutubeInstruction as boolean);

            appendDebugLog({
                level: 'info',
                message: 'Prompt constructed',
                meta: {
                    url,
                    appendSetting: settings.stg_appendYoutubeInstruction,
                    promptLength: finalPrompt.length,
                    preview: finalPrompt,
                    targetTab: settings.stg_targetTab,
                    model: settings.stg_geminiModel,
                },
            });

            openTargetTab(geminiUrl, settings.stg_targetTab as TargetTab, (newTab) => {
                if (!newTab?.id) return;
                const tabId = newTab.id;

                const listener = (updatedTabId: number, changeInfo: any) => {
                    if (updatedTabId === tabId && changeInfo.status === 'complete') {
                        chrome.scripting.executeScript(
                            {
                                target: { tabId },
                                files: ['modules/sendToGemini/gemini_injector.js'],
                            },
                            () => {
                                setTimeout(() => {
                                    chrome.tabs.sendMessage(tabId, {
                                        action: 'prompt_gemini',
                                        prompt: finalPrompt,
                                        model: settings.stg_geminiModel,
                                    });
                                }, 1000);
                            }
                        );
                        chrome.tabs.onUpdated.removeListener(listener);
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
        }
    );
}

export function getStoredRandomImagePrompt(): Promise<string> {
    return new Promise((resolve) => {
        chrome.storage.local.get(
            { stg_randomImagePrompt: DEFAULT_RANDOM_IMAGE_PROMPT },
            ({ stg_randomImagePrompt }) => {
                resolve((stg_randomImagePrompt as string) || '');
            }
        );
    });
}

function getFilenameFromUrl(value: string, fallbackExt = 'mp4'): string {
    try {
        const parsed = new URL(value);
        const rawName = decodeURIComponent(parsed.pathname.split('/').pop() || '');
        if (rawName) {
            if (rawName.includes('.')) return rawName;
            return `${rawName}.${fallbackExt}`;
        }
    } catch {
        // Ignore parse errors
    }
    return `video-${Date.now()}.${fallbackExt}`;
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const blob = await response.blob();
        return await blobToBase64(blob);
    } catch (e) {
        console.error('Background fetch failed', e);
        return null;
    }
}

async function fetchVideoAsBytes(url: string): Promise<VideoFetchResult> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);

        const lengthHeader = response.headers.get('content-length');
        if (lengthHeader) {
            const lengthValue = Number(lengthHeader);
            if (Number.isFinite(lengthValue) && lengthValue > MAX_VIDEO_BYTES) {
                throw new Error('Video is too large to upload.');
            }
        }

        const blob = await response.blob();
        if (blob.size > MAX_VIDEO_BYTES) {
            throw new Error('Video is too large to upload.');
        }

        const bytes = await blob.arrayBuffer();
        return { bytes, sizeBytes: blob.size, mimeType: blob.type || '' };
    } catch (e) {
        console.error('Background video fetch failed', e);
        return { error: e instanceof Error ? e.message : 'Video fetch failed' };
    }
}

export async function handleGeminiImage({
    prompt = null,
    imageUrls,
}: {
    prompt?: string | null;
    imageUrls: string[];
}): Promise<void> {
    showTemporaryBadge('IMG', '#34a853');

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
        appendDebugLog({ level: 'error', message: 'No image URLs provided for Gemini flow' });
        return;
    }

    const promptToUse = prompt !== null ? prompt : await getStoredRandomImagePrompt();

    let base64Data: string | null = null;
    let usedUrl: string | null = null;

    for (const url of imageUrls) {
        base64Data = await fetchImageAsBase64(url);
        if (base64Data) {
            usedUrl = url;
            break;
        }
    }

    if (!base64Data) {
        appendDebugLog({
            level: 'error',
            message: 'Failed to fetch image in background',
            meta: { urls: imageUrls },
        });
        return;
    }

    chrome.storage.local.get(
        { stg_targetTab: DEFAULT_TARGET_TAB, stg_geminiModel: DEFAULT_GEMINI_MODEL },
        (settings) => {
            const geminiUrl = getGeminiUrl();

            openTargetTab(geminiUrl, settings.stg_targetTab as TargetTab, (newTab) => {
                if (!newTab?.id) return;
                const tabId = newTab.id;

                const listener = (updatedTabId: number, changeInfo: any) => {
                    if (updatedTabId === tabId && changeInfo.status === 'complete') {
                        chrome.scripting.executeScript(
                            {
                                target: { tabId },
                                files: ['modules/sendToGemini/gemini_injector.js'],
                            },
                            () => {
                                setTimeout(() => {
                                    chrome.tabs.sendMessage(tabId, {
                                        action: 'send_image',
                                        imageBase64: base64Data,
                                        prompt: promptToUse,
                                        model: settings.stg_geminiModel,
                                    });
                                }, 1000);
                            }
                        );
                        chrome.tabs.onUpdated.removeListener(listener);
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
        }
    );

    appendDebugLog({
        level: 'info',
        message: 'Opened Gemini image flow',
        meta: { prompt: promptToUse ? promptToUse.slice(0, 80) : null, url: usedUrl },
    });
}

export async function handleGeminiVideo({
    videoUrl,
    prompt = null,
}: {
    videoUrl: string;
    prompt?: string | null;
}): Promise<void> {
    showTemporaryBadge('VID', '#34a853');

    if (!videoUrl || !isHttpUrl(videoUrl)) {
        appendDebugLog({
            level: 'error',
            message: 'Video URL is missing or unsupported',
            meta: { url: videoUrl },
        });
        return;
    }

    const videoData = await fetchVideoAsBytes(videoUrl);
    if (!videoData.bytes) {
        appendDebugLog({
            level: 'error',
            message: 'Failed to fetch video in background',
            meta: { url: videoUrl, error: videoData.error || 'Unknown error' },
        });
        return;
    }

    const fallbackExt =
        videoData.mimeType && videoData.mimeType.includes('/')
            ? videoData.mimeType.split('/').pop() || 'mp4'
            : 'mp4';
    const filename = getFilenameFromUrl(videoUrl, fallbackExt);
    const promptToUse = prompt?.trim() || DEFAULT_VIDEO_PROMPT;

    chrome.storage.local.get(
        { stg_targetTab: DEFAULT_TARGET_TAB, stg_geminiModel: DEFAULT_GEMINI_MODEL },
        (settings) => {
            const geminiUrl = getGeminiUrl();

            openTargetTab(geminiUrl, settings.stg_targetTab as TargetTab, (newTab) => {
                if (!newTab?.id) return;
                const tabId = newTab.id;

                const listener = (updatedTabId: number, changeInfo: any) => {
                    if (updatedTabId === tabId && changeInfo.status === 'complete') {
                        chrome.scripting.executeScript(
                            {
                                target: { tabId },
                                files: ['modules/sendToGemini/gemini_injector.js'],
                            },
                            () => {
                                setTimeout(() => {
                                    chrome.tabs.sendMessage(tabId, {
                                        action: 'send_video',
                                        videoBytes: videoData.bytes,
                                        mimeType: videoData.mimeType || '',
                                        prompt: promptToUse,
                                        filename,
                                        model: settings.stg_geminiModel,
                                    });
                                }, 1000);
                            }
                        );
                        chrome.tabs.onUpdated.removeListener(listener);
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
        }
    );

    appendDebugLog({
        level: 'info',
        message: 'Opened Gemini video flow',
        meta: {
            prompt: promptToUse ? promptToUse.slice(0, 80) : null,
            url: videoUrl,
            sizeBytes: videoData.sizeBytes,
        },
    });
}
