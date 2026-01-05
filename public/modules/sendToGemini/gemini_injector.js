
// Gemini content script injector (JS)

const GEMINI_INPUT_SELECTOR = 'div[contenteditable="true"]';
const TOAST_ID = 'ytg-gemini-toast';
const TOAST_DURATION = 3200;
let toastTimer = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetries(fn, attempts = 2, delay = 500) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (i < attempts - 1) {
                await sleep(delay);
            }
        }
    }
    throw lastError;
}

function logEvent(level, message, meta = null) {
    try {
        chrome.runtime.sendMessage({ action: 'log_event', level, message, meta });
    } catch {
        // noop
    }
}

function showToast(message, variant = 'info') {
    try {
        if (!message) return;
        const existing = document.getElementById(TOAST_ID);
        if (existing?.parentElement) existing.parentElement.removeChild(existing);
        if (toastTimer) clearTimeout(toastTimer);

        const toast = document.createElement('div');
        toast.id = TOAST_ID;
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '16px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.zIndex = '2147483647';
        toast.style.padding = '10px 14px';
        toast.style.borderRadius = '10px';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
        toast.style.fontSize = '13px';
        toast.style.fontWeight = '600';
        toast.style.color = variant === 'error' ? '#b00020' : '#0b4f16';
        toast.style.background = variant === 'error' ? '#fdecea' : '#ecf6ee';
        toast.style.border = variant === 'error' ? '1px solid #f5c6c4' : '1px solid #b8e0c9';

        document.body.appendChild(toast);
        toastTimer = setTimeout(() => {
            if (toast?.parentElement) toast.parentElement.removeChild(toast);
        }, TOAST_DURATION);
    } catch (err) {
        console.warn('Toast failed', err);
    }
}

function waitForInputArea(timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
        const finish = (value, obs, timer) => {
            if (timer) clearTimeout(timer);
            if (obs) obs.disconnect();
            resolve(value);
        };

        const existingInput = document.querySelector(GEMINI_INPUT_SELECTOR);
        if (existingInput) {
            finish(existingInput);
            return;
        }

        let timeoutId;

        const observer = new MutationObserver((_mutations, obs) => {
            const input = document.querySelector(GEMINI_INPUT_SELECTOR);
            if (input) {
                finish(input, obs, timeoutId);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error('Input field not found. Are you logged in?'));
        }, timeoutMs);
    });
}

function setPromptText(inputArea, promptText) {
    inputArea.focus();
    inputArea.innerHTML = '';

    const p = document.createElement('p');
    p.textContent = promptText;
    inputArea.appendChild(p);

    const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: promptText,
    });
    inputArea.dispatchEvent(inputEvent);
}

async function clickSendButton(inputArea, delay = 100, maxAttempts = 10) {
    await sleep(delay);

    const findButton = () => {
        const selectors = [
            'button[aria-label*="Send"]',
            'button[aria-label*="Submit"]',
            'button.send-button',
            'button[data-test-id="send-message-button"]',
            'button:has(svg path[d*="M2.01 21L23 12"])',
        ];
        for (const sel of selectors) {
            const btn = document.querySelector(sel);
            if (btn && !btn.disabled && btn.offsetParent !== null) return btn;
        }
        return null;
    };

    let attempts = 0;

    const tryClick = async () => {
        const sendButton = findButton();
        if (sendButton) {
            sendButton.click();
            logEvent('info', 'Gemini send button clicked');
            return true;
        }
        return false;
    };

    while (attempts < maxAttempts) {
        if (await tryClick()) return;
        await sleep(200);
        attempts++;
    }

    // Fallback: Enter key
    logEvent('info', 'Gemini send button not found/clickable, using Enter key fallback');
    const enterEvent = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
    });
    inputArea.dispatchEvent(enterEvent);
}

function buildDataTransfer(file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt;
}

function findHiddenFileInput() {
    const selectors = [
        'input[type="file"].hidden-file-input',
        'input.hidden-file-input',
        'input[type="file"][data-test-id*="upload"]',
        'input[type="file"]',
    ];

    for (const sel of selectors) {
        const input = document.querySelector(sel);
        if (input) return input;
    }
    return null;
}

