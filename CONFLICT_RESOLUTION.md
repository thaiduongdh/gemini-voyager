# Conflict Resolution Guide

This document outlines the strategy for resolving conflicts when merging changes from the original `gemini-voyager` repository into this `gemini-utils` fork.

## 1. Upstream Setup
Ensure you have the original repository added as a remote:
```bash
git remote add upstream https://github.com/Nagi-ovo/gemini-voyager.git
```

## 2. Merging Process
When the original author adds features or fixes bugs, follow these steps to sync:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

## 3. Handling Conflicts
You will likely encounter conflicts in the following areas due to our customizations:

### A. Branding & Locales
- **Files**: `src/locales/en/messages.json`, `manifest.json`, `package.json`, `src/pages/popup/Popup.tsx`.
- **Strategy**: 
    - Keep our "Gemini Utils" branding and description.
    - Keep "Support me" links removed.
    - Accept new localization keys from upstream but ignore changes to existing branding keys.
    - Discard any re-introduction of `src/locales/zh` or language switcher logic.

### B. UI Customizations
- **Files**: `public/contentStyle.css`, `src/pages/content/prompt/index.ts`.
- **Strategy**:
    - **CSS**: We switched to a utilitarian, flat design. Upstream uses gradients and glassmorphism.
        - *Action*: Resolve conflicts by keeping our solid colors and removing blurs/gradients, while accepting new classes if they support new features.
    - **Prompt Manager**: We removed the GitHub link and language selector.
        - *Action*: Keep these elements removed. If upstream changes the DOM structure, re-apply our removal logic (commenting out or deleting the specific blocks).

### C. Build Configuration
- **Files**: `vite.config.*`.
- **Strategy**: We removed Firefox/Safari configs.
    - *Action*: If upstream updates these, simply delete them again. Keep our `vite.config.chrome.ts` focused on the features we support.

## 4. Feature Flags
We added several feature toggles in `src/pages/content/` (e.g., `conversationStats`, `messageTimestamps`).
- **Files**: `src/pages/content/index.tsx`, `src/pages/popup/Popup.tsx`.
- **Strategy**: Ensure our initialization logic (`startConversationStats`, etc.) remains. If upstream refactors `initializeFeatures`, you might need to manually re-insert our feature start calls.

## 5. Testing
After merging and resolving conflicts:
1. Run `npm run build` to ensure no type errors.
2. Load the extension in Chrome.
3. Verify:
    - Popup opens and shows utility toggles.
    - Timeline works with utilitarian style (no blur).
    - Prompt manager opens without floating bubble (if disabled) and without GitHub link.
    - New upstream features work as expected.
