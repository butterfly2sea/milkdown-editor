import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, readDir, remove, mkdir, stat } from '@tauri-apps/plugin-fs';
import type { AppStore } from '../app/store';

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileTreeNode[];
}

export class FileManager {
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastSavedContent: string = '';
  private _lastModifiedAt: number | null = null;
  private _openFolderPath: string | null = null;
  private _openFolderName: string | null = null;
  private _lastFolderTree: FileTreeNode | null = null;
  private _lastError: unknown = null;
  public onAutoSave?: () => void;

  constructor(private store: AppStore) {}

  get lastError(): unknown {
    return this._lastError;
  }

  setBaseContent(content: string): void {
    this._lastSavedContent = content;
  }

  hasRealChanges(currentContent: string): boolean {
    return currentContent !== this._lastSavedContent;
  }

  async openFolder(): Promise<FileTreeNode | null> {
    this._lastError = null;
    try {
      const dir = await open({
        multiple: false,
        directory: true,
        // On macOS, press Cmd+Shift+. in the dialog to show hidden files
      });
      if (!dir) return null;
      this._openFolderPath = dir as string;
      this._openFolderName = this.getBaseName(dir as string);
      const tree = await this.readDirectory(this._openFolderPath, this._openFolderName);
      this._lastFolderTree = tree;
      return tree;
    } catch (err) {
      this._lastError = err;
      return null;
    }
  }

  async openFolderByPath(dirPath: string): Promise<FileTreeNode | null> {
    this._lastError = null;
    try {
      this._openFolderPath = dirPath;
      this._openFolderName = this.getBaseName(dirPath);
      const tree = await this.readDirectory(this._openFolderPath, this._openFolderName);
      this._lastFolderTree = tree;
      return tree;
    } catch (err) {
      this._lastError = err;
      return null;
    }
  }

  async refreshFolder(): Promise<FileTreeNode | null> {
    if (!this._openFolderPath || !this._openFolderName) return null;
    this._lastError = null;
    try {
      const tree = await this.readDirectory(this._openFolderPath, this._openFolderName);
      this._lastFolderTree = tree;
      return tree;
    } catch (err) {
      this._lastError = err;
      return null;
    }
  }

  async refreshFolderTopLevel(): Promise<FileTreeNode | null> {
    if (!this._openFolderPath || !this._openFolderName) return null;
    this._lastError = null;
    try {
      const tree = await this.readDirectoryTopLevel(this._openFolderPath, this._openFolderName);
      const merged = this.mergeExistingSubtrees(tree, this._lastFolderTree);
      this._lastFolderTree = merged;
      return merged;
    } catch (err) {
      this._lastError = err;
      return null;
    }
  }

  private async readDirectoryTopLevel(dirPath: string, name: string): Promise<FileTreeNode> {
    const children: FileTreeNode[] = [];
    const existingDirectoryPaths = new Set<string>();

    try {
      const entries = await readDir(dirPath);
      for (const entry of entries) {
        const entryPath = `${dirPath}/${entry.name}`;
        if (entry.isDirectory) {
          existingDirectoryPaths.add(entryPath);
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

    for (const child of this._lastFolderTree?.children ?? []) {
      if (child.isDir && existingDirectoryPaths.has(child.path)) children.push(child);
    }

    return { name, path: dirPath, isDir: true, children: this.sortNodes(children) };
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

    return { name, path: dirPath, isDir: true, children: this.sortNodes(children) };
  }

  private sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  private mergeExistingSubtrees(next: FileTreeNode, previous: FileTreeNode | null): FileTreeNode {
    if (!previous?.children || !next.children) return next;

    const previousChildren = new Map(previous.children.map((child) => [child.path, child]));
    const children = next.children.map((child) => {
      if (!child.isDir) return child;
      const previousChild = previousChildren.get(child.path);
      if (!previousChild?.children) return child;
      return {
        ...child,
        children: previousChild.children,
      };
    });

    return { ...next, children };
  }

  /** Run the open dialog without loading anything. Callers need the path up
   *  front so they can check whether another window already owns the document
   *  before this one commits to it. */
  async pickOpenPath(): Promise<string | null> {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown'] },
        ],
      });
      return (selected as string | null) || null;
    } catch {
      return null;
    }
  }

  /** Counterpart of {@link pickOpenPath} for "Save As". */
  async pickSavePath(): Promise<string | null> {
    try {
      const filePath = this.store.get('currentFilePath');
      const path = await save({
        defaultPath: filePath || 'untitled.md',
        filters: [
          { name: 'Markdown', extensions: ['md'] },
        ],
      });
      return path || null;
    } catch {
      return null;
    }
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
      this.setCurrentPath(path);
      const content = await readTextFile(path);
      this._lastSavedContent = content;
      this.store.set('hasUnsavedChanges', false);
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
    const filePath = this.store.get('currentFilePath');
    if (!filePath) {
      return this.saveAs(content);
    }
    try {
      await writeTextFile(filePath, content);
      this._lastSavedContent = content;
      this.store.set('hasUnsavedChanges', false);
      try {
        const info = await stat(filePath);
        this._lastModifiedAt = info.mtime?.getTime() ?? null;
      } catch {
        this._lastModifiedAt = null;
      }
      return true;
    } catch {
      return false;
    }
  }

  async saveAs(content: string, targetPath?: string): Promise<boolean> {
    try {
      const path = targetPath ?? await this.pickSavePath();
      if (!path) return false;
      this.setCurrentPath(path);
      await writeTextFile(path, content);
      this._lastSavedContent = content;
      this.store.set('hasUnsavedChanges', false);
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
    this.setCurrentPath(null);
    this._lastSavedContent = '';
    this._lastModifiedAt = null;
    this.store.set('hasUnsavedChanges', false);
  }

  scheduleAutoSave(content: string): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(async () => {
      if (this.store.get('currentFilePath') && this.store.get('hasUnsavedChanges')) {
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
    const filePath = this.store.get('currentFilePath');
    if (!filePath || this._lastModifiedAt === null) return false;
    try {
      const info = await stat(filePath);
      const currentMtime = info.mtime?.getTime() ?? null;
      return currentMtime !== null && currentMtime !== this._lastModifiedAt;
    } catch {
      return false;
    }
  }

  async reloadFile(): Promise<string | null> {
    const filePath = this.store.get('currentFilePath');
    if (!filePath) return null;
    try {
      const content = await readTextFile(filePath);
      const info = await stat(filePath);
      this._lastModifiedAt = info.mtime?.getTime() ?? null;
      this._lastSavedContent = content;
      this.store.set('hasUnsavedChanges', false);
      return content;
    } catch {
      return null;
    }
  }

  async dismissExternalChange(): Promise<void> {
    const filePath = this.store.get('currentFilePath');
    if (!filePath) return;
    try {
      const info = await stat(filePath);
      this._lastModifiedAt = info.mtime?.getTime() ?? null;
    } catch {
      // ignore
    }
  }

  private getBaseName(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || path;
  }

  private setCurrentPath(path: string | null): void {
    this.store.set('currentFilePath', path);
  }
}
