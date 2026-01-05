import { startChatWidthAdjuster } from './chatWidth/index';
import { startConversationStats } from './conversationStats/index';
import { startDeepResearchExport } from './deepResearch/index';
import { startEditInputWidthAdjuster } from './editInputWidth/index';
import { startExportButton } from './export/index';
import { initKaTeXConfig } from './katexConfig';
import { startMessageTimestamps } from './messageTimestamps/index';
import { startSidebarWidthAdjuster } from './sidebarWidth';
import { startWatermarkRemover } from './watermarkRemover/index';

import { getFeatureFlags } from '@/core/features/flags';
import { storageFacade } from '@/core/services/StorageFacade';
import { StorageKeys } from '@/core/types/common';

import { startFormulaCopy } from '@/features/formulaCopy';

type FolderManagerModule = typeof import('./folder/index');
type PromptManagerModule = typeof import('./prompt/index');
type AIStudioFolderManagerModule = typeof import('./folder/aistudio');
type TimelineModule = typeof import('./timeline/index');
type FloatingUIModule = typeof import('./modules/sendToGemini/floating_ui');

type StartFolderManager = FolderManagerModule['startFolderManager'];
type StartPromptManager = PromptManagerModule['startPromptManager'];


/**
 * Staggered initialization to prevent "thundering herd" problem when multiple tabs
 * are restored simultaneously (e.g., after browser restart).
 *
 * Background tabs get a random delay (3-8s) to distribute initialization load.
 * Foreground tabs initialize immediately for good UX.
 *
 * This prevents triggering Google's rate limiting when restoring sessions with
 * many Gemini tabs containing long conversations.
 */

// Initialization delay constants (in milliseconds)
const HEAVY_FEATURE_INIT_DELAY = 100;  // For resource-intensive features (Timeline, Folder)
const LIGHT_FEATURE_INIT_DELAY = 50;   // For lightweight features
const BACKGROUND_TAB_MIN_DELAY = 3000; // Minimum delay for background tabs
const BACKGROUND_TAB_MAX_DELAY = 8000; // Maximum delay for background tabs (3000 + 5000)

type ContentSettings = {
  customWebsites: string[];
  folderEnabled: boolean;
  promptTriggerEnabled: boolean;
};

const DEFAULT_CONTENT_SETTINGS: ContentSettings = {
  customWebsites: [],
  folderEnabled: true,
  promptTriggerEnabled: true,
};

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function isCustomWebsite(hostname: string, customWebsites: string[]): boolean {
  if (!customWebsites.length) return false;

  const currentHost = normalizeHostname(hostname);

  console.log('[Gemini Voyager] Checking custom websites:', {
    currentHost,
    customWebsites,
    hostname
  });

  const isCustom = customWebsites.some((website: string) => {
    const normalizedWebsite = normalizeHostname(website);
    const matches = currentHost === normalizedWebsite || currentHost.endsWith('.' + normalizedWebsite);
    console.log('[Gemini Voyager] Comparing:', { currentHost, normalizedWebsite, matches });
    return matches;
  });

  console.log('[Gemini Voyager] Is custom website:', isCustom);
  return isCustom;
}

async function getContentSettings(): Promise<ContentSettings> {
  try {
    const result = await storageFacade.getSettings({
      [StorageKeys.PROMPT_CUSTOM_WEBSITES]: [],
      [StorageKeys.FOLDER_ENABLED]: true,
      [StorageKeys.PROMPT_TRIGGER_ENABLED]: true,
    });
    const storedCustomWebsites = result?.[StorageKeys.PROMPT_CUSTOM_WEBSITES];
    const customWebsites = Array.isArray(storedCustomWebsites) ? storedCustomWebsites : [];

    return {
      customWebsites,
      folderEnabled: result?.[StorageKeys.FOLDER_ENABLED] !== false,
      promptTriggerEnabled: result?.[StorageKeys.PROMPT_TRIGGER_ENABLED] !== false,
    };
  } catch (e) {
    console.error('[Gemini Voyager] Error reading settings:', e);
    return { ...DEFAULT_CONTENT_SETTINGS };
  }
}

let timelineModulePromise: Promise<TimelineModule> | null = null;
let folderManagerModulePromise: Promise<FolderManagerModule> | null = null;
let promptManagerModulePromise: Promise<PromptManagerModule> | null = null;
let aiStudioFolderManagerModulePromise: Promise<AIStudioFolderManagerModule> | null = null;
let floatingUIModulePromise: Promise<FloatingUIModule> | null = null;

const loadTimelineModule = () => {
  if (!timelineModulePromise) {
    timelineModulePromise = import('./timeline/index');
  }
  return timelineModulePromise;
};

