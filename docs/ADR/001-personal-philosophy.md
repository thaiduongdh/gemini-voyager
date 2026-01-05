# 1. Personal Use Philosophy

Date: 2026-01-05
Status: Accepted

## Context
Commercial extensions are often bloated with tracking, "New Version" banners, cross-promotion, and features designed for broad appeal rather than specific utility. The user requires a tool that is strictly functional, lightweight, and tailored to their specific workflow.

## Decision
We will build and maintain this project as a **Personal, Self-Hosted Extension**. 

*   **No "Growth" Features**: No analytics, no rating prompts, no social sharing buttons.
*   **No Backward Compatibility**: We only support the user's current environment (Chrome/Windows).
*   **Manual Updates**: No auto-update mechanism that risks breaking customizations.
*   **Ruthless Clutter Reduction**: Any UI element that does not serve an immediate functional purpose is removed.

## Consequences
*   **Pros**: 
    *   Zero "nagware" or distraction.
    *   Performance optimizations can be aggressive (removing unused code paths).
    *   UI can be "Obsidian Night" minimalist without needing to support light mode or other themes.
*   **Cons**: 
    *   Manual installation required.
    *   Not suitable for public web store distribution (intentional).
