import { WebDAVClient } from './webdav-client';
import { getSyncConfig, getSyncMappings, addSyncMapping, removeSyncMapping, contentHash, type SyncConfig, type SyncMapping } from './sync-config';
import { readTextFile, writeTextFile, stat } from '@tauri-apps/plugin-fs';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'disabled';
export type SyncFileStatus = 'synced' | 'syncing' | 'error';

interface SyncManifestEntry {
  localMtime: number;
  remoteMtime: number;
  lastSyncedAt: number;
  localHash: string;
  remoteHash: string;
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
  /** Called when only the remote changed. Return 'download' to overwrite local, 'ignore' to skip. */
  public onRemoteChanged?: (fileName: string) => Promise<'download' | 'ignore'>;
  /** Called when both sides changed. Receives local and remote content. Return merged content or null to skip. */
  public onConflict?: (fileName: string, localContent: string, remoteContent: string) => Promise<string | null>;

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

  async markForSync(localPath: string, remotePath: string): Promise<void> {
    if (!this.config?.enabled) return;
    addSyncMapping(localPath, remotePath);
    this.setFileStatus(localPath, 'syncing');
    try {
      const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
      if (remoteDir) await this.client.mkdir(remoteDir);
      const content = await readTextFile(localPath);
      await this.client.putFile(remotePath, content);
      const info = await stat(localPath);
      const hash = contentHash(content);
      this.manifest[localPath] = {
        localMtime: info.mtime?.getTime() ?? Date.now(),
        remoteMtime: Date.now(),
        lastSyncedAt: Date.now(),
        localHash: hash,
        remoteHash: hash,
      };
      this.saveManifest();
      this.setFileStatus(localPath, 'synced');
    } catch (err) {
      console.error('[sync] mark+upload failed:', err);
      this.setFileStatus(localPath, 'error');
    }
  }

  unmarkSync(localPath: string): void {
    removeSyncMapping(localPath);
    this._fileStatuses.delete(localPath);
    delete this.manifest[localPath];
    this.saveManifest();
    this.notifyFileStatusChange();
  }

  async uploadFile(localPath: string, content: string): Promise<void> {
    if (!this.config?.enabled) return;
    const mapping = getSyncMappings().find(m => m.localPath === localPath);
    if (!mapping) return;

    this.setFileStatus(localPath, 'syncing');
    try {
      await this.client.putFile(mapping.remotePath, content);
      const info = await stat(localPath);
      const hash = contentHash(content);
      this.manifest[localPath] = {
        localMtime: info.mtime?.getTime() ?? Date.now(),
        remoteMtime: Date.now(),
        lastSyncedAt: Date.now(),
        localHash: hash,
        remoteHash: hash,
      };
      this.saveManifest();
      this.setFileStatus(localPath, 'synced');
    } catch (err) {
      console.error('[sync] upload failed:', err);
      this.setFileStatus(localPath, 'error');
    }
  }

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

