import type { RemoteFileInfo } from '../sync/webdav-client';
import { WebDAVClient } from '../sync/webdav-client';
import { i18n } from '../i18n';

export class RemoteFileTree {
  private el: HTMLElement;
  private client: WebDAVClient | null = null;
  private rootPath: string = '/';
  public onDownload?: (remotePath: string, fileName: string) => void;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = 'overflow-y: auto; height: 100%; padding: 8px 0;';
    container.appendChild(this.el);
  }

  get element(): HTMLElement { return this.el; }

  setClient(client: WebDAVClient, rootPath: string): void {
    this.client = client;
    this.rootPath = rootPath;
  }

  async refresh(): Promise<void> {
    if (!this.client) {
      this.showMessage('Configure WebDAV in Settings');
      return;
    }
    this.el.innerHTML = '';
    // Add header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 4px 12px 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted, #999); letter-spacing: 0.5px;';
    header.textContent = 'WebDAV';
    this.el.appendChild(header);
    // Load root
    await this.loadDirectory(this.rootPath, this.el, 0);
  }

  private async loadDirectory(path: string, container: HTMLElement, depth: number): Promise<void> {
    try {
      const files = await this.client!.listFiles(path);
      // Sort: dirs first, then alphabetically
      files.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const file of files) {
        this.renderItem(file, container, depth);
      }
      if (files.length === 0) {
        this.showMessage('(empty)', container);
      }
    } catch (err) {
      this.showMessage('Failed to load', container);
    }
  }

  private renderItem(file: RemoteFileInfo, container: HTMLElement, depth: number): void {
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 3px 12px 3px ${12 + depth * 16}px;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--text-primary, #333);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    if (file.isDir) {
      let expanded = false;
      let loaded = false;
      const arrow = document.createElement('span');
      arrow.textContent = '▸';
      arrow.style.cssText = 'font-size: 10px; width: 12px; text-align: center;';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = file.name;
      nameSpan.style.flex = '1';
      item.appendChild(arrow);
      item.appendChild(nameSpan);

      const childContainer = document.createElement('div');
      childContainer.style.display = 'none';

      item.addEventListener('click', async () => {
        expanded = !expanded;
        arrow.textContent = expanded ? '▾' : '▸';
        childContainer.style.display = expanded ? 'block' : 'none';
        if (expanded && !loaded) {
          loaded = true;
          const loading = document.createElement('div');
          loading.style.cssText = `padding: 3px 12px 3px ${12 + (depth+1) * 16}px; font-size: 12px; color: var(--text-muted, #999);`;
          loading.textContent = '...';
          childContainer.appendChild(loading);
          await this.loadDirectory(file.path, childContainer, depth + 1);
          loading.remove();
        }
      });

      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--sidebar-hover, #e8e8e8)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });

      container.appendChild(item);
      container.appendChild(childContainer);
    } else {
      const icon = document.createElement('span');
      icon.textContent = '📄';
      icon.style.cssText = 'font-size: 11px; width: 12px; text-align: center;';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = file.name;
      nameSpan.style.flex = '1';

      // Download button
      const dlBtn = document.createElement('button');
      dlBtn.textContent = '↓';
      dlBtn.title = i18n.t.downloadToLocal;
      dlBtn.style.cssText = `
        border: 1px solid var(--border-color, #e8e8e8);
        background: transparent;
        color: var(--text-secondary, #666);
        cursor: pointer;
        font-size: 12px;
        padding: 0 4px;
        border-radius: 3px;
        line-height: 1.2;
        flex-shrink: 0;
      `;
      dlBtn.addEventListener('mouseenter', () => { dlBtn.style.background = 'var(--sidebar-hover, #e8e8e8)'; });
      dlBtn.addEventListener('mouseleave', () => { dlBtn.style.background = 'transparent'; });
      dlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onDownload?.(file.path, file.name);
      });

      item.appendChild(icon);
      item.appendChild(nameSpan);
      item.appendChild(dlBtn);

      item.addEventListener('mouseenter', () => { item.style.background = 'var(--sidebar-hover, #e8e8e8)'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });

      container.appendChild(item);
    }
  }

  private showMessage(text: string, container?: HTMLElement): void {
    const msg = document.createElement('div');
    msg.style.cssText = 'padding: 16px 12px; font-size: 12px; color: var(--text-muted, #999); text-align: center;';
    msg.textContent = text;
    (container || this.el).appendChild(msg);
  }
}
