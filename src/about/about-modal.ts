import { i18n } from '../i18n';

export function showAboutModal(): void {
  // Remove existing modal
  document.querySelector('.about-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'about-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  `;

  const modal = document.createElement('div');
  modal.className = 'about-modal';
  modal.style.cssText = `
    background: var(--bg-primary, #fff);
    border: 1px solid var(--border-color, #e8e8e8);
    border-radius: 8px;
    box-shadow: var(--shadow-lg, 0 4px 16px rgba(0,0,0,0.15));
    padding: 24px;
    min-width: 420px;
    max-width: 520px;
    text-align: center;
  `;

  // Title
  const title = document.createElement('h3');
  title.textContent = i18n.t.aboutTitle;
  title.style.cssText = `
    margin: 0 0 12px 0;
    font-size: 18px;
    color: var(--text-primary, #333);
  `;
  modal.appendChild(title);

  // Version
  const version = document.createElement('p');
  version.textContent = 'v0.3.0';
  version.style.cssText = `
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--text-secondary, #666);
  `;
  modal.appendChild(version);

  // Description
  const desc = document.createElement('p');
  desc.textContent = i18n.t.aboutDescription;
  desc.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 13px;
    color: var(--text-secondary, #666);
    line-height: 1.5;
  `;
  modal.appendChild(desc);

  // Built with
  const builtWith = document.createElement('p');
  builtWith.textContent = `${i18n.t.aboutBuiltWith}: Tauri, Milkdown, ProseMirror, MathLive`;
  builtWith.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 12px;
    color: var(--text-secondary, #666);
  `;
  modal.appendChild(builtWith);

  // GitHub link
  const ghLink = document.createElement('a');
  ghLink.textContent = 'GitHub';
  ghLink.href = 'https://github.com/butterfly2sea/milkdown-editor';
  ghLink.target = '_blank';
  ghLink.rel = 'noopener noreferrer';
  ghLink.style.cssText = `
    display: inline-block;
    font-size: 13px;
    color: var(--accent, #0366d6);
    margin-bottom: 20px;
    text-decoration: none;
  `;
  ghLink.addEventListener('click', async (e) => {
    e.preventDefault();
    if ('__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_url', { url: ghLink.href }).catch(() => window.open(ghLink.href, '_blank'));
    } else {
      window.open(ghLink.href, '_blank');
    }
  });
  modal.appendChild(ghLink);

  // OK button
  const btnRow = document.createElement('div');
  btnRow.style.cssText = `
    display: flex;
    justify-content: center;
    margin-top: 4px;
  `;

  const okBtn = document.createElement('button');
  okBtn.textContent = i18n.t.aboutOk;
  okBtn.style.cssText = `
    padding: 6px 24px;
    font-size: 13px;
    border: none;
    border-radius: 4px;
    background: var(--accent, #0366d6);
    color: #fff;
    cursor: pointer;
  `;
  okBtn.addEventListener('click', () => overlay.remove());

  btnRow.appendChild(okBtn);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Close on Escape
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  document.body.appendChild(overlay);
  okBtn.focus();
}
