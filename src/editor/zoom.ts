// Editor content zoom.
//
// Crepe hardcodes px font sizes for every element, so changing `.milkdown`'s
// font-size scales almost nothing. We use the CSS `zoom` property on the
// `.milkdown` container: unlike `transform: scale()` it changes the element's
// actual rendered layout, so ProseMirror's coordinate math (caret placement,
// click-to-position) stays correct — no cursor/content misalignment — and no
// width compensation is needed. Only the editor content is affected; the
// toolbar and status bar stay at native size. `zoom` is supported by every
// Tauri webview (Chromium / WebKit) and by Chrome.

const STORAGE_KEY = 'editor-zoom';
const MIN = 0.5;
const MAX = 2.5;
const STEP = 0.1;

const clamp = (v: number): number => Math.min(MAX, Math.max(MIN, Math.round(v * 100) / 100));

export class ZoomController {
  private level = 1;

  constructor(
    private readonly host: HTMLElement, // #editor-root
    private readonly onChange?: (percent: number) => void,
  ) {
    const saved = parseFloat(localStorage.getItem(STORAGE_KEY) ?? '');
    if (!Number.isNaN(saved)) this.level = clamp(saved);
    this.apply();
  }

  private target(): HTMLElement | null {
    return this.host.querySelector('.milkdown');
  }

  /** Re-apply the current level to the (possibly re-rendered) editor element. */
  apply(): void {
    const el = this.target();
    if (el) {
      if (this.level === 1) {
        el.style.removeProperty('zoom');
      } else {
        el.style.setProperty('zoom', String(this.level));
      }
    }
    localStorage.setItem(STORAGE_KEY, String(this.level));
    this.onChange?.(this.percent);
  }

  zoomIn(): void {
    this.level = clamp(this.level + STEP);
    this.apply();
  }

  zoomOut(): void {
    this.level = clamp(this.level - STEP);
    this.apply();
  }

  reset(): void {
    this.level = 1;
    this.apply();
  }

  get percent(): number {
    return Math.round(this.level * 100);
  }
}
