# 2. Modular "Meta-Extension" Architecture

Date: 2026-01-05
Status: Accepted

## Context
The user wants to integrate multiple functionalities (e.g., YouTube integration, Chat bots) without creating a monolithic, tangled codebase. The extension needs to remain lightweight even as features are added.

## Decision
We will adopt a **"Meta-Extension" Architecture** where distinct features exist as isolated modules.

*   **`public/modules/`**: Feature-specific scripts (e.g., `sendToGemini`) reside here as standalone logical units.
*   **Dynamic Injection**: The core background script injects these modules only when needed (lazy loading logic where applicable).
*   **Shadow DOM UI**: Content scripts MUST use Shadow DOM to isolate their specific styles from the host page, preventing style leakage and maintaining the "Obsidian Night" aesthetic consistently.

## Consequences
*   **Pros**: 
    *   Keeps the `src/` directory clean and focused on the core framework.
    *   Easy to delete or disable a specific module without breaking the whole extension.
*   **Cons**: 
    *   Slightly more complex build/copy process (handled by Vite).
    *   Inter-module communication requires standardized message passing.
