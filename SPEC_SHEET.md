# Gemini Utils - Requirements Specification

## Core Philosophy
1.  **Minimalism**: Uncompromising "Utilitarian" / "Obsidian Night" aesthetic. No clutter, no unnecessary banners, minimal padding.
2.  **Efficiency**: Chrome-only. English-only. Performance-focused.
3.  **Directness**: "Ruthlessly honest" feedback loop.

## Functional Requirements
*   **Chrome Only**: Remove Firefox/Safari build targets and code paths.
*   **English Only**: Remove all localization logic (chinese, etc.). Default to English.
*   **Manual Maintenance**: No upstream merges. Manual porting of features.
*   **Personal Use Only**: No "growth" features (analytics, rating prompts).
*   **Architecture**: Modular "Meta-Extension" design.
*   **Token/Word Counter**: **MUST BE VISIBLE** and functional. (Critical: Fixed z-index but needs logic verification).
*   **Message Timestamps**: Show "just now" or relative time. **NO DUPLICATES** (User reported duplication persists).
*   **Export**: Support Markdown/JSON export. English only.
*   **Folder Management**: Minimalist folder UI.
*   **Custom Chat Width**: Option to toggle custom chat width vs original Gemini width.
*   **Prompt Bubble**: Option to hide the floating prompt manager button. **MUST WORK** (User reported it does nothing).

## UI/UX Requirements
*   **Popup**: Minimalist. No "New Version" banners (or tiny). No "Gemini Notice".
*   **Scrollbars**: "Utilitarian" thin scrollbars everywhere.
*   **Timeline / Checkpoints**: **ULTRA-MINIMALIST**. Smaller dots, less obvious, transparent/minimal bar. Do not steal attention.
*   **Deep Research**: Download button integration.

## Technical Constraints
*   **Architecture**: "Meta-Extension" (Core + `public/modules`).
*   **Build System**: Vite + CRXJS.
*   **Storage**: `chrome.storage.local` heavily used. `localStorage` backup (4x redundancy).
*   **Linting**: Strict TypeScript. No `any` (where possible).
