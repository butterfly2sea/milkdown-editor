import { WebDAVClient } from './webdav-client';
import { i18n } from '../i18n';

export function showRemoteFolderPicker(
  client: WebDAVClient,
  rootPath: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    document.querySelector('.remote-picker-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'remote-picker-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.4);
      display: flex; justify-content: center; align-items: center; z-index: 1000;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: var(--bg-primary, #fff); border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      padding: 20px; min-width: 400px; max-width: 500px; max-height: 500px;
      display: flex; flex-direction: column;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = i18n.t.chooseLocalPath;
    title.style.cssText = 'margin: 0 0 12px 0; font-size: 15px; color: var(--text-primary, #333);';
    modal.appendChild(title);

    // Current path display
    let selectedPath = rootPath.replace(/\/+$/, '') || '/';
    const pathDisplay = document.createElement('div');
    pathDisplay.style.cssText = `
      font-size: 12px; color: var(--text-muted, #999); padding: 4px 8px;
      background: var(--bg-secondary, #f8f9fa); border-radius: 4px; margin-bottom: 8px;
      word-break: break-all;
    `;
    pathDisplay.textContent = selectedPath;
    modal.appendChild(pathDisplay);

    // Tree container
    const treeContainer = document.createElement('div');
    treeContainer.style.cssText = 'flex: 1; overflow-y: auto; min-height: 200px; max-height: 300px; border: 1px solid var(--border-color, #e8e8e8); border-radius: 4px; padding: 4px;';
    modal.appendChild(treeContainer);

    // Load directories
    const loadDir = async (path: string, container: HTMLElement, depth: number) => {
      try {
        // Ensure directory exists before listing
        try { await client.mkdir(path); } catch { /* may already exist */ }
        const allFiles = await client.listFiles(path);
        // Show directories (selectable) and files (display only)
        const sorted = allFiles.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        if (sorted.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = `padding: 4px ${8 + depth * 16}px; font-size: 12px; color: var(--text-muted, #999);`;
          empty.textContent = '(empty)';
          container.appendChild(empty);
          return;
        }
        // Show files (non-selectable, just for context)
        for (const file of sorted.filter(f => !f.isDir)) {
          const fileItem = document.createElement('div');
          fileItem.style.cssText = `
            padding: 2px ${8 + depth * 16}px; font-size: 12px;
            color: var(--text-muted, #999); display: flex; align-items: center; gap: 4px;
          `;
          fileItem.textContent = '📄 ' + file.name;
          container.appendChild(fileItem);
        }
        for (const dir of sorted.filter(f => f.isDir)) {
          const item = document.createElement('div');
          item.style.cssText = `
            padding: 4px ${8 + depth * 16}px; font-size: 13px; cursor: pointer;
            display: flex; align-items: center; gap: 4px; border-radius: 3px;
          `;

          let expanded = false;
          let loaded = false;
          const arrow = document.createElement('span');
          arrow.textContent = '▸';
          arrow.style.cssText = 'font-size: 10px; width: 12px; text-align: center;';
          const name = document.createElement('span');
          name.textContent = dir.name;
          name.style.flex = '1';
          item.appendChild(arrow);
          item.appendChild(name);

          const childContainer = document.createElement('div');
          childContainer.style.display = 'none';

          item.addEventListener('click', async () => {
            // Select this folder
            selectedPath = dir.path;
            pathDisplay.textContent = selectedPath;
            // Highlight
            treeContainer.querySelectorAll('.rp-selected').forEach(el => {
              (el as HTMLElement).style.background = 'transparent';
              el.classList.remove('rp-selected');
            });
            item.style.background = 'var(--accent, #0366d6)';
            item.style.color = '#fff';
            item.classList.add('rp-selected');

            // Toggle expand
            expanded = !expanded;
            arrow.textContent = expanded ? '▾' : '▸';
            childContainer.style.display = expanded ? 'block' : 'none';
            if (expanded && !loaded) {
              loaded = true;
              await loadDir(dir.path, childContainer, depth + 1);
            }
          });

          item.addEventListener('mouseenter', () => {
            if (!item.classList.contains('rp-selected'))
              item.style.background = 'var(--sidebar-hover, #e8e8e8)';
          });
          item.addEventListener('mouseleave', () => {
            if (!item.classList.contains('rp-selected'))
              item.style.background = 'transparent';
          });

          container.appendChild(item);
          container.appendChild(childContainer);
        }
      } catch (e) {
        const errEl = document.createElement('div');
        errEl.style.cssText = 'padding: 8px; font-size: 12px; color: #e53e3e;';
        errEl.textContent = e instanceof Error ? e.message : 'Failed to load';
        container.appendChild(errEl);
      }
    };

    loadDir(rootPath, treeContainer, 0);

    // New folder button
    const newFolderBtn = document.createElement('button');
    newFolderBtn.textContent = '+ ' + i18n.t.newFolder;
    newFolderBtn.style.cssText = `
      margin-top: 8px; padding: 4px 12px; font-size: 12px;
      border: 1px solid var(--border-color, #e8e8e8); border-radius: 4px;
      background: transparent; color: var(--text-primary, #333); cursor: pointer;
    `;
    newFolderBtn.addEventListener('click', async () => {
      const name = prompt('Folder name:');
      if (!name) return;
      const newPath = selectedPath.replace(/\/+$/, '') + '/' + name;
      try {
        await client.mkdir(newPath);
        // Refresh
        treeContainer.innerHTML = '';
        await loadDir(rootPath, treeContainer, 0);
      } catch {
        alert('Failed to create folder');
      }
    });
    modal.appendChild(newFolderBtn);

    // Button row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = i18n.t.cancel;
    cancelBtn.style.cssText = `
      padding: 6px 16px; font-size: 13px; border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 4px; background: transparent; color: var(--text-primary, #333); cursor: pointer;
    `;
    cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(null); });

    const okBtn = document.createElement('button');
    okBtn.textContent = i18n.t.save;
    okBtn.style.cssText = `
      padding: 6px 16px; font-size: 13px; border: none; border-radius: 4px;
      background: var(--accent, #0366d6); color: #fff; cursor: pointer;
    `;
    okBtn.addEventListener('click', () => { overlay.remove(); resolve(selectedPath); });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(null); }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { overlay.remove(); resolve(null); document.removeEventListener('keydown', onKeyDown); }
    };
    document.addEventListener('keydown', onKeyDown);

    document.body.appendChild(overlay);
  });
}
