import { AUTO_SAVE_DELAYS, getAutoSaveConfig, saveAutoSaveConfig } from './auto-save-config';
import { getPageMargin, PAGE_MARGINS, savePageMargin, toPageMargin, type PageMargin } from './page-margin';
import { i18n } from '../i18n';

/** The two style strings the settings modal uses for its fields, passed in so
 *  this section looks like the ones around it. */
export interface FieldStyles {
  input: string;
  label: string;
}

/** Fields that only take effect once the modal is saved. */
export interface EditorSection {
  save: () => void;
}

const MARGIN_LABELS: Record<PageMargin, () => string> = {
  normal: () => i18n.t.pageMarginNormal,
  narrow: () => i18n.t.pageMarginNarrow,
  none: () => i18n.t.pageMarginNone,
};

/** Build the "Editor" block of the settings modal into `modal`. */
export function buildEditorSection(modal: HTMLElement, styles: FieldStyles): EditorSection {
  const autoSaveConfig = getAutoSaveConfig();

  const autoSaveRow = document.createElement('div');
  autoSaveRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
  const autoSaveCheckbox = document.createElement('input');
  autoSaveCheckbox.type = 'checkbox';
  autoSaveCheckbox.checked = autoSaveConfig.enabled;
  const autoSaveLabel = document.createElement('span');
  autoSaveLabel.textContent = i18n.t.autoSaveEnabled;
  autoSaveLabel.style.cssText = 'font-size: 13px; color: var(--text-primary, #333);';
  autoSaveRow.appendChild(autoSaveCheckbox);
  autoSaveRow.appendChild(autoSaveLabel);
  modal.appendChild(autoSaveRow);

  const autoSaveDelayLabel = document.createElement('label');
  autoSaveDelayLabel.textContent = i18n.t.autoSaveDelay;
  autoSaveDelayLabel.style.cssText = styles.label;
  modal.appendChild(autoSaveDelayLabel);

  const autoSaveDelaySelect = document.createElement('select');
  autoSaveDelaySelect.style.cssText = styles.input;
  for (const secs of AUTO_SAVE_DELAYS) {
    const opt = document.createElement('option');
    opt.value = String(secs);
    opt.textContent = `${secs} ${i18n.t.seconds}`;
    if (autoSaveConfig.delaySeconds === secs) opt.selected = true;
    autoSaveDelaySelect.appendChild(opt);
  }
  modal.appendChild(autoSaveDelaySelect);

  // The delay is meaningless while auto-save is off; grey it out rather than
  // let it look like it still applies.
  const updateAutoSaveDelayState = () => {
    const off = !autoSaveCheckbox.checked;
    autoSaveDelaySelect.disabled = off;
    autoSaveDelaySelect.style.opacity = off ? '0.5' : '1';
    autoSaveDelayLabel.style.opacity = off ? '0.5' : '1';
  };
  autoSaveCheckbox.addEventListener('change', updateAutoSaveDelayState);
  updateAutoSaveDelayState();

  const marginLabel = document.createElement('label');
  marginLabel.textContent = i18n.t.pageMargin;
  marginLabel.style.cssText = styles.label;
  modal.appendChild(marginLabel);

  const marginSelect = document.createElement('select');
  marginSelect.style.cssText = styles.input;
  const savedMargin = getPageMargin();
  for (const margin of PAGE_MARGINS) {
    const opt = document.createElement('option');
    opt.value = margin;
    opt.textContent = MARGIN_LABELS[margin]();
    if (margin === savedMargin) opt.selected = true;
    marginSelect.appendChild(opt);
  }
  modal.appendChild(marginSelect);

  return {
    save: () => {
      saveAutoSaveConfig({
        enabled: autoSaveCheckbox.checked,
        delaySeconds: parseInt(autoSaveDelaySelect.value) || AUTO_SAVE_DELAYS[0],
      });
      savePageMargin(toPageMargin(marginSelect.value));
    },
  };
}
