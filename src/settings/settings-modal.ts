import { getPlantUMLServer, setPlantUMLServer } from '../editor/plugins/plantuml-plugin';
import { getSyncConfig, saveSyncConfig, type SyncConfig } from '../sync/sync-config';
import { WebDAVClient } from '../sync/webdav-client';
import { i18n } from '../i18n';

const STORAGE_KEY = 'plantuml-server-url';
const DEFAULT_SERVER = 'https://www.plantuml.com/plantuml';

export function initPlantUMLServerFromStorage(): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) setPlantUMLServer(saved);
}

let _onSyncConfigChange: (() => void) | null = null;
export function setOnSyncConfigChange(fn: () => void): void {
  _onSyncConfigChange = fn;
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

  // -- WebDAV Sync section --
  const divider = document.createElement('hr');
  divider.style.cssText = 'border: none; border-top: 1px solid var(--border-color, #e8e8e8); margin: 20px 0;';
  modal.appendChild(divider);

  const syncTitle = document.createElement('h4');
  syncTitle.textContent = i18n.t.webdavSettings;
  syncTitle.style.cssText = 'margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary, #333);';
  modal.appendChild(syncTitle);

  const syncConfig = getSyncConfig();
  const inputStyle = input.style.cssText + ' margin-bottom: 8px;';

  const createField = (labelText: string, value: string, placeholder: string, type = 'text') => {
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    lbl.style.cssText = 'display: block; font-size: 12px; color: var(--text-secondary, #666); margin-bottom: 4px;';
    const inp = document.createElement('input');
    inp.type = type;
    inp.value = value;
    inp.placeholder = placeholder;
    inp.style.cssText = inputStyle;
    modal.appendChild(lbl);
    modal.appendChild(inp);
    return inp;
  };

  const syncUrlInput = createField(i18n.t.webdavServerUrl, syncConfig?.serverUrl ?? '', 'https://dav.example.com/dav');
  const syncUserInput = createField(i18n.t.webdavUsername, syncConfig?.username ?? '', '');
  const syncPassInput = createField(i18n.t.webdavPassword, syncConfig?.password ?? '', '', 'password');
  const syncPathInput = createField(i18n.t.webdavRemotePath, syncConfig?.remotePath ?? '/milkdown', '/milkdown');

  // Sync interval
  const intervalLabel = document.createElement('label');
  intervalLabel.textContent = i18n.t.webdavSyncInterval;
  intervalLabel.style.cssText = 'display: block; font-size: 12px; color: var(--text-secondary, #666); margin-bottom: 4px;';
  modal.appendChild(intervalLabel);
  const intervalSelect = document.createElement('select');
  intervalSelect.style.cssText = inputStyle;
  for (const mins of [1, 5, 10, 30]) {
    const opt = document.createElement('option');
    opt.value = String(mins);
    opt.textContent = `${mins} ${i18n.t.minutes}`;
    if ((syncConfig?.syncIntervalMinutes ?? 5) === mins) opt.selected = true;
    intervalSelect.appendChild(opt);
  }
  modal.appendChild(intervalSelect);

  // Enable toggle
  const enableRow = document.createElement('div');
  enableRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin: 8px 0;';
  const enableCheckbox = document.createElement('input');
  enableCheckbox.type = 'checkbox';
  enableCheckbox.checked = syncConfig?.enabled ?? false;
  const enableLabel = document.createElement('span');
  enableLabel.textContent = i18n.t.webdavSyncEnabled;
  enableLabel.style.cssText = 'font-size: 13px; color: var(--text-primary, #333);';
  enableRow.appendChild(enableCheckbox);
  enableRow.appendChild(enableLabel);
  modal.appendChild(enableRow);

  // Test connection button
  const testBtn = document.createElement('button');
  testBtn.textContent = i18n.t.webdavTestConnection;
  testBtn.style.cssText = `
    padding: 4px 12px; font-size: 12px; border: 1px solid var(--border-color, #e8e8e8);
    border-radius: 4px; background: transparent; color: var(--text-primary, #333); cursor: pointer; margin-bottom: 8px;
  `;
  const testResult = document.createElement('span');
  testResult.style.cssText = 'font-size: 12px; margin-left: 8px;';
  testBtn.addEventListener('click', async () => {
    const client = new WebDAVClient();
    client.configure(syncUrlInput.value.trim(), syncUserInput.value, syncPassInput.value);
    testResult.textContent = '...';
    testResult.style.color = 'var(--text-muted, #999)';
    const result = await client.testConnection();
    if (result.ok) {
      testResult.textContent = i18n.t.webdavConnectionSuccess;
      testResult.style.color = '#38a169';
    } else {
      testResult.textContent = `${i18n.t.webdavConnectionFailed}: ${result.error || 'Unknown'}`;
      testResult.style.color = '#e53e3e';
    }
  });
  const testRow = document.createElement('div');
  testRow.style.cssText = 'margin-bottom: 8px;';
  testRow.appendChild(testBtn);
  testRow.appendChild(testResult);
  modal.appendChild(testRow);

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
    // Save PlantUML settings
    const url = input.value.trim().replace(/\/+$/, '');
    if (url) {
      setPlantUMLServer(url);
      localStorage.setItem(STORAGE_KEY, url);
    } else {
      setPlantUMLServer(DEFAULT_SERVER);
      localStorage.removeItem(STORAGE_KEY);
    }

    // Save WebDAV settings
    const newSyncConfig: SyncConfig = {
      serverUrl: syncUrlInput.value.trim().replace(/\/+$/, ''),
      username: syncUserInput.value,
      password: syncPassInput.value,
      remotePath: syncPathInput.value.trim() || '/milkdown',
      syncIntervalMinutes: parseInt(intervalSelect.value) || 5,
      enabled: enableCheckbox.checked,
    };
    saveSyncConfig(newSyncConfig);
    _onSyncConfigChange?.();

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