const loadFolderManagerModule = () => {
  if (!folderManagerModulePromise) {
    folderManagerModulePromise = import('./folder/index');
  }
  return folderManagerModulePromise;
};

const loadPromptManagerModule = () => {
  if (!promptManagerModulePromise) {
    promptManagerModulePromise = import('./prompt/index');
  }
  return promptManagerModulePromise;
};

const loadAIStudioFolderManagerModule = () => {
  if (!aiStudioFolderManagerModulePromise) {
    aiStudioFolderManagerModulePromise = import('./folder/aistudio');
  }
  return aiStudioFolderManagerModulePromise;
};

const loadFloatingUIModule = () => {
  if (!floatingUIModulePromise) {
    floatingUIModulePromise = import('./modules/sendToGemini/floating_ui');
  }
  return floatingUIModulePromise;
};

const preloadModule = (label: string, loader: () => Promise<unknown>): void => {
  loader().catch((err) => {
    console.warn(`[Gemini Voyager] Failed to preload ${label} module`, err);
  });
};

let initialized = false;
let initializationTimer: number | null = null;
let folderManagerInstance: Awaited<ReturnType<StartFolderManager>> | null = null;
let promptManagerInstance: Awaited<ReturnType<StartPromptManager>> | null = null;
let conversationStatsInstance: ReturnType<typeof startConversationStats> | null = null;
let messageTimestampsInstance: ReturnType<typeof startMessageTimestamps> | null = null;

/**
 * Initialize all features sequentially to reduce simultaneous load
 */
async function initializeFeatures(initialSettings?: ContentSettings): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    // Sequential initialization with small delays between features
    // to further reduce simultaneous resource usage
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const hostname = normalizeHostname(location.hostname);
    const isGemini = hostname === 'gemini.google.com';
    const isAIStudio = hostname === 'aistudio.google.com' || hostname === 'aistudio.google.cn';
    const isYouTube = hostname.includes('youtube.com');
    const featureFlags = getFeatureFlags();
    const settings = initialSettings ?? await getContentSettings();

    // Check if this is a custom website (only prompt manager should be enabled)
    const isCustomSite = isCustomWebsite(hostname, settings.customWebsites);

    if (isCustomSite) {
      // Only start prompt manager for custom websites
      console.log('[Gemini Voyager] Custom website detected, starting Prompt Manager only');

      if (!featureFlags.promptManager || !settings.promptTriggerEnabled) {
        console.log('[Gemini Voyager] Prompt Manager is disabled for custom websites');
        return;
      }

      const { startPromptManager } = await loadPromptManagerModule();
      promptManagerInstance = await startPromptManager();
      return;
    }

    console.log('[Gemini Voyager] Not a custom website, checking for Gemini/AI Studio');

    const shouldLoadTimeline = featureFlags.timeline && isGemini;
    const shouldLoadFolders = featureFlags.folders && settings.folderEnabled && isGemini;
    const shouldLoadPromptManager =
      featureFlags.promptManager && settings.promptTriggerEnabled && (isGemini || isAIStudio);
    const shouldLoadAIStudioFolderManager = featureFlags.folders && settings.folderEnabled && isAIStudio;
    const shouldLoadFloatingUI = featureFlags.sendToGemini && isYouTube;

    if (!featureFlags.lazyLoadContent) {
      if (shouldLoadTimeline) preloadModule('timeline', loadTimelineModule);
      if (shouldLoadFolders) preloadModule('folder manager', loadFolderManagerModule);
      if (shouldLoadPromptManager) preloadModule('prompt manager', loadPromptManagerModule);
      if (shouldLoadAIStudioFolderManager) preloadModule('AI Studio folders', loadAIStudioFolderManagerModule);
      if (shouldLoadFloatingUI) preloadModule('Send to Gemini UI', loadFloatingUIModule);
    }

    // Init Floating UI (Send to Gemini) on YouTube
    if (shouldLoadFloatingUI) {
      const { default: initFloatingUI } = await loadFloatingUIModule();
      initFloatingUI();
    }

    if (isGemini) {
      // Timeline is most resource-intensive, start it first
      if (shouldLoadTimeline) {
        const { startTimeline } = await loadTimelineModule();
        startTimeline();
        await delay(HEAVY_FEATURE_INIT_DELAY);
      }

      if (shouldLoadFolders) {
        const { startFolderManager } = await loadFolderManagerModule();
        folderManagerInstance = await startFolderManager();
        await delay(HEAVY_FEATURE_INIT_DELAY);
      }

      startChatWidthAdjuster();
      await delay(LIGHT_FEATURE_INIT_DELAY);

      startEditInputWidthAdjuster();
      await delay(LIGHT_FEATURE_INIT_DELAY);

      startSidebarWidthAdjuster();
      await delay(LIGHT_FEATURE_INIT_DELAY);

      startFormulaCopy();
      await delay(LIGHT_FEATURE_INIT_DELAY);

      // Watermark remover - based on gemini-watermark-remover by journey-ad
      // https://github.com/journey-ad/gemini-watermark-remover
      startWatermarkRemover();
      await delay(LIGHT_FEATURE_INIT_DELAY);

      startDeepResearchExport();
      await delay(LIGHT_FEATURE_INIT_DELAY);

      // Conversation statistics
      conversationStatsInstance = startConversationStats();
      await delay(LIGHT_FEATURE_INIT_DELAY);

      // Message timestamps
      messageTimestampsInstance = startMessageTimestamps();
      await delay(LIGHT_FEATURE_INIT_DELAY);
    }

    if (shouldLoadPromptManager) {
      const { startPromptManager } = await loadPromptManagerModule();
      promptManagerInstance = await startPromptManager();
      await delay(HEAVY_FEATURE_INIT_DELAY);
    }

    if (shouldLoadAIStudioFolderManager) {
      const { startAIStudioFolderManager } = await loadAIStudioFolderManagerModule();
      await startAIStudioFolderManager();
      await delay(HEAVY_FEATURE_INIT_DELAY);
    }

    startExportButton();
  } catch (e) {
    console.error('[Gemini Voyager] Initialization error:', e);
  }
}

