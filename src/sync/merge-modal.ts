import { computeDiff, buildMergedContent, type DiffBlock } from './diff-merge';
import { i18n } from '../i18n';

/**
 * Show a JetBrains-style side-by-side diff merge modal.
 * Returns the merged content string, or null if cancelled.
 */
export function showMergeModal(
  fileName: string,
  localContent: string,
  remoteContent: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    document.querySelector('.merge-overlay')?.remove();

    const blocks = computeDiff(localContent, remoteContent);

    const overlay = document.createElement('div');
    overlay.className = 'merge-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display: flex; justify-content: center; align-items: center;
      z-index: 2000;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: var(--bg-primary, #fff); border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      width: 90vw; max-width: 1000px; height: 80vh; max-height: 700px;
      display: flex; flex-direction: column; overflow: hidden;
    `;

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      padding: 12px 16px; border-bottom: 1px solid var(--border-color, #e8e8e8);
      display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
    `;
    const titleText = document.createElement('span');
    titleText.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary, #333);';
    titleText.textContent = `\u26A0 ${i18n.t.mergeConflict}: ${fileName}`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'border: none; background: transparent; font-size: 16px; cursor: pointer; color: var(--text-muted, #999);';
    closeBtn.addEventListener('click', () => { overlay.remove(); resolve(null); });
    titleBar.appendChild(titleText);
    titleBar.appendChild(closeBtn);
    modal.appendChild(titleBar);

    // Column headers
    const headerRow = document.createElement('div');
    headerRow.style.cssText = `
      display: flex; border-bottom: 1px solid var(--border-color, #e8e8e8);
      font-size: 12px; font-weight: 600; color: var(--text-secondary, #666); flex-shrink: 0;
    `;
    const leftHeader = document.createElement('div');
    leftHeader.style.cssText = 'flex: 1; padding: 6px 12px;';
    leftHeader.textContent = i18n.t.localVersion;
    const midHeader = document.createElement('div');
    midHeader.style.cssText = 'width: 40px;';
    const rightHeader = document.createElement('div');
    rightHeader.style.cssText = 'flex: 1; padding: 6px 12px;';
    rightHeader.textContent = i18n.t.remoteVersion;
    headerRow.appendChild(leftHeader);
    headerRow.appendChild(midHeader);
    headerRow.appendChild(rightHeader);
    modal.appendChild(headerRow);

    // Diff content area
    const diffArea = document.createElement('div');
    diffArea.style.cssText = `
      flex: 1; overflow-y: auto; font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 12px; line-height: 1.5;
    `;

    for (const block of blocks) {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; border-bottom: 1px solid var(--border-color, #e8e8e8);';

      const leftCol = document.createElement('div');
      leftCol.style.cssText = 'flex: 1; padding: 2px 8px; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;';
      const midCol = document.createElement('div');
      midCol.style.cssText = 'width: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; flex-shrink: 0;';
      const rightCol = document.createElement('div');
      rightCol.style.cssText = 'flex: 1; padding: 2px 8px; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;';

      if (block.type === 'same') {
        leftCol.textContent = block.localLines.join('\n');
        leftCol.style.color = 'var(--text-muted, #999)';
        rightCol.textContent = block.remoteLines.join('\n');
        rightCol.style.color = 'var(--text-muted, #999)';
      } else {
        // Colorize diff blocks
        if (block.localLines.length > 0) {
          leftCol.textContent = block.localLines.join('\n');
          leftCol.style.background = 'rgba(255, 100, 100, 0.1)';
          leftCol.style.color = 'var(--text-primary, #333)';
        }
        if (block.remoteLines.length > 0) {
          rightCol.textContent = block.remoteLines.join('\n');
          rightCol.style.background = 'rgba(100, 200, 100, 0.1)';
          rightCol.style.color = 'var(--text-primary, #333)';
        }

        // Action buttons
        const applyResolved = (side: 'local' | 'remote') => {
          block.resolved = side;
          if (side === 'local') {
            leftCol.style.background = 'rgba(100, 200, 100, 0.2)';
            leftCol.style.fontWeight = '600';
            rightCol.style.background = 'transparent';
            rightCol.style.opacity = '0.4';
            rightCol.style.fontWeight = 'normal';
          } else {
            rightCol.style.background = 'rgba(100, 200, 100, 0.2)';
            rightCol.style.fontWeight = '600';
            leftCol.style.background = 'transparent';
            leftCol.style.opacity = '0.4';
            leftCol.style.fontWeight = 'normal';
          }
        };

        if (block.localLines.length > 0) {
          const useLocalBtn = document.createElement('button');
          useLocalBtn.textContent = '\u2190';
          useLocalBtn.title = i18n.t.webdavKeepLocal;
          useLocalBtn.style.cssText = 'border: 1px solid var(--border-color); background: transparent; cursor: pointer; font-size: 12px; padding: 1px 4px; border-radius: 3px; color: var(--text-secondary);';
          useLocalBtn.addEventListener('click', () => applyResolved('local'));
          midCol.appendChild(useLocalBtn);
        }
        if (block.remoteLines.length > 0) {
          const useRemoteBtn = document.createElement('button');
          useRemoteBtn.textContent = '\u2192';
          useRemoteBtn.title = i18n.t.webdavKeepRemote;
          useRemoteBtn.style.cssText = 'border: 1px solid var(--border-color); background: transparent; cursor: pointer; font-size: 12px; padding: 1px 4px; border-radius: 3px; color: var(--text-secondary);';
          useRemoteBtn.addEventListener('click', () => applyResolved('remote'));
          midCol.appendChild(useRemoteBtn);
        }
      }

      row.appendChild(leftCol);
      row.appendChild(midCol);
      row.appendChild(rightCol);
      diffArea.appendChild(row);
    }
    modal.appendChild(diffArea);

    // Bottom buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `
      padding: 12px 16px; border-top: 1px solid var(--border-color, #e8e8e8);
      display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0;
    `;

    const makeBtn = (text: string, primary: boolean, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.style.cssText = primary
        ? 'padding: 6px 16px; font-size: 13px; border: none; border-radius: 4px; background: var(--accent, #0366d6); color: #fff; cursor: pointer;'
        : 'padding: 6px 16px; font-size: 13px; border: 1px solid var(--border-color, #e8e8e8); border-radius: 4px; background: transparent; color: var(--text-primary, #333); cursor: pointer;';
      btn.addEventListener('click', onClick);
      return btn;
    };

    btnRow.appendChild(makeBtn(i18n.t.useLocalAll, false, () => {
      for (const b of blocks) if (b.type !== 'same') b.resolved = 'local';
      overlay.remove();
      resolve(buildMergedContent(blocks));
    }));
    btnRow.appendChild(makeBtn(i18n.t.useRemoteAll, false, () => {
      for (const b of blocks) if (b.type !== 'same') b.resolved = 'remote';
      overlay.remove();
      resolve(buildMergedContent(blocks));
    }));
    btnRow.appendChild(makeBtn(i18n.t.saveMergeResult, true, () => {
      overlay.remove();
      resolve(buildMergedContent(blocks));
    }));
    modal.appendChild(btnRow);

    overlay.appendChild(modal);

    // Close on Escape
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { overlay.remove(); resolve(null); document.removeEventListener('keydown', onKeyDown); }
    };
    document.addEventListener('keydown', onKeyDown);

    document.body.appendChild(overlay);
  });
}
