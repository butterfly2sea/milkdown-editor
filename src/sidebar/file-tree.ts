import type { FileTreeNode } from '../file/fs';

export class FileTree {
  private el: HTMLElement;
  private currentFile: string | null = null;
  private expandedPaths: Set<string> = new Set();
  public onFileSelect?: (path: string) => void;

  constructor(container: HTMLElement) {
    this.el = container;
    this.el.style.cssText = `
      overflow-y: auto;
      height: 100%;
      padding: 8px 0;
    `;
  }

  render(tree: FileTreeNode): void {
    this.el.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 4px 12px 8px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted, #999);
      letter-spacing: 0.5px;
    `;
    header.textContent = tree.name;
    this.el.appendChild(header);

    if (tree.children) {
      this.renderNodes(tree.children, this.el, 0);
    }
  }

  private renderNodes(nodes: FileTreeNode[], container: HTMLElement, depth: number): void {
    for (const node of nodes) {
      const item = document.createElement('div');
      item.className = 'file-tree-item';
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

      if (node.isDir) {
        // Preserve expansion state across refreshes; default to expanded
        let expanded = this.expandedPaths.has(node.path) || !this.expandedPaths.size;
        if (expanded) this.expandedPaths.add(node.path);
        const arrow = document.createElement('span');
        arrow.textContent = expanded ? '▾' : '▸';
        arrow.style.cssText = 'font-size: 10px; width: 12px; text-align: center;';

        const childContainer = document.createElement('div');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name;

        item.appendChild(arrow);
        item.appendChild(nameSpan);

        item.addEventListener('click', () => {
          expanded = !expanded;
          arrow.textContent = expanded ? '▾' : '▸';
          childContainer.style.display = expanded ? 'block' : 'none';
          if (expanded) {
            this.expandedPaths.add(node.path);
          } else {
            this.expandedPaths.delete(node.path);
          }
        });

        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--sidebar-hover, #e8e8e8)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'transparent';
        });

        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.showContextMenu(e, node);
        });

        container.appendChild(item);
        childContainer.style.display = expanded ? 'block' : 'none';
        container.appendChild(childContainer);

        if (node.children) {
          this.renderNodes(node.children, childContainer, depth + 1);
        }
      } else {
        const icon = document.createElement('span');
        icon.textContent = '📄';
        icon.style.cssText = 'font-size: 11px; width: 12px; text-align: center;';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name;

        item.appendChild(icon);
        item.appendChild(nameSpan);

        item.addEventListener('click', () => {
          this.setActiveFile(node.path);
          this.onFileSelect?.(node.path);
        });

        item.addEventListener('mouseenter', () => {
          if (this.currentFile !== node.path) {
            item.style.background = 'var(--sidebar-hover, #e8e8e8)';
          }
        });
        item.addEventListener('mouseleave', () => {
          if (this.currentFile !== node.path) {
            item.style.background = 'transparent';
          }
        });

        item.dataset.filepath = node.path;
        container.appendChild(item);
      }
    }
  }

  setActiveFile(path: string): void {
    this.currentFile = path;
    const items = this.el.querySelectorAll('.file-tree-item');
    items.forEach((item) => {
      const el = item as HTMLElement;
      if (el.dataset.filepath === path) {
        el.style.background = 'var(--accent, #0366d6)';
        el.style.color = '#fff';
      } else {
        el.style.background = 'transparent';
        el.style.color = 'var(--text-primary, #333)';
      }
    });
  }

  private showContextMenu(e: MouseEvent, node: FileTreeNode): void {
    document.querySelector('.ctx-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      background: var(--bg-elevated, #fff);
      border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 6px;
      box-shadow: var(--shadow-md);
      overflow: hidden;
      z-index: 200;
      min-width: 120px;
    `;

    const items = [
      {
        label: 'New File',
        action: async () => {
          const name = prompt('File name:');
          if (!name) return;
          const fileName = name.endsWith('.md') ? name : name + '.md';
          try {
            const { writeTextFile } = await import('@tauri-apps/plugin-fs');
            await writeTextFile(`${node.path}/${fileName}`, '');
          } catch {
            alert('Failed to create file');
          }
        },
      },
    ];

    for (const item of items) {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      btn.style.cssText = `
        display: block;
        width: 100%;
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: var(--text-primary, #333);
        cursor: pointer;
        font-size: 12px;
        text-align: left;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--sidebar-hover, #e8e8e8)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });
      btn.addEventListener('click', () => {
        menu.remove();
        item.action();
      });
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    const close = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}
