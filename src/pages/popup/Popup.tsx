import React, { useEffect, useState, useCallback } from 'react';
import { DarkModeToggle } from '../../components/DarkModeToggle';
// import { LanguageSwitcher } from '../../components/LanguageSwitcher'; // Removed
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { useLanguage } from '../../contexts/LanguageContext';
import { useWidthAdjuster } from '../../hooks/useWidthAdjuster';

import { CloudSyncSettings } from './components/CloudSyncSettings';
import { KeyboardShortcutSettings } from './components/KeyboardShortcutSettings';
import { SendToGeminiSettings } from './components/SendToGeminiSettings';
import { StarredHistory } from './components/StarredHistory';
import {
  IconChatGPT,
  IconClaude,
  IconGrok,
  IconDeepSeek,
  IconQwen,
  IconKimi,
  IconNotebookLM,
  IconMidjourney,
} from './components/WebsiteLogos';
import WidthSlider from './components/WidthSlider';

import { storageFacade } from '@/core/services/StorageFacade';
import { StorageKeys } from '@/core/types/common';
import { isSafari } from '@/core/utils/browser';
import { compareVersions } from '@/core/utils/version';

type ScrollMode = 'jump' | 'flow';

const LEGACY_BASELINE_PX = 1200; // used to migrate old px widths to %
const pxFromPercent = (percent: number) => (percent / 100) * LEGACY_BASELINE_PX;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const clampPercent = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const normalizePercent = (
  value: number,
  fallback: number,
  min: number,
  max: number,
  legacyBaselinePx: number
) => {
  if (!Number.isFinite(value)) return fallback;
  if (value > max) {
    const approx = (value / legacyBaselinePx) * 100;
    return clampPercent(approx, min, max);
  }
  return clampPercent(value, min, max);
};

const CHAT_PERCENT = { min: 30, max: 100, defaultValue: 70, legacyBaselinePx: LEGACY_BASELINE_PX };
const EDIT_PERCENT = { min: 30, max: 100, defaultValue: 60, legacyBaselinePx: LEGACY_BASELINE_PX };
const SIDEBAR_PERCENT = { min: 15, max: 45, defaultValue: 26, legacyBaselinePx: LEGACY_BASELINE_PX };
const SIDEBAR_PX = {
  min: Math.round(pxFromPercent(SIDEBAR_PERCENT.min)),
  max: Math.round(pxFromPercent(SIDEBAR_PERCENT.max)),
  defaultValue: Math.round(pxFromPercent(SIDEBAR_PERCENT.defaultValue)),
};

const clampSidebarPx = (value: number) => clampNumber(value, SIDEBAR_PX.min, SIDEBAR_PX.max);
const normalizeSidebarPx = (value: number) => {
  if (!Number.isFinite(value)) return SIDEBAR_PX.defaultValue;
  // If the stored value looks like a legacy percent, convert to px first.
  if (value <= SIDEBAR_PERCENT.max) {
    const px = pxFromPercent(value);
    return clampSidebarPx(px);
  }
  return clampSidebarPx(value);
};

const LATEST_VERSION_CACHE_KEY = StorageKeys.LATEST_VERSION_CACHE;
const LATEST_VERSION_MAX_AGE = 1000 * 60 * 60 * 6; // 6 hours
const isDevBuild = import.meta.env.DEV;

const normalizeVersionString = (version?: string | null): string | null => {
  if (!version) return null;
  const trimmed = version.trim();
  return trimmed ? trimmed.replace(/^v/i, '') : null;
};

const toReleaseTag = (version?: string | null): string | null => {
  if (!version) return null;
  const trimmed = version.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
};

interface SettingsUpdate {
  mode?: ScrollMode | null;
  hideContainer?: boolean;
  draggableTimeline?: boolean;
  resetPosition?: boolean;
  folderEnabled?: boolean;
  hideArchivedConversations?: boolean;
  customWebsites?: string[];
  watermarkRemoverEnabled?: boolean;
  chatWidthEnabled?: boolean;
  promptTriggerEnabled?: boolean;
  conversationStatsEnabled?: boolean;
  messageTimestampsEnabled?: boolean;
}