  async downloadAndMap(remotePath: string, localPath: string): Promise<void> {
    if (!this.config?.enabled) return;
    try {
      const content = await this.client.getFile(remotePath);
      await writeTextFile(localPath, content);
      addSyncMapping(localPath, remotePath);
      const info = await stat(localPath);
      const hash = contentHash(content);
      this.manifest[localPath] = {
        localMtime: info.mtime?.getTime() ?? Date.now(),
        remoteMtime: Date.now(),
        lastSyncedAt: Date.now(),
        localHash: hash,
        remoteHash: hash,
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
    const entry = this.manifest[mapping.localPath];

    // Step 1: Check local mtime
    let localMtime: number | null = null;
    let localContent: string | null = null;
    let localHash: string | null = null;
    try {
      const info = await stat(mapping.localPath);
      localMtime = info.mtime?.getTime() ?? null;
    } catch { /* local file may not exist */ }

    // Step 2: If local mtime changed, read content and compute hash
    const localMtimeChanged = localMtime !== null && (!entry || localMtime !== entry.localMtime);
    if (localMtimeChanged && localMtime !== null) {
      localContent = await readTextFile(mapping.localPath);
      localHash = contentHash(localContent);
    }

    // Step 3: Check remote mtime via PROPFIND
    let remoteMtime: number | null = null;
    try {
      const parentDir = mapping.remotePath.substring(0, mapping.remotePath.lastIndexOf('/')) || '/';
      const remoteFiles = await this.client.listFiles(parentDir);
      const remoteFile = remoteFiles.find(f =>
        f.path === mapping.remotePath || mapping.remotePath.endsWith('/' + f.name)
      );
      if (remoteFile) remoteMtime = remoteFile.mtime;
    } catch { /* remote may not exist */ }

    // Step 4: If remote mtime changed, download content and compute hash
    let remoteContent: string | null = null;
    let remoteHash: string | null = null;
    const remoteMtimeChanged = remoteMtime !== null && (!entry || remoteMtime !== entry.remoteMtime);
    if (remoteMtimeChanged) {
      remoteContent = await this.client.getFile(mapping.remotePath);
      remoteHash = contentHash(remoteContent);
    }

    // Step 5: Compare hashes to determine action
    const localReallyChanged = localHash !== null && (!entry || localHash !== entry.localHash);
    const remoteReallyChanged = remoteHash !== null && (!entry || remoteHash !== entry.remoteHash);

    if (!entry) {
      // First sync: upload local to remote
      if (localMtime !== null) {
        if (!localContent) localContent = await readTextFile(mapping.localPath);
        if (!localHash) localHash = contentHash(localContent);
        await this.client.putFile(mapping.remotePath, localContent);
        this.updateManifest(mapping.localPath, localMtime, Date.now(), localHash, localHash);
      }
    } else if (localMtime !== null && remoteMtime === null) {
      // Remote deleted, re-upload
      if (!localContent) localContent = await readTextFile(mapping.localPath);
      if (!localHash) localHash = contentHash(localContent);
      await this.client.putFile(mapping.remotePath, localContent);
      this.updateManifest(mapping.localPath, localMtime, Date.now(), localHash, localHash);
    } else if (localMtime === null && remoteMtime !== null) {
      // Local deleted, re-download
      if (!remoteContent) remoteContent = await this.client.getFile(mapping.remotePath);
      if (!remoteHash) remoteHash = contentHash(remoteContent);
      await writeTextFile(mapping.localPath, remoteContent);
      const info = await stat(mapping.localPath);
      this.updateManifest(mapping.localPath, info.mtime?.getTime() ?? Date.now(), remoteMtime, remoteHash, remoteHash);
    } else if (localReallyChanged && !remoteReallyChanged) {
      // Only local changed → upload
      if (!localContent) localContent = await readTextFile(mapping.localPath);
      if (!localHash) localHash = contentHash(localContent);
      await this.client.putFile(mapping.remotePath, localContent);
      this.updateManifest(mapping.localPath, localMtime!, Date.now(), localHash, localHash);
    } else if (!localReallyChanged && remoteReallyChanged) {
      // Only remote changed → prompt user
      const fileName = mapping.localPath.split('/').pop() || mapping.localPath;
      const decision = await this.onRemoteChanged?.(fileName) ?? 'ignore';
      if (decision === 'download') {
        if (!remoteContent) remoteContent = await this.client.getFile(mapping.remotePath);
        if (!remoteHash) remoteHash = contentHash(remoteContent);
        await writeTextFile(mapping.localPath, remoteContent);
        const info = await stat(mapping.localPath);
        this.updateManifest(mapping.localPath, info.mtime?.getTime() ?? Date.now(), remoteMtime!, remoteHash, remoteHash);
      } else {
        // Ignore: update remote hash in manifest to suppress future prompts
        this.manifest[mapping.localPath] = {
          ...entry,
          remoteMtime: remoteMtime!,
          remoteHash: remoteHash!,
        };
      }
    } else if (localReallyChanged && remoteReallyChanged) {
      // Both changed → conflict, show merge UI
      if (!localContent) localContent = await readTextFile(mapping.localPath);
      if (!remoteContent) remoteContent = await this.client.getFile(mapping.remotePath);
      const fileName = mapping.localPath.split('/').pop() || mapping.localPath;
      const merged = await this.onConflict?.(fileName, localContent, remoteContent);
      if (merged !== null && merged !== undefined) {
        // Write merged result to both local and remote
        await writeTextFile(mapping.localPath, merged);
        await this.client.putFile(mapping.remotePath, merged);
        const info = await stat(mapping.localPath);
        const mergedHash = contentHash(merged);
        this.updateManifest(mapping.localPath, info.mtime?.getTime() ?? Date.now(), Date.now(), mergedHash, mergedHash);
      }
      // null = user cancelled, skip
    }
    // else: neither changed → skip

    this.setFileStatus(mapping.localPath, 'synced');
  }

  private updateManifest(localPath: string, localMtime: number, remoteMtime: number, localHash: string, remoteHash: string): void {
    this.manifest[localPath] = { localMtime, remoteMtime, lastSyncedAt: Date.now(), localHash, remoteHash };
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
