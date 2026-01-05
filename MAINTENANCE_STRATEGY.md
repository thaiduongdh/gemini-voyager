# Maintenance Strategy: Manual Feature Porting

**Do NOT merge upstream branches directly.**
Because this fork ("Gemini Utils") heavily customizes the UI, branding, and build process (stripping Firefox/Safari/locales), direct Git merges will result in complex conflicts and potential regression of our utilitarian design.

## Strategy
We adopt a **Manual Porting** strategy.

### 1. Monitor Upstream
Add the original repo as a remote to track changes:
```bash
git remote add upstream https://github.com/Nagi-ovo/gemini-voyager.git
git fetch upstream
```

### 2. Identify New Features
Review commits or releases in `upstream/main` to identify desired features (e.g., new sync capability, new prompt/timeline logic).
Ignore changes related to:
- Branding (icons, names, updates to messages.json that restore branding)
- Locales (zh/chinese support)
- Firefox/Safari build configs
- UI styling (gradients, glassmorphism)

### 3. Copy & Adapt
For each desired feature:
1.  **Copy the code**: Copy the relevant TypeScript/Logic files.
    -   *Example*: If `src/pages/content/timeline/manager.ts` has logic updates, copy the new methods but **preserve our verified CSS/UI logic**.
2.  **Adapt for Utilitarian Theme**:
    -   If the new feature adds UI elements, strip their styles.
    -   Remove gradients, shadows, and rounded corners in `public/contentStyle.css` or the component's style.
3.  **Strictly Typed**:
    -   Ensure new code satisfies our `strict: true` TypeScript configuration. Cast usage of `chrome.storage` if necessary.

### 4. Build & Verify
Always run the build check after porting:
```bash
npm run build
```
Ensure no type errors or lint warnings are introduced.

## Key Files to Protect
Do not overwrite these files with upstream versions without careful review:
- `manifest.json`: Contains our "Gemini Utils" identity.
- `public/contentStyle.css`: Contains our utilitarian theme overrides.
- `src/pages/popup/Popup.tsx`: Contains our custom toggles and simplified UI.

## Multi-Extension Strategy (Meta-Extension)

When integrating features from *multiple* other open-source extensions:

### 1. Git Remotes (Reference Only)
You can add multiple remotes, but treat them as **reference libraries**, not merge targets.
```bash
git remote add ext-A https://github.com/user/extension-a.git
git remote add ext-B https://github.com/user/extension-b.git
git fetch --all
```

### 2. Module Pattern
Do NOT merge their full repos. Instead, import them as isolated modules:
1.  **Create Module**: `src/pages/content/modules/[ext_name]/`
2.  **Namespace Storage**: Wrap their storage calls. If they write `get({ 'setting': val })`, change it to `get({ 'extA_setting': val })`.
3.  **Consolidate Permissions**: Manually add their required permissions to our single `manifest.json`.

### 3. Conflict Avoidance
- **CSS**: Wrap their CSS in a unique class or ID to prevent bleeding.
- **Listeners**: Ensure their message listeners do not conflict with our `chrome.runtime.onMessage`.