export default function Popup() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<ScrollMode>('flow');
  const [hideContainer, setHideContainer] = useState<boolean>(false);
  const [draggableTimeline, setDraggableTimeline] = useState<boolean>(false);
  const [folderEnabled, setFolderEnabled] = useState<boolean>(true);
  const [hideArchivedConversations, setHideArchivedConversations] = useState<boolean>(false);
  const [customWebsites, setCustomWebsites] = useState<string[]>([]);
  const [newWebsiteInput, setNewWebsiteInput] = useState<string>('');
  const [websiteError, setWebsiteError] = useState<string>('');
  const [showStarredHistory, setShowStarredHistory] = useState<boolean>(false);
  const [formulaCopyFormat, setFormulaCopyFormat] = useState<'latex' | 'unicodemath' | 'no-dollar'>('latex');
  const [extVersion, setExtVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [watermarkRemoverEnabled, setWatermarkRemoverEnabled] = useState<boolean>(true);
  const [chatWidthEnabled, setChatWidthEnabled] = useState<boolean>(true);
  const [promptTriggerEnabled, setPromptTriggerEnabled] = useState<boolean>(true);
  const [conversationStatsEnabled, setConversationStatsEnabled] = useState<boolean>(true);
  const [messageTimestampsEnabled, setMessageTimestampsEnabled] = useState<boolean>(true);

  const handleFormulaCopyFormatChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const format = e.target.value as 'latex' | 'unicodemath' | 'no-dollar';
      setFormulaCopyFormat(format);
      void storageFacade
        .setSetting(StorageKeys.FORMULA_COPY_FORMAT, format)
        .catch((err) => {
          console.error('[Gemini Voyager] Failed to save formula copy format:', err);
        });
    },
    []
  );

  // Helper function to apply settings to storage
  const apply = useCallback((settings: SettingsUpdate) => {
    const payload: any = {};
    if (settings.mode) payload[StorageKeys.TIMELINE_SCROLL_MODE] = settings.mode;
    if (typeof settings.hideContainer === 'boolean') payload[StorageKeys.TIMELINE_HIDE_CONTAINER] = settings.hideContainer;
    if (typeof settings.draggableTimeline === 'boolean') payload[StorageKeys.TIMELINE_DRAGGABLE] = settings.draggableTimeline;
    if (typeof settings.folderEnabled === 'boolean') payload[StorageKeys.FOLDER_ENABLED] = settings.folderEnabled;
    if (typeof settings.hideArchivedConversations === 'boolean') payload[StorageKeys.FOLDER_HIDE_ARCHIVED] = settings.hideArchivedConversations;
    if (settings.resetPosition) payload[StorageKeys.TIMELINE_POSITION] = null;
    if (settings.customWebsites) payload[StorageKeys.PROMPT_CUSTOM_WEBSITES] = settings.customWebsites;
    if (typeof settings.watermarkRemoverEnabled === 'boolean') {
      payload[StorageKeys.WATERMARK_REMOVER_ENABLED] = settings.watermarkRemoverEnabled;
    }
    if (typeof settings.chatWidthEnabled === 'boolean') payload[StorageKeys.CHAT_WIDTH_ENABLED] = settings.chatWidthEnabled;
    if (typeof settings.promptTriggerEnabled === 'boolean') {
      payload[StorageKeys.PROMPT_TRIGGER_ENABLED] = settings.promptTriggerEnabled;
    }
    if (typeof settings.conversationStatsEnabled === 'boolean') {
      payload[StorageKeys.CONVERSATION_STATS_ENABLED] = settings.conversationStatsEnabled;
    }
    if (typeof settings.messageTimestampsEnabled === 'boolean') {
      payload[StorageKeys.MESSAGE_TIMESTAMPS_ENABLED] = settings.messageTimestampsEnabled;
    }
    void storageFacade.setSettings(payload).catch(() => {});
  }, []);

  // Width adjuster for chat width
  const chatWidthAdjuster = useWidthAdjuster({
    storageKey: StorageKeys.CHAT_WIDTH,
    defaultValue: CHAT_PERCENT.defaultValue,
    normalize: (v) =>
      normalizePercent(v, CHAT_PERCENT.defaultValue, CHAT_PERCENT.min, CHAT_PERCENT.max, CHAT_PERCENT.legacyBaselinePx),
    onApply: useCallback((widthPercent: number) => {
      const normalized = normalizePercent(
        widthPercent,
        CHAT_PERCENT.defaultValue,
        CHAT_PERCENT.min,
        CHAT_PERCENT.max,
        CHAT_PERCENT.legacyBaselinePx
      );
      try {
        void storageFacade.setSetting(StorageKeys.CHAT_WIDTH, normalized).catch(() => {});
      } catch {}
    }, []),
  });

  // Width adjuster for edit input width
  const editInputWidthAdjuster = useWidthAdjuster({
    storageKey: StorageKeys.EDIT_INPUT_WIDTH,
    defaultValue: EDIT_PERCENT.defaultValue,
    normalize: (v) =>
      normalizePercent(v, EDIT_PERCENT.defaultValue, EDIT_PERCENT.min, EDIT_PERCENT.max, EDIT_PERCENT.legacyBaselinePx),
    onApply: useCallback((widthPercent: number) => {
      const normalized = normalizePercent(
        widthPercent,
        EDIT_PERCENT.defaultValue,
        EDIT_PERCENT.min,
        EDIT_PERCENT.max,
        EDIT_PERCENT.legacyBaselinePx
      );
      try {
        void storageFacade.setSetting(StorageKeys.EDIT_INPUT_WIDTH, normalized).catch(() => {});
      } catch {}
    }, []),
  });

  // Width adjuster for sidebar width (px-based UI, stored as px; content will migrate >max to %)
  const sidebarWidthAdjuster = useWidthAdjuster({
    storageKey: StorageKeys.SIDEBAR_WIDTH,
    defaultValue: SIDEBAR_PX.defaultValue,
    normalize: normalizeSidebarPx,
    onApply: useCallback((widthPx: number) => {
      const clamped = normalizeSidebarPx(widthPx);
      try {
        void storageFacade.setSetting(StorageKeys.SIDEBAR_WIDTH, clamped).catch(() => {});
      } catch {}
    }, []),
  });

  useEffect(() => {
    try {
      const version = chrome?.runtime?.getManifest?.()?.version;
      if (version) {
        setExtVersion(version);
      }
    } catch (err) {
      console.error('[Gemini Voyager] Failed to get extension version:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchLatestVersion = async () => {
      if (!extVersion) return;

      try {
        const cache = await storageFacade.getDataMap([LATEST_VERSION_CACHE_KEY]);
        const cached = cache?.[LATEST_VERSION_CACHE_KEY] as { version?: string; fetchedAt?: number } | undefined;
        const now = Date.now();

        let latest =
          cached && cached.version && cached.fetchedAt && now - cached.fetchedAt < LATEST_VERSION_MAX_AGE
            ? cached.version
            : null;

        if (!latest) {
          const resp = await fetch('https://api.github.com/repos/Nagi-ovo/gemini-voyager/releases/latest', {
            headers: { Accept: 'application/vnd.github+json' },
          });

          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }

          const data = await resp.json();
          const candidate =
            typeof data.tag_name === 'string'
              ? data.tag_name
              : (typeof data.name === 'string' ? data.name : null);

          if (candidate) {
            latest = candidate;
            await storageFacade.setDataMap({
              [LATEST_VERSION_CACHE_KEY]: { version: candidate, fetchedAt: now },
            });
          }
        }

        if (cancelled || !latest) return;

        setLatestVersion(latest);
      } catch (error) {
        if (!cancelled) {
          console.warn('[Gemini Voyager] Failed to check latest version:', error);
        }
      }
    };

    fetchLatestVersion();

    return () => {
      cancelled = true;
    };
  }, [extVersion]);

  useEffect(() => {
    try {
      storageFacade.getSettings(
        {
          [StorageKeys.TIMELINE_SCROLL_MODE]: 'flow',
          [StorageKeys.TIMELINE_HIDE_CONTAINER]: false,
          [StorageKeys.TIMELINE_DRAGGABLE]: false,
          [StorageKeys.FOLDER_ENABLED]: true,
          [StorageKeys.FOLDER_HIDE_ARCHIVED]: false,
          [StorageKeys.PROMPT_CUSTOM_WEBSITES]: [],
          [StorageKeys.FORMULA_COPY_FORMAT]: 'latex',
          [StorageKeys.WATERMARK_REMOVER_ENABLED]: true,
          [StorageKeys.CHAT_WIDTH_ENABLED]: true,
          [StorageKeys.PROMPT_TRIGGER_ENABLED]: true,
          [StorageKeys.CONVERSATION_STATS_ENABLED]: true,
          [StorageKeys.MESSAGE_TIMESTAMPS_ENABLED]: true,
        },
        (res) => {
          const m = res?.[StorageKeys.TIMELINE_SCROLL_MODE] as ScrollMode;
          if (m === 'jump' || m === 'flow') setMode(m);
          const format = res?.[StorageKeys.FORMULA_COPY_FORMAT] as 'latex' | 'unicodemath' | 'no-dollar';
          if (format === 'latex' || format === 'unicodemath' || format === 'no-dollar') setFormulaCopyFormat(format);
          setHideContainer(!!res?.[StorageKeys.TIMELINE_HIDE_CONTAINER]);
          setDraggableTimeline(!!res?.[StorageKeys.TIMELINE_DRAGGABLE]);
          setFolderEnabled(res?.[StorageKeys.FOLDER_ENABLED] !== false);
          setHideArchivedConversations(!!res?.[StorageKeys.FOLDER_HIDE_ARCHIVED]);
          const storedCustomWebsites = res?.[StorageKeys.PROMPT_CUSTOM_WEBSITES];
          setCustomWebsites(Array.isArray(storedCustomWebsites) ? storedCustomWebsites : []);
          setWatermarkRemoverEnabled(res?.[StorageKeys.WATERMARK_REMOVER_ENABLED] !== false);
          setChatWidthEnabled(res?.[StorageKeys.CHAT_WIDTH_ENABLED] !== false);
          setPromptTriggerEnabled(res?.[StorageKeys.PROMPT_TRIGGER_ENABLED] !== false);
          setConversationStatsEnabled(res?.[StorageKeys.CONVERSATION_STATS_ENABLED] !== false);
          setMessageTimestampsEnabled(res?.[StorageKeys.MESSAGE_TIMESTAMPS_ENABLED] !== false);
        }
      );
    } catch {}
  }, []);

  // Validate and normalize URL
  const normalizeUrl = useCallback((url: string): string | null => {
    try {
      let normalized = url.trim().toLowerCase();

      // Remove protocol if present
      normalized = normalized.replace(/^https?:\/\//, '');

      // Remove trailing slash
      normalized = normalized.replace(/\/$/, '');

      // Remove www. prefix
      normalized = normalized.replace(/^www\./, '');

      // Basic validation: must contain at least one dot and valid characters
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
        return null;
      }

      return normalized;
    } catch {
      return null;
    }
  }, []);

  // Add website handler
  const handleAddWebsite = useCallback(() => {
    setWebsiteError('');

    if (!newWebsiteInput.trim()) {
      return;
    }

    const normalized = normalizeUrl(newWebsiteInput);

    if (!normalized) {
      setWebsiteError(t('invalidUrl'));
      return;
    }

    // Check if already exists
    if (customWebsites.includes(normalized)) {
      setWebsiteError(t('invalidUrl'));
      return;
    }

    const updatedWebsites = [...customWebsites, normalized];
    setCustomWebsites(updatedWebsites);
    apply({ customWebsites: updatedWebsites });
    setNewWebsiteInput('');
  }, [newWebsiteInput, customWebsites, normalizeUrl, apply, t]);

  // Remove website handler
  const handleRemoveWebsite = useCallback((website: string) => {
    const updatedWebsites = customWebsites.filter(w => w !== website);
    setCustomWebsites(updatedWebsites);
    apply({ customWebsites: updatedWebsites });
  }, [customWebsites, apply]);

  const normalizedCurrentVersion = normalizeVersionString(extVersion);
  const normalizedLatestVersion = normalizeVersionString(latestVersion);
  const hasUpdate =
    normalizedCurrentVersion && normalizedLatestVersion
      ? compareVersions(normalizedLatestVersion, normalizedCurrentVersion) > 0
      : false;
  const latestReleaseTag = toReleaseTag(latestVersion ?? normalizedLatestVersion ?? undefined);
  const latestReleaseUrl = latestReleaseTag
    ? `https://github.com/Nagi-ovo/gemini-voyager/releases/tag/${latestReleaseTag}`
    : 'https://github.com/Nagi-ovo/gemini-voyager/releases/latest';
  const currentReleaseTag = toReleaseTag(extVersion);
  const releaseUrl = extVersion
    ? `https://github.com/Nagi-ovo/gemini-voyager/releases/tag/${currentReleaseTag ?? `v${extVersion}`}`
    : 'https://github.com/Nagi-ovo/gemini-voyager/releases';

  // Show starred history if requested
  if (showStarredHistory) {
    return <StarredHistory onClose={() => setShowStarredHistory(false)} />;
  }

  return (
    <div className="w-[360px] bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">
            {t('extName')}
          </h1>
          {isDevBuild && (
            <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              DEV
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <DarkModeToggle />
        </div>
      </div>

      <div className="p-5 space-y-4">
        {hasUpdate && normalizedLatestVersion && normalizedCurrentVersion && (
          <Card className="p-3 bg-amber-50 border-amber-200 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-amber-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l4 4h-3v7h-2V6H8l4-4zm6 11v6H6v-6H4v8h16v-8h-2z" />
                </svg>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold leading-tight">{t('newVersionAvailable')}</p>
                <p className="text-xs leading-tight">
                  {t('currentVersionLabel')}: v{normalizedCurrentVersion} · {t('latestVersionLabel')}: v{normalizedLatestVersion}
                </p>
              </div>
              <a
                href={latestReleaseUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-md transition-colors"
              >
                {t('updateNow')}
              </a>
            </div>
          </Card>
        )}
        {/* Gemini Only Notice */}
        {/* Gemini Only Notice - Removed for minimalism */}

        {/* Timeline Options */}
        <Card className="p-3 hover:shadow-sm transition-shadow">
          <CardTitle className="mb-3 text-xs uppercase text-muted-foreground">{t('timelineOptions')}</CardTitle>
          <CardContent className="p-0 space-y-3">
            {/* Scroll Mode */}
            <div>
              <Label className="text-xs font-medium mb-1.5 block">{t('scrollMode')}</Label>
              <div className="relative grid grid-cols-2 rounded-md bg-secondary/50 p-0.5 gap-0.5">
                <div
                  className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-sm bg-primary shadow-sm pointer-events-none transition-all duration-300 ease-out"
                  style={{ left: mode === 'flow' ? '2px' : 'calc(50% + 2px)' }}
                />
                <button
                  className={`relative z-10 px-2 py-1.5 text-xs font-semibold rounded-sm transition-all duration-200 ${mode === 'flow' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  onClick={() => {
                    setMode('flow');
                    apply({ mode: 'flow' });
                  }}
                >
                  {t('flow')}
                </button>
                <button
                  className={`relative z-10 px-2 py-1.5 text-xs font-semibold rounded-sm transition-all duration-200 ${mode === 'jump' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  onClick={() => {
                    setMode('jump');
                    apply({ mode: 'jump' });
                  }}
                >
                  {t('jump')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between group">
              <Label htmlFor="hide-container" className="cursor-pointer text-xs font-medium group-hover:text-primary transition-colors">
                {t('hideOuterContainer')}
              </Label>
              <Switch
                id="hide-container"
                checked={hideContainer}
                className="scale-90"
                onChange={(e) => {
                  setHideContainer(e.target.checked);
                  apply({ hideContainer: e.target.checked });
                }}
              />
            </div>
            {/* ... other switches compressed ... */}
            <div className="flex items-center justify-between group">
              <Label htmlFor="draggable-timeline" className="cursor-pointer text-xs font-medium group-hover:text-primary transition-colors">
                {t('draggableTimeline')}
              </Label>
              <Switch
                id="draggable-timeline"
                checked={draggableTimeline}
                className="scale-90"
                onChange={(e) => {
                  setDraggableTimeline(e.target.checked);
                  apply({ draggableTimeline: e.target.checked });
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Width Settings - Combined */}
        <Card className="p-3 hover:shadow-sm transition-shadow">
          <CardTitle className="mb-3 text-xs uppercase text-muted-foreground">Layout & Width</CardTitle>
          <CardContent className="p-0 space-y-4">
            {/* Chat Width Toggle */}
            <div className="flex items-center justify-between group">
              <div className="space-y-0.5">
                <Label htmlFor="chat-width-enabled" className="cursor-pointer text-xs font-medium">
                  Custom Chat Width
                </Label>
                <p className="text-[10px] text-muted-foreground">Turn off to use Gemini default</p>
              </div>
              <Switch
                id="chat-width-enabled"
                checked={chatWidthEnabled}
                className="scale-90"
                onChange={(e) => {
                  setChatWidthEnabled(e.target.checked);
                  apply({ chatWidthEnabled: e.target.checked });
                }}
              />
            </div>

            {chatWidthEnabled && (
              <WidthSlider
                label=""
                value={chatWidthAdjuster.width}
                min={CHAT_PERCENT.min}
                max={CHAT_PERCENT.max}
                step={1}

                narrowLabel="Narrow"
                wideLabel="Wide"
                onChange={chatWidthAdjuster.handleChange}
                onChangeComplete={chatWidthAdjuster.handleChangeComplete}
              />
            )}

            <div className="h-px bg-border/50 my-2" />

            {/* Edit Input Width */}
            <WidthSlider
              label={t('editInputWidth')}
              value={editInputWidthAdjuster.width}
              min={EDIT_PERCENT.min}
              max={EDIT_PERCENT.max}
              step={1}
              padding="py-0"
              narrowLabel="Narrow"
              wideLabel="Wide"
              onChange={editInputWidthAdjuster.handleChange}
              onChangeComplete={editInputWidthAdjuster.handleChangeComplete}
            />
          </CardContent>
        </Card>
        <div className="flex items-center justify-between group">
          <Label htmlFor="prompt-trigger-enabled" className="cursor-pointer text-sm font-medium">
            Show floating prompt button
          </Label>
          <Switch
            id="prompt-trigger-enabled"
            checked={promptTriggerEnabled}
            onChange={(e) => {
              setPromptTriggerEnabled(e.target.checked);
              apply({ promptTriggerEnabled: e.target.checked });
            }}
          />
        </div>
        <div className="flex items-center justify-between group">
          <Label htmlFor="conversation-stats-enabled" className="cursor-pointer text-sm font-medium">
            Show conversation stats
          </Label>
          <Switch
            id="conversation-stats-enabled"
            checked={conversationStatsEnabled}
            onChange={(e) => {
              setConversationStatsEnabled(e.target.checked);
              apply({ conversationStatsEnabled: e.target.checked });
            }}
          />
        </div>
        <div className="flex items-center justify-between group">
          <Label htmlFor="message-timestamps-enabled" className="cursor-pointer text-sm font-medium">
            Show message timestamps
          </Label>
          <Switch
            id="message-timestamps-enabled"
            checked={messageTimestampsEnabled}
            onChange={(e) => {
              setMessageTimestampsEnabled(e.target.checked);
              apply({ messageTimestampsEnabled: e.target.checked });
            }}
          />
        </div>


        <Card className="p-4 hover:shadow-lg transition-shadow">
          <CardTitle className="mb-4 text-xs uppercase">{t('formulaCopyFormat')}</CardTitle>
          <CardContent className="p-0 space-y-3">
            <p className="text-xs text-muted-foreground mb-3">{t('formulaCopyFormatHint')}</p>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="formulaCopyFormat"
                  value="latex"
                  checked={formulaCopyFormat === 'latex'}
                  onChange={handleFormulaCopyFormatChange}
                  className="w-4 h-4"
                />
                <span className="text-sm">{t('formulaCopyFormatLatex')}</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="formulaCopyFormat"
                  value="unicodemath"
                  checked={formulaCopyFormat === 'unicodemath'}
                  onChange={handleFormulaCopyFormatChange}
                  className="w-4 h-4"
                />
                <span className="text-sm">{t('formulaCopyFormatUnicodeMath')}</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="formulaCopyFormat"
                  value="no-dollar"
                  checked={formulaCopyFormat === 'no-dollar'}
                  onChange={handleFormulaCopyFormatChange}
                  className="w-4 h-4"
                />
                <span className="text-sm">{t('formulaCopyFormatNoDollar')}</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <KeyboardShortcutSettings />

        {/* Send to Gemini (YouTube) */}
        <SendToGeminiSettings t={t} />

        {/* Prompt Manager Options */}
        <Card className="p-4 hover:shadow-lg transition-shadow">
          <CardTitle className="mb-4 text-xs uppercase">{t('promptManagerOptions')}</CardTitle>
          <CardContent className="p-0 space-y-3">
            <div>
              <Label className="text-sm font-medium mb-2 block">{t('customWebsites')}</Label>
              <p className="text-xs text-muted-foreground mb-3">{t('customWebsitesHint')}</p>

              {/* Quick-select buttons for popular websites */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  { domain: 'chatgpt.com', label: 'ChatGPT', Icon: IconChatGPT },
                  { domain: 'claude.ai', label: 'Claude', Icon: IconClaude },
                  { domain: 'grok.com', label: 'Grok', Icon: IconGrok },
                  { domain: 'deepseek.com', label: 'DeepSeek', Icon: IconDeepSeek },
                  { domain: 'qwen.ai', label: 'Qwen', Icon: IconQwen },
                  { domain: 'kimi.com', label: 'Kimi', Icon: IconKimi },
                  { domain: 'notebooklm.google.com', label: 'NotebookLM', Icon: IconNotebookLM },
                  { domain: 'midjourney.com', label: 'Midjourney', Icon: IconMidjourney },
                ].map(({ domain, label, Icon }) => {
                  const isEnabled = customWebsites.includes(domain);
                  return (
                    <button
                      key={domain}
                      onClick={() => {
                        if (isEnabled) {
                          const updated = customWebsites.filter(w => w !== domain);
                          setCustomWebsites(updated);
                          apply({ customWebsites: updated });
                        } else {
                          const updated = [...customWebsites, domain];
                          setCustomWebsites(updated);
                          apply({ customWebsites: updated });
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-medium transition-all flex-grow justify-center min-w-[30%] ${isEnabled
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      title={label}
                    >
                      <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                        <Icon />
                      </span>
                      <span className="truncate">{label}</span>
                      <span className={`shrink-0 w-2.5 text-center text-[10px] transition-opacity ${isEnabled ? 'opacity-100' : 'opacity-0'}`}>
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Website List */}
              {customWebsites.length > 0 && (
                <div className="space-y-2 mb-3">
                  {customWebsites.map((website) => (
                    <div
                      key={website}
                      className="flex items-center justify-between bg-secondary/30 rounded-md px-3 py-2 group hover:bg-secondary/50 transition-colors"
                    >
                      <span className="text-sm font-mono text-foreground/90">{website}</span>
                      <button
                        onClick={() => handleRemoveWebsite(website)}
                        className="text-xs text-destructive hover:text-destructive/80 font-medium opacity-70 group-hover:opacity-100 transition-opacity"
                      >
                        {t('removeWebsite')}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Website Input */}
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={newWebsiteInput}
                    onChange={(e) => {
                      setNewWebsiteInput(e.target.value);
                      setWebsiteError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddWebsite();
                      }
                    }}
                    placeholder={t('customWebsitesPlaceholder')}
                    className="flex-1 min-w-0 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                  <Button
                    onClick={handleAddWebsite}
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                  >
                    {t('addWebsite')}
                  </Button>
                </div>
                {websiteError && (
                  <p className="text-xs text-destructive">{websiteError}</p>
                )}
              </div>

              {/* Note about reloading */}
              <div className="mt-3 p-2 bg-primary/5 border border-primary/20 rounded-md">
                <p className="text-xs text-muted-foreground">{t('customWebsitesNote')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NanoBanana Options */}
        <Card className="p-4 hover:shadow-lg transition-shadow">
          <CardTitle className="mb-4 text-xs uppercase">{t('nanobananaOptions')}</CardTitle>
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between group">
              <div className="flex-1">
                <Label htmlFor="watermark-remover" className="cursor-pointer text-sm font-medium group-hover:text-primary transition-colors">
                  {t('enableNanobananaWatermarkRemover')}
                </Label>
                <p className="text-xs text-muted-foreground mt-1">{t('nanobananaWatermarkRemoverHint')}</p>
              </div>
              <Switch
                id="watermark-remover"
                checked={watermarkRemoverEnabled}
                onChange={(e) => {
                  setWatermarkRemoverEnabled(e.target.checked);
                  apply({ watermarkRemoverEnabled: e.target.checked });
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div >

      {/* Footer */}
      < div className="border-t border-border/50 px-5 py-3 flex items-center justify-between" >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('extensionVersion')}</span>
          <span className="text-foreground">{extVersion ?? '...'}</span>
        </div>
      </div >
    </div >
  );
}
