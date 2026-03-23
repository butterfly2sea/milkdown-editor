import type { TocEntry } from '../editor/setup';
import { i18n } from '../i18n';

export class TableOfContents {
  private el: HTMLElement;
  private entries: TocEntry[] = [];
  public onHeadingClick?: (pos: number) => void;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      overflow-y: auto;
      height: 100%;
      padding: 8px 0;
    `;
    container.appendChild(this.el);
  }

  get element(): HTMLElement {
    return this.el;
  }

  update(entries: TocEntry[]): void {
    this.entries = entries;
    this.render();
  }

  private render(): void {
    this.el.innerHTML = '';

    if (this.entries.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        padding: 16px 12px;
        font-size: 12px;
        color: var(--text-muted, #999);
        text-align: center;
      `;
      empty.textContent = i18n.t.tabOutline;
      this.el.appendChild(empty);
      return;
    }

    for (const entry of this.entries) {
      const item = document.createElement('div');
      const indent = 12 + (entry.level - 1) * 16;
      item.style.cssText = `
        padding: 3px 12px 3px ${indent}px;
        font-size: ${entry.level <= 2 ? 13 : 12}px;
        font-weight: ${entry.level <= 2 ? '500' : 'normal'};
        cursor: pointer;
        color: var(--text-primary, #333);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      item.textContent = entry.text || `(H${entry.level})`;
      item.title = entry.text;

      item.addEventListener('click', () => {
        this.onHeadingClick?.(entry.pos);
      });
      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--sidebar-hover, #e8e8e8)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });

      this.el.appendChild(item);
    }
  }
}