async function attachFileToInput(inputArea, file) {
    try {
        const clipboardItem = new ClipboardItem({
            [file.type]: file,
        });
        await navigator.clipboard.write([clipboardItem]);
        logEvent('info', 'Image written to clipboard', { type: file.type, size: file.size });

        inputArea.focus();
        await sleep(100);

        const pasteSuccess = document.execCommand('paste');
        if (pasteSuccess) {
            logEvent('info', 'Paste command executed successfully');
            return true;
        }

        const pasteEvent = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'v',
            code: 'KeyV',
            ctrlKey: true,
        });
        inputArea.dispatchEvent(pasteEvent);
        logEvent('info', 'Attempted Ctrl+V paste fallback');
        return true;
    } catch (err) {
        console.warn('Clipboard write/paste failed', err);
        logEvent('error', 'Clipboard write failed', { error: String(err) });
    }

    const fileInput = findHiddenFileInput();
    if (fileInput) {
        try {
            const dt = buildDataTransfer(file);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            logEvent('info', 'File attached via hidden input', { filename: file.name });
            return true;
        } catch (err) {
            console.warn('Failed to set files on hidden input', err);
        }
    }

    const qlEditor = document.querySelector('.ql-editor, div[contenteditable="true"]');
    if (qlEditor) {
        try {
            const dt = buildDataTransfer(file);
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(pasteEvent, 'clipboardData', {
                value: dt,
                writable: false,
            });
            qlEditor.dispatchEvent(pasteEvent);
            logEvent('info', 'Attempted synthetic paste on editor');
            return true;
        } catch (err) {
            console.warn('Synthetic paste failed', err);
        }
    }

    logEvent('error', 'All file attachment methods failed');
    return false;
}

async function handlePromptOnly(promptText) {
    try {
        const inputArea = await withRetries(() => waitForInputArea(), 2, 600);
        setPromptText(inputArea, promptText);
        clickSendButton(inputArea);
        logEvent('info', 'Gemini prompt sent', { preview: promptText ? promptText.slice(0, 80) : '' });
    } catch (error) {
        console.error(error);
        showToast('Send to Gemini: ' + (error instanceof Error ? error.message : String(error)), 'error');
        logEvent('error', 'Gemini prompt failed', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

async function base64ToFile(base64Data, filename = 'image.jpg') {
    const res = await fetch(base64Data);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
}

function normalizeBytes(value) {
    if (!value) return null;
    if (value instanceof ArrayBuffer) return value;
    if (ArrayBuffer.isView(value)) {
        return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    }
    return null;
}

function bytesToFile(bytes, filename, mimeType = 'video/mp4') {
    const buffer = normalizeBytes(bytes);
    if (!buffer) return null;
    const effectiveType = mimeType?.trim() || 'video/mp4';
    const blob = new Blob([buffer], { type: effectiveType });
    return new File([blob], filename, { type: blob.type });
}

async function handleImage({ imageBase64, prompt }) {
    try {
        const inputArea = await withRetries(() => waitForInputArea(), 2, 600);

        let file;
        if (imageBase64) {
            file = await base64ToFile(imageBase64, `image-${Date.now()}.jpg`);
        } else {
            throw new Error('No image data received.');
        }

        if (prompt?.trim()) {
            setPromptText(inputArea, prompt.trim());
        } else {
            inputArea.focus();
        }

        const attached = await attachFileToInput(inputArea, file);
        if (!attached) {
            throw new Error('Could not attach the image to Gemini. Please try again.');
        }

        clickSendButton(inputArea, 400);
        showToast('Image sent to Gemini', 'info');
        logEvent('info', 'Gemini image sent', { size: file.size });
    } catch (error) {
        console.error(error);
        showToast('Send to Gemini: ' + (error instanceof Error ? error.message : String(error)), 'error');
        logEvent('error', 'Gemini image flow failed', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

async function handleVideo({ videoBase64, videoBytes, mimeType, prompt, filename }) {
    try {
        const inputArea = await withRetries(() => waitForInputArea(), 2, 600);

        let file = null;
        if (videoBytes) {
            const name = filename || `video-${Date.now()}.mp4`;
            file = bytesToFile(videoBytes, name, mimeType);
        } else if (videoBase64) {
            const name = filename || `video-${Date.now()}.mp4`;
            file = await base64ToFile(videoBase64, name);
        } else {
            throw new Error('No video data received.');
        }

        if (!file) {
            throw new Error('Video payload was not usable.');
        }

        if (prompt?.trim()) {
            setPromptText(inputArea, prompt.trim());
        } else {
            inputArea.focus();
        }

        const attached = await attachFileToInput(inputArea, file);
        if (!attached) {
            throw new Error('Could not attach the video to Gemini. Please try again.');
        }

        clickSendButton(inputArea, 800, 20);
        showToast('Video sent to Gemini', 'info');
        logEvent('info', 'Gemini video sent', { size: file.size, filename: file.name });
    } catch (error) {
        console.error(error);
        showToast('Send to Gemini: ' + (error instanceof Error ? error.message : String(error)), 'error');
        logEvent('error', 'Gemini video flow failed', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'prompt_gemini') {
        const promptText = request.prompt || `watch, summarize and comment ${request.url || ''}`;
        handlePromptOnly(promptText);
    } else if (request.action === 'send_image') {
        handleImage({
            imageBase64: request.imageBase64,
            prompt: request.prompt || '',
        });
    } else if (request.action === 'send_video') {
        handleVideo({
            videoBase64: request.videoBase64,
            videoBytes: request.videoBytes,
            mimeType: request.mimeType || '',
            prompt: request.prompt || '',
            filename: request.filename || '',
        });
    }
});
