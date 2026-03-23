import { WebDAVClient } from './webdav-client';
import { getSyncConfig, getSyncMappings, addSyncMapping, removeSyncMapping, type SyncConfig, type SyncMapping } from './sync-config';
import { readTextFile, writeTextFile, stat } from '@tauri-apps/plugin-fs';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'disabled';
export type SyncFileStatus = 'synced' | 'syncing' | 'error';

interface SyncManifestEntry {
  localMtime: number;
  remoteMtime: number;
  lastSyncedAt: number;
}

export class SyncManager {
  private client = new WebDAVClient();
  private config: SyncConfig | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private manifest: Record<string, SyncManifestEntry> = {};
  private _status: SyncStatus = 'disabled';
  private _fileStatuses = new Map<string, SyncFileStatus>();

  public onStatusChange?: (status: SyncStatus) => void;
  public onFileStatusChange?: (statuses: Map<string, SyncFileStatus>) => void;
  public onConflict?: (fileName: string) => Promise<'local' | 'remote' | 'skip'>;

  get status(): SyncStatus { return this._status; }
  get fileStatuses(): Map<string, SyncFileStatus> { return this._fileStatuses; }
  get webdavClient(): WebDAVClient { return this.client; }
  get isConfigured(): boolean { return this.config?.enabled === true; }

