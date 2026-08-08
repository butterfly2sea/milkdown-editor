export interface AutoSaveConfig {
  enabled: boolean;
  /** Idle time after the last edit before the document is written to disk. */
  delaySeconds: number;
}

/** Offered in the settings dropdown; anything else falls back to the default. */
export const AUTO_SAVE_DELAYS = [2, 5, 10, 30, 60];

const CONFIG_KEY = 'auto-save-config';

/** Matches the behaviour auto-save had before it was configurable, so an
 *  upgrade changes nothing for existing users. */
const DEFAULT_CONFIG: AutoSaveConfig = { enabled: true, delaySeconds: 2 };

export function getAutoSaveConfig(): AutoSaveConfig {
  const saved = localStorage.getItem(CONFIG_KEY);
  if (!saved) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(saved) as Partial<AutoSaveConfig>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_CONFIG.enabled,
      delaySeconds: AUTO_SAVE_DELAYS.includes(parsed.delaySeconds as number)
        ? (parsed.delaySeconds as number)
        : DEFAULT_CONFIG.delaySeconds,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAutoSaveConfig(config: AutoSaveConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