/**
 * Determine initialization delay based on tab visibility
 */
function getInitializationDelay(): number {
  // Check if tab is currently visible
  const isVisible = document.visibilityState === 'visible';

  if (isVisible) {
    // Foreground tab: initialize immediately for good UX
    console.log('[Gemini Voyager] Foreground tab detected, initializing immediately');
    return 0;
  } else {
    // Background tab: add random delay to distribute load across multiple tabs
    const randomRange = BACKGROUND_TAB_MAX_DELAY - BACKGROUND_TAB_MIN_DELAY;
    const randomDelay = BACKGROUND_TAB_MIN_DELAY + Math.random() * randomRange;
    console.log(`[Gemini Voyager] Background tab detected, delaying initialization by ${Math.round(randomDelay)}ms`);
    return randomDelay;
  }
}

/**
 * Handle tab visibility changes
 */
function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible' && !initialized) {
    // Tab became visible before initialization completed
    // Cancel any pending delayed initialization and start immediately
    if (initializationTimer !== null) {
      clearTimeout(initializationTimer);
      initializationTimer = null;
      console.log('[Gemini Voyager] Tab became visible, initializing immediately');
    }
    initializeFeatures();
  }
}

// Main initialization logic
void (async () => {
  try {
    // Quick check: only run on supported websites
    const hostname = normalizeHostname(location.hostname);
    const isYouTube = hostname.includes('youtube.com');
    const isSupportedSite =
      hostname === 'gemini.google.com' ||
      hostname === 'aistudio.google.com' ||
      hostname === 'aistudio.google.cn' ||
      isYouTube; // Added YouTube support

    // Initialize KaTeX configuration early to suppress Unicode warnings
    // This must run before any formulas are rendered on the page
    if (isSupportedSite && !isYouTube) {
      initKaTeXConfig();
    }

    // If not a known site, check if it's a custom website (async)
    if (!isSupportedSite) {
      const settings = await getContentSettings();
      if (isCustomWebsite(hostname, settings.customWebsites)) {
        console.log('[Gemini Voyager] Custom website detected:', hostname);
        void initializeFeatures(settings);
      } else {
        // Not a supported site, exit early
        console.log('[Gemini Voyager] Not a supported website, skipping initialization');
      }
      return;
    }

    const delay = getInitializationDelay();

    if (delay === 0) {
      // Immediate initialization for foreground tabs
      void initializeFeatures();
    } else {
      // Delayed initialization for background tabs
      initializationTimer = window.setTimeout(() => {
        initializationTimer = null;
        void initializeFeatures();
      }, delay);
    }

    // Listen for visibility changes to handle tab switching
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Setup cleanup on page unload to prevent memory leaks
    window.addEventListener('beforeunload', () => {
      try {
        if (folderManagerInstance) {
          folderManagerInstance.destroy();
          folderManagerInstance = null;
        }
        if (promptManagerInstance) {
          promptManagerInstance.destroy();
          promptManagerInstance = null;
        }
        if (conversationStatsInstance) {
          conversationStatsInstance.destroy();
          conversationStatsInstance = null;
        }
        if (messageTimestampsInstance) {
          messageTimestampsInstance.destroy();
          messageTimestampsInstance = null;
        }
      } catch (e) {
        console.error('[Gemini Voyager] Cleanup error:', e);
      }
    });

  } catch (e) {
    console.error('[Gemini Voyager] Fatal initialization error:', e);
  }
})();
