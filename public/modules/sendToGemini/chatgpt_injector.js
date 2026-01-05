
// ChatGPT content script injector (JS)

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
        // ignore
    }
}

function waitForInput(timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
        const selector = '#prompt-textarea';
        const finish = (el, obs, timer) => {
            if (timer) clearTimeout(timer);
            if (obs) obs.disconnect();
            resolve(el);
        };

        const existingInput = document.querySelector(selector);
        if (existingInput) {
            finish(existingInput);
            return;
        }

        let timeoutId;
        const observer = new MutationObserver((_mutations, obs) => {
            const input = document.querySelector(selector);
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
            reject(new Error('ChatGPT input field not found. Are you logged in?'));
        }, timeoutMs);
    });
}

chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'prompt_chatgpt') {
        const promptText = request.prompt;

        const interactWithChatGPT = async () => {
            try {
                const inputArea = await withRetries(() => waitForInput(), 2, 600);
                inputArea.focus();

                inputArea.innerHTML = '';
                inputArea.textContent = promptText;
                if ('value' in inputArea) {
                    inputArea.value = promptText;
                }

                const inputEvent = new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: promptText,
                });
                inputArea.dispatchEvent(inputEvent);

                setTimeout(() => {
                    const sendButton = document.querySelector('button[data-testid="send-button"]');
                    if (sendButton && !sendButton.disabled) {
                        sendButton.click();
                    } else {
                        const enterEvent = new KeyboardEvent('keydown', {
                            bubbles: true,
                            cancelable: true,
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                        });
                        inputArea.dispatchEvent(enterEvent);
                    }
                }, 500);

                logEvent('info', 'ChatGPT prompt sent', {
                    preview: promptText ? promptText.slice(0, 80) : '',
                });
            } catch (error) {
                console.error(error);
                alert('Send to ChatGPT: ' + (error instanceof Error ? error.message : String(error)));
                logEvent('error', 'ChatGPT prompt failed', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        };

        interactWithChatGPT();
    }
});
