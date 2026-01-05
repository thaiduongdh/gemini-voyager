
// Minimal mock for analytics to satisfy imports
export enum AnalyticsCategory { Error = 'error', Send = 'send' }
export enum AnalyticsAction {
    SendGemini = 'send_gemini',
    SendChatGPT = 'send_chatgpt',
    FetchFailed = 'fetch_failed',
    TranscriptFailed = 'transcript_failed'
}
export function trackEvent(category: any, action: any, label?: any, value?: any) { }
export function trackError(category: any, action: any) { }
export function trackTiming(category: any, variable: any, value: any) { }