  init(): void {
    this.config = getSyncConfig();
    if (!this.config?.enabled) {
      this.setStatus('disabled');
      return;
    }
    this.client.configure(this.config.serverUrl, this.config.username, this.config.password);
    this.loadManifest();
    // Initialize file statuses from mappings
    for (const m of getSyncMappings()) {
      this._fileStatuses.set(m.localPath, 'synced');
    }
    this.setStatus('idle');
    this.startPeriodicSync();
    this.notifyFileStatusChange();
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  restart(): void {
    this.stop();
    this._fileStatuses.clear();
    this.init();
  }

  // Mark a local file for sync and upload it immediately
  async markForSync(localPath: string, remotePath: string): Promise<void> {
    if (!this.config?.enabled) return;
    addSyncMapping(localPath, remotePath);
    this.setFileStatus(localPath, 'syncing');
    try {
      const content = await readTextFile(localPath);
      await this.client.putFile(remotePath, content);
      const info = await stat(localPath);
      this.manifest[localPath] = {
        localMtime: info.mtime?.getTime() ?? Date.now(),
        remoteMtime: Date.now(),
        lastSyncedAt: Date.now(),
      };
      this.saveManifest();
      this.setFileStatus(localPath, 'synced');
    } catch (err) {
      console.error('[sync] mark+upload failed:', err);
      this.setFileStatus(localPath, 'error');
    }
  }

  // Remove sync mapping
  unmarkSync(localPath: string): void {
    removeSyncMapping(localPath);
    this._fileStatuses.delete(localPath);
    delete this.manifest[localPath];
    this.saveManifest();
    this.notifyFileStatusChange();
  }

  // Upload a single file after save (only if mapped)
  async uploadFile(localPath: string, content: string): Promise<void> {
    if (!this.config?.enabled) return;
    const mappings = getSyncMappings();
    const mapping = mappings.find(m => m.localPath === localPath);
    if (!mapping) return; // Not mapped, skip

    this.setFileStatus(localPath, 'syncing');
    try {
      await this.client.putFile(mapping.remotePath, content);
      const info = await stat(localPath);
      this.manifest[localPath] = {
        localMtime: info.mtime?.getTime() ?? Date.now(),
        remoteMtime: Date.now(),
        lastSyncedAt: Date.now(),
      };
      this.saveManifest();
      this.setFileStatus(localPath, 'synced');
    } catch (err) {
      console.error('[sync] upload failed:', err);
      this.setFileStatus(localPath, 'error');
    }
  }

  // Sync all mapped files
  async sync(): Promise<void> {
    if (!this.config?.enabled) return;
    const mappings = getSyncMappings();
    if (mappings.length === 0) return;

    this.setStatus('syncing');
    let hasError = false;

    for (const mapping of mappings) {
      try {
        await this.syncOneFile(mapping);
      } catch (err) {
        console.error('[sync] sync failed for:', mapping.localPath, err);
        this.setFileStatus(mapping.localPath, 'error');
        hasError = true;
      }
    }

    this.saveManifest();
    this.setStatus(hasError ? 'error' : 'idle');
  }

  // Download a remote file to local path and create mapping
  async downloadAndMap(remotePath: string, localPath: string): Promise<void> {
    if (!this.config?.enabled) return;
    try {
      const content = await this.client.getFile(remotePath);
      await writeTextFile(localPath, content);
      addSyncMapping(localPath, remotePath);
      const info = await stat(localPath);
      this.manifest[localPath] = {
        localMtime: info.mtime?.getTime() ?? Date.now(),
        remoteMtime: Date.now(),
        lastSyncedAt: Date.now(),
      };
      this.saveManifest();
      this.setFileStatus(localPath, 'synced');
    } catch (err) {
      console.error('[sync] download failed:', err);
      throw err;
    }
  }

  private async syncOneFile(mapping: SyncMapping): Promise<void> {
    this.setFileStatus(mapping.localPath, 'syncing');
    const manifestEntry = this.manifest[mapping.localPath];

    let localMtime: number | null = null;
    let localContent: string | null = null;
    try {
      const info = await stat(mapping.localPath);
      localMtime = info.mtime?.getTime() ?? null;
    } catch {
      // Local file may not exist
    }

    let remoteMtime: number | null = null;
    try {
      // Check remote file exists by trying to get info
      const remoteFiles = await this.client.listFiles(
        mapping.remotePath.substring(0, mapping.remotePath.lastIndexOf('/')) || '/'
      );
      const remoteFile = remoteFiles.find(f => f.path === mapping.remotePath ||
        mapping.remotePath.endsWith('/' + f.name));
      if (remoteFile) remoteMtime = remoteFile.mtime;
    } catch { /* remote may not exist */ }

    if (localMtime !== null && remoteMtime === null) {
      // Local exists, remote doesn't -> upload
      localContent = await readTextFile(mapping.localPath);
      await this.client.putFile(mapping.remotePath, localContent);
      this.manifest[mapping.localPath] = { localMtime, remoteMtime: Date.now(), lastSyncedAt: Date.now() };
    } else if (localMtime === null && remoteMtime !== null) {
      // Remote exists, local doesn't -> download
      const content = await this.client.getFile(mapping.remotePath);
      await writeTextFile(mapping.localPath, content);
      const info = await stat(mapping.localPath);
      this.manifest[mapping.localPath] = { localMtime: info.mtime?.getTime() ?? Date.now(), remoteMtime, lastSyncedAt: Date.now() };
    } else if (localMtime !== null && remoteMtime !== null && manifestEntry) {
      const localChanged = localMtime > manifestEntry.lastSyncedAt;
      const remoteChanged = remoteMtime > manifestEntry.remoteMtime;

      if (localChanged && !remoteChanged) {
        localContent = await readTextFile(mapping.localPath);
        await this.client.putFile(mapping.remotePath, localContent);
        this.manifest[mapping.localPath] = { localMtime, remoteMtime: Date.now(), lastSyncedAt: Date.now() };
      } else if (!localChanged && remoteChanged) {
        const content = await this.client.getFile(mapping.remotePath);
        await writeTextFile(mapping.localPath, content);
        const info = await stat(mapping.localPath);
        this.manifest[mapping.localPath] = { localMtime: info.mtime?.getTime() ?? Date.now(), remoteMtime, lastSyncedAt: Date.now() };
      } else if (localChanged && remoteChanged) {
        const resolution = await this.onConflict?.(mapping.localPath) ?? 'skip';
        if (resolution === 'local') {
          localContent = await readTextFile(mapping.localPath);
          await this.client.putFile(mapping.remotePath, localContent);
          this.manifest[mapping.localPath] = { localMtime, remoteMtime: Date.now(), lastSyncedAt: Date.now() };
        } else if (resolution === 'remote') {
          const content = await this.client.getFile(mapping.remotePath);
          await writeTextFile(mapping.localPath, content);
          const info = await stat(mapping.localPath);
          this.manifest[mapping.localPath] = { localMtime: info.mtime?.getTime() ?? Date.now(), remoteMtime, lastSyncedAt: Date.now() };
        }
      }
      // Both unchanged -> skip
    } else if (localMtime !== null && remoteMtime !== null && !manifestEntry) {
      // First sync, local newer wins
      localContent = await readTextFile(mapping.localPath);
      await this.client.putFile(mapping.remotePath, localContent);
      this.manifest[mapping.localPath] = { localMtime, remoteMtime: Date.now(), lastSyncedAt: Date.now() };
    }

    this.setFileStatus(mapping.localPath, 'synced');
  }

  private startPeriodicSync(): void {
    if (!this.config) return;
    const intervalMs = (this.config.syncIntervalMinutes || 5) * 60 * 1000;
    this.intervalId = setInterval(() => this.sync(), intervalMs);
  }

  private loadManifest(): void {
    try {
      const saved = localStorage.getItem('webdav-sync-manifest');
      this.manifest = saved ? JSON.parse(saved) : {};
    } catch { this.manifest = {}; }
  }

  private saveManifest(): void {
    localStorage.setItem('webdav-sync-manifest', JSON.stringify(this.manifest));
  }

  private setStatus(status: SyncStatus): void {
    this._status = status;
    this.onStatusChange?.(status);
  }

  private setFileStatus(localPath: string, status: SyncFileStatus): void {
    this._fileStatuses.set(localPath, status);
    this.notifyFileStatusChange();
  }

  private notifyFileStatusChange(): void {
    this.onFileStatusChange?.(this._fileStatuses);
  }
}
