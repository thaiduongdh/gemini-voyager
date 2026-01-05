
import type { QueueItem, QueueKind, ContentType } from './types';
import { IMAGE_EXTENSIONS } from './config';

export const QUEUE_KINDS = {
    youtube: 'youtube',
    page: 'page',
    image: 'image',
} as const;

export function parseYoutubeVideoId(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url.trim());
        const host = parsed.hostname.replace(/^(www\.|m\.|music\.|gaming\.)/, '');
        const pathParts = parsed.pathname.split('/').filter(Boolean);

        if (host === 'youtu.be' && pathParts[0]) {
            return pathParts[0];
        }

        if (host.endsWith('youtube.com')) {
            if (
                (pathParts[0] === 'shorts' ||
                    pathParts[0] === 'live' ||
                    pathParts[0] === 'v' ||
                    pathParts[0] === 'embed') &&
                pathParts[1]
            ) {
                return pathParts[1];
            }
            const fromParam = parsed.searchParams.get('v');
            if (fromParam) {
                return fromParam;
            }
        }
        return null;
    } catch {
        return null;
    }
}

export function isValidUrl(value: string): boolean {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

export function isHttpUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export function looksLikeImageUrl(value: string | null | undefined): boolean {
    if (!value || typeof value !== 'string') return false;
    const url = value.trim();
    if (url.startsWith('data:image/')) return true;
    try {
        const parsed = new URL(url);
        const lower = parsed.pathname.toLowerCase();
        return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
    } catch {
        return false;
    }
}

export function detectContentType(url: string | null | undefined): ContentType {
    if (!url || typeof url !== 'string') return 'page';
    try {
        const u = new URL(url);
        const rootDomain = u.hostname.replace(/^(www\.|m\.|music\.|gaming\.)/, '');
        const isYoutube = rootDomain === 'youtube.com' || rootDomain === 'youtu.be';

        if (isYoutube) {
            const path = u.pathname;
            if (path.includes('/shorts/')) return 'short';
            if (path.includes('/live/')) return 'video';
            if (path === '/playlist') return 'playlist';
            if (path.startsWith('/@') || path.startsWith('/channel/') || path.startsWith('/c/'))
                return 'channel';
            if (parseYoutubeVideoId(url)) return 'video';
        }

        if (u.hostname.endsWith('github.com')) return 'github';
        if (looksLikeImageUrl(url)) return 'image';
    } catch {
    }
    return 'page';
}

export function inferQueueKind(url: string): QueueKind {
    if (parseYoutubeVideoId(url)) return QUEUE_KINDS.youtube;
    if (looksLikeImageUrl(url)) return QUEUE_KINDS.image;
    return QUEUE_KINDS.page;
}

export function isQueueItemObject(item: unknown): item is { url: string; kind?: string } {
    return (
        item !== null &&
        typeof item === 'object' &&
        'url' in item &&
        typeof (item as { url: unknown }).url === 'string'
    );
}

export function normalizeQueueKind(kind: string | null | undefined, url: string): QueueKind {
    const normalized = String(kind || '').toLowerCase();
    if (
        normalized === QUEUE_KINDS.youtube ||
        normalized === QUEUE_KINDS.page ||
        normalized === QUEUE_KINDS.image
    ) {
        return normalized as QueueKind;
    }
    return inferQueueKind(url);
}

export function normalizeQueueItem(
    item: string | { url: string; kind?: string } | unknown,
    existingKindMap: Map<string, QueueKind> | string | null = null
): QueueItem | null {
    if (isQueueItemObject(item)) {
        const url = item.url.trim();
        if (!url || !isValidUrl(url)) return null;
        return { url, kind: normalizeQueueKind(item.kind, url) };
    }
    if (typeof item !== 'string') return null;
    const url = item.trim();
    if (!url || !isValidUrl(url)) return null;

    let kind: QueueKind | null = null;
    if (existingKindMap instanceof Map) {
        kind = existingKindMap.get(url) ?? null;
    } else if (typeof existingKindMap === 'string') {
        kind = existingKindMap as QueueKind;
    }

    return { url, kind: normalizeQueueKind(kind, url) };
}

export function normalizeQueue(queue: unknown): QueueItem[] {
    const list = Array.isArray(queue) ? queue : [];
    return list.map((item) => normalizeQueueItem(item)).filter((item): item is QueueItem => item !== null);
}

export function splitQueueByKind(queue: QueueItem[]): {
    videos: QueueItem[];
    pages: QueueItem[];
    images: QueueItem[];
} {
    const videos: QueueItem[] = [];
    const pages: QueueItem[] = [];
    const images: QueueItem[] = [];

    for (const item of queue) {
        switch (item.kind) {
            case 'youtube':
                videos.push(item);
                break;
            case 'image':
                images.push(item);
                break;
            default:
                pages.push(item);
        }
    }

    return { videos, pages, images };
}
