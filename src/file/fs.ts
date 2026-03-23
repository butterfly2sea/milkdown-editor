import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, readDir, remove, mkdir, stat } from '@tauri-apps/plugin-fs';

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileTreeNode[];
}

export class FileManager {
  private _currentPath: string | null = null;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private _hasUnsavedChanges = false;
  private _lastSavedContent: string = '';
  private _lastModifiedAt: number | null = null;
  private _openFolderPath: string | null = null;
  private _openFolderName: string | null = null;
  public onAutoSave?: () => void;

  get currentFileName(): string {
    if (!this._currentPath) return 'Untitled';
    const parts = this._currentPath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || 'Untitled';
  }

  get currentPath(): string | null {
    return this._currentPath;
  }

  get hasUnsavedChanges(): boolean {
    return this._hasUnsavedChanges;
  }

  set hasUnsavedChanges(v: boolean) {
    this._hasUnsavedChanges = v;
  }

  setBaseContent(content: string): void {
    this._lastSavedContent = content;
  }

  hasRealChanges(currentContent: string): boolean {
    return currentContent !== this._lastSavedContent;
  }

  async openFolder(): Promise<FileTreeNode | null> {
    try {
      const dir = await open({
        multiple: false,
        directory: true,
        // On macOS, press Cmd+Shift+. in the dialog to show hidden files
      });
      if (!dir) return null;
      this._openFolderPath = dir as string;
      this._openFolderName = this.getBaseName(dir as string);
      return this.readDirectory(this._openFolderPath, this._openFolderName);
    } catch {
      return null;
    }
  }

  async refreshFolder(): Promise<FileTreeNode | null> {
    if (!this._openFolderPath || !this._openFolderName) return null;
    try {
      return this.readDirectory(this._openFolderPath, this._openFolderName);
    } catch {
      return null;
    }
  }

  get hasFolderOpen(): boolean {
    return this._openFolderPath !== null;
  }

  private async readDirectory(dirPath: string, name: string): Promise<FileTreeNode> {
    const children: FileTreeNode[] = [];

    try {
      const entries = await readDir(dirPath);
      for (const entry of entries) {
        const entryPath = `${dirPath}/${entry.name}`;
        if (entry.isDirectory) {
          try {
            const child = await this.readDirectory(entryPath, entry.name);
            // Only include directories that contain md files (directly or nested)
            if (child.children && child.children.length > 0) {
              children.push(child);
            }
          } catch {
            // Skip directories we can't read (permission denied on macOS hidden dirs, etc.)
          }
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
          children.push({
            name: entry.name,
            path: entryPath,
            isDir: false,
          });
        }
      }
    } catch {
      // Permission denied or read error
    }

    // Sort: directories first, then files, alphabetically
    children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { name, path: dirPath, isDir: true, children };
  }

  async openFile(path?: string): Promise<string> {
    try {
      if (!path) {
        const selected = await open({
          multiple: false,
          directory: false,
          filters: [
            { name: 'Markdown', extensions: ['md', 'markdown'] },
          ],
        });
        if (!selected) return '';
        path = selected as string;
      }
      this._currentPath = path;
      const content = await readTextFile(path);
      this._lastSavedContent = content;
      this._hasUnsavedChanges = false;
      try {
        const info = await stat(path);
        this._lastModifiedAt = info.mtime?.getTime() ?? null;
      } catch {
        this._lastModifiedAt = null;
      }
      return content;
    } catch {
      return '';
    }
  }

  async saveFile(content: string): Promise<boolean> {
    if (!this._currentPath) {
      return this.saveAs(content);
    }
    try {
      await writeTextFile(this._currentPath, content);
      this._lastSavedContent = content;
      this._hasUnsavedChanges = false;
      try {
        const info = await stat(this._currentPath);
        this._lastModifiedAt = info.mtime?.getTime() ?? null;
      } catch {
        this._lastModifiedAt = null;
      }
      return true;
    } catch {
      return false;
    }
  }

  async saveAs(content: string): Promise<boolean> {
    try {
      const path = await save({
        defaultPath: this._currentPath || 'untitled.md',
        filters: [
          { name: 'Markdown', extensions: ['md'] },
        ],
      });
      if (!path) return false;
      this._currentPath = path;
      await writeTextFile(path, content);
      this._lastSavedContent = content;
      this._hasUnsavedChanges = false;
      try {
        const info = await stat(path);
        this._lastModifiedAt = info.mtime?.getTime() ?? null;
      } catch {
        this._lastModifiedAt = null;
      }
      return true;
    } catch {
      return false;
    }
  }

  newFile(): void {
    this._currentPath = null;
    this._lastSavedContent = '';
    this._lastModifiedAt = null;
    this._hasUnsavedChanges = false;
  }

  scheduleAutoSave(content: string): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(async () => {
      if (this._currentPath && this._hasUnsavedChanges) {
        const success = await this.saveFile(content);
        if (success) {
          this.onAutoSave?.();
        }
      }
    }, 2000);
  }

  async createFile(dirPath: string, name: string): Promise<string | null> {
    try {
      if (!name.endsWith('.md')) name += '.md';
      const filePath = `${dirPath}/${name}`;
      await writeTextFile(filePath, '');
      return filePath;
    } catch {
      return null;
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    try {
      await remove(path);
      return true;
    } catch {
      return false;
    }
  }

  async checkExternalChange(): Promise<boolean> {
    if (!this._currentPath || this._lastModifiedAt === null) return false;
    try {
      const info = await stat(this._currentPath);
      const currentMtime = info.mtime?.getTime() ?? null;
      return currentMtime !== null && currentMtime !== this._lastModifiedAt;
    } catch {
      return false;
    }
  }

  async reloadFile(): Promise<string | null> {
    if (!this._currentPath) return null;
    try {
      const content = await readTextFile(this._currentPath);
      const info = await stat(this._currentPath);
      this._lastModifiedAt = info.mtime?.getTime() ?? null;
      this._lastSavedContent = content;
      this._hasUnsavedChanges = false;
      return content;
    } catch {
      return null;
    }
  }

  async dismissExternalChange(): Promise<void> {
    if (!this._currentPath) return;
    try {
      const info = await stat(this._currentPath);
      this._lastModifiedAt = info.mtime?.getTime() ?? null;
    } catch {
      // ignore
    }
  }

  private getBaseName(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || path;
  }
}
