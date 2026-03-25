export interface SyncConfig {
  serverUrl: string;
  username: string;
  password: string;
  remotePath: string;
  syncIntervalMinutes: number;
  enabled: boolean;
}

export interface SyncMapping {
  localPath: string;
  remotePath: string;
}

const CONFIG_KEY = 'webdav-sync-config';
const MAPPINGS_KEY = 'webdav-sync-mappings';

export function getSyncConfig(): SyncConfig | null {
  const saved = localStorage.getItem(CONFIG_KEY);
  if (!saved) return null;
  try { return JSON.parse(saved); } catch { return null; }
}

export function saveSyncConfig(config: SyncConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearSyncConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}

export function getSyncMappings(): SyncMapping[] {
  const saved = localStorage.getItem(MAPPINGS_KEY);
  if (!saved) return [];
  try { return JSON.parse(saved); } catch { return []; }
}

export function saveSyncMappings(mappings: SyncMapping[]): void {
  localStorage.setItem(MAPPINGS_KEY, JSON.stringify(mappings));
}

export function addSyncMapping(localPath: string, remotePath: string): void {
  const mappings = getSyncMappings();
  if (!mappings.some(m => m.localPath === localPath)) {
    mappings.push({ localPath, remotePath });
    saveSyncMappings(mappings);
  }
}

export function removeSyncMapping(localPath: string): void {
  const mappings = getSyncMappings().filter(m => m.localPath !== localPath);
  saveSyncMappings(mappings);
}

export function isSynced(localPath: string): boolean {
  return getSyncMappings().some(m => m.localPath === localPath);
}

export function getSyncMapping(localPath: string): SyncMapping | undefined {
  return getSyncMappings().find(m => m.localPath === localPath);
}

/** Fast string hash for content comparison (not cryptographic) */
export function contentHash(content: string): string {
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) - h) + content.charCodeAt(i);
    h |= 0;
  }
  return h.toString(36);
}
