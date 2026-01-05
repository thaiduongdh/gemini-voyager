export type FeatureFlagName =
  | 'timeline'
  | 'folders'
  | 'promptManager'
  | 'sendToGemini'
  | 'lazyLoadContent';

export type FeatureFlagMap = Record<FeatureFlagName, boolean>;

const DEFAULT_FLAGS: FeatureFlagMap = {
  timeline: true,
  folders: true,
  promptManager: true,
  sendToGemini: true,
  lazyLoadContent: true,
};

const STORAGE_KEY = 'gvFeatureFlags';

type FeatureFlagOverrides = Partial<FeatureFlagMap>;

const readOverrides = (): FeatureFlagOverrides => {
  const overrides: FeatureFlagOverrides = {};

  if (typeof window !== 'undefined') {
    const globalFlags = (window as any).__GV_FEATURE_FLAGS__ as FeatureFlagOverrides | undefined;
    if (globalFlags && typeof globalFlags === 'object') {
      Object.assign(overrides, globalFlags);
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FeatureFlagOverrides;
      if (parsed && typeof parsed === 'object') {
        Object.assign(overrides, parsed);
      }
    }
  } catch {
    // Ignore invalid overrides
  }

  return overrides;
};

export const getFeatureFlags = (): FeatureFlagMap => {
  const overrides = readOverrides();
  return { ...DEFAULT_FLAGS, ...overrides };
};

export const isFeatureEnabled = (flag: FeatureFlagName): boolean => {
  const overrides = readOverrides();
  if (typeof overrides[flag] === 'boolean') return overrides[flag] as boolean;
  return DEFAULT_FLAGS[flag];
};

export const setFeatureFlags = (overrides: FeatureFlagOverrides): void => {
  try {
    const next = { ...readOverrides(), ...overrides };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures
  }
};

export const setFeatureFlag = (flag: FeatureFlagName, value: boolean): void => {
  setFeatureFlags({ [flag]: value });
};
