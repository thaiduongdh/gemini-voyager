
import { parseYoutubeVideoId } from '../../../../shared/modules/sendToGemini/utils';
import { fetchTranscript } from './transcript_utils';
import { appendDebugLog } from './logging';

export async function handleChatGPT(url: string): Promise<void> {
    const videoId = parseYoutubeVideoId(url);
    if (!videoId) {
        console.error('Invalid Video ID');
        appendDebugLog({
            level: 'error',
            message: 'ChatGPT flow failed: invalid video ID',
            meta: { url },
        });
        return;
    }

    try {
        const transcript = await fetchTranscript(videoId);
        const prompt = `Summarize and comment on this video transcript:\n\n${transcript}`;
        const chatgptUrl = 'https://chatgpt.com/';

        chrome.tabs.create({ url: chatgptUrl }, (newTab) => {
            if (!newTab?.id) return;
            const tabId = newTab.id;

            const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    chrome.scripting.executeScript(
                        {
                            target: { tabId },
                            files: ['modules/sendToGemini/chatgpt_injector.js'],
                        },
                        () => {
                            setTimeout(() => {
                                chrome.tabs.sendMessage(tabId, { action: 'prompt_chatgpt', prompt });
                            }, 1000);
                        }
                    );
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
        appendDebugLog({ level: 'info', message: 'Opened ChatGPT with transcript', meta: { url } });
    } catch (error) {
        console.error('Failed to fetch transcript', error);
        appendDebugLog({
            level: 'error',
            message: 'Failed to fetch transcript for ChatGPT',
            meta: { url, error: error instanceof Error ? error.message : String(error) },
        });
    }
}
