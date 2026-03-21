import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, readDir, remove, mkdir } from '@tauri-apps/plugin-fs';

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

  async openFolder(): Promise<FileTreeNode | null> {
    try {
      const dir = await open({
        multiple: false,
        directory: true,
      });
      if (!dir) return null;
      return this.readDirectory(dir as string, this.getBaseName(dir as string));
    } catch {
      return null;
    }
  }

  private async readDirectory(dirPath: string, name: string): Promise<FileTreeNode> {
    const children: FileTreeNode[] = [];

    try {
      const entries = await readDir(dirPath);
      for (const entry of entries) {
        const entryPath = `${dirPath}/${entry.name}`;
        if (entry.isDirectory) {
          const child = await this.readDirectory(entryPath, entry.name);
          // Only include directories that contain md files (directly or nested)
          if (child.children && child.children.length > 0) {
            children.push(child);
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
      this._hasUnsavedChanges = false;
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
      this._hasUnsavedChanges = false;
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
      this._hasUnsavedChanges = false;
      return true;
    } catch {
      return false;
    }
  }

  newFile(): void {
    this._currentPath = null;
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

  private getBaseName(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || path;
  }
}
