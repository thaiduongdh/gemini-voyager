
interface CaptionTrack {
    baseUrl: string;
    languageCode: string;
    name?: { simpleText?: string };
}

export async function fetchTranscript(videoId: string): Promise<string> {
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
        const html = await response.text();

        // Extract captionTracks
        const regex = /"captionTracks":(\[.*?\])/;
        const match = regex.exec(html);

        if (!match) {
            throw new Error('No captions found for this video.');
        }

        const captionTracks: CaptionTrack[] = JSON.parse(match[1]);
        // Prefer English, but take first if not available
        const track = captionTracks.find((t) => t.languageCode === 'en') || captionTracks[0];

        if (!track) {
            throw new Error('No usable caption track found.');
        }

        const transcriptResponse = await fetch(track.baseUrl);
        const transcriptXml = await transcriptResponse.text();

        // Parse XML using regex (DOMParser not available in Service Workers)
        const textRegex = /<text[^>]*>(.*?)<\/text>/g;
        let transcriptText = '';
        let m: RegExpExecArray | null;
        while ((m = textRegex.exec(transcriptXml)) !== null) {
            // Decode HTML entities
            const text = m[1]
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
            transcriptText += text + ' ';
        }

        return transcriptText.trim();
    } catch (error) {
        console.error('Transcript fetch error:', error);
        throw error;
    }
}
