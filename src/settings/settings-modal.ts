import { getPlantUMLServer, setPlantUMLServer } from '../editor/plugins/plantuml-plugin';
import { i18n } from '../i18n';

const STORAGE_KEY = 'plantuml-server-url';
const DEFAULT_SERVER = 'https://www.plantuml.com/plantuml';

export function initPlantUMLServerFromStorage(): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) setPlantUMLServer(saved);
}

export function showSettingsModal(): void {
  // Remove existing modal
  document.querySelector('.settings-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';
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
  modal.className = 'settings-modal';
  modal.style.cssText = `
    background: var(--bg-primary, #fff);
    border: 1px solid var(--border-color, #e8e8e8);
    border-radius: 8px;
    box-shadow: var(--shadow-lg, 0 4px 16px rgba(0,0,0,0.15));
    padding: 24px;
    min-width: 420px;
    max-width: 520px;
  `;

  // Title
  const title = document.createElement('h3');
  title.textContent = i18n.t.settings;
  title.style.cssText = `
    margin: 0 0 20px 0;
    font-size: 16px;
    color: var(--text-primary, #333);
  `;
  modal.appendChild(title);

  // PlantUML server field
  const label = document.createElement('label');
  label.textContent = i18n.t.plantumlServerUrl;
  label.style.cssText = `
    display: block;
    font-size: 13px;
    color: var(--text-secondary, #666);
    margin-bottom: 6px;
  `;
  modal.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  input.value = getPlantUMLServer();
  input.placeholder = i18n.t.plantumlServerUrlPlaceholder;
  input.style.cssText = `
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    border: 1px solid var(--border-color, #e8e8e8);
    border-radius: 4px;
    background: var(--bg-secondary, #f8f9fa);
    color: var(--text-primary, #333);
    outline: none;
    box-sizing: border-box;
  `;
  input.addEventListener('focus', () => {
    input.style.borderColor = 'var(--accent, #0366d6)';
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = 'var(--border-color, #e8e8e8)';
  });
  modal.appendChild(input);

  // Reset link
  const resetLink = document.createElement('a');
  resetLink.textContent = i18n.t.resetDefault;
  resetLink.href = '#';
  resetLink.style.cssText = `
    display: inline-block;
    font-size: 12px;
    color: var(--accent, #0366d6);
    margin-top: 4px;
    text-decoration: none;
  `;
  resetLink.addEventListener('click', (e) => {
    e.preventDefault();
    input.value = DEFAULT_SERVER;
  });
  modal.appendChild(resetLink);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = i18n.t.cancel;
  cancelBtn.style.cssText = `
    padding: 6px 16px;
    font-size: 13px;
    border: 1px solid var(--border-color, #e8e8e8);
    border-radius: 4px;
    background: transparent;
    color: var(--text-primary, #333);
    cursor: pointer;
  `;
  cancelBtn.addEventListener('click', () => overlay.remove());

  const saveBtn = document.createElement('button');
  saveBtn.textContent = i18n.t.save;
  saveBtn.style.cssText = `
    padding: 6px 16px;
    font-size: 13px;
    border: none;
    border-radius: 4px;
    background: var(--accent, #0366d6);
    color: #fff;
    cursor: pointer;
  `;
  saveBtn.addEventListener('click', () => {
    const url = input.value.trim().replace(/\/+$/, '');
    if (url) {
      setPlantUMLServer(url);
      localStorage.setItem(STORAGE_KEY, url);
    } else {
      setPlantUMLServer(DEFAULT_SERVER);
      localStorage.removeItem(STORAGE_KEY);
    }
    overlay.remove();
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
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
  input.focus();
}
