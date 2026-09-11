/**
 * A draggable divider on the sidebar's right edge, so long file names have
 * somewhere to go. The width is kept as a CSS variable rather than an inline
 * style: `#sidebar` is only as wide as its `.open` rule says, and that rule has
 * to keep working (at the old responsive default) when nothing is stored.
 */

import { i18n } from '../i18n';

const STORAGE_KEY = 'sidebar-width';

/** Narrower than this and the tab labels wrap; wider and the editor suffers. */
const MIN_WIDTH = 160;
const MAX_WIDTH = 600;

function clampWidth(px: number): number {
  return Math.min(Math.max(Math.round(px), MIN_WIDTH), MAX_WIDTH);
}

/** `null` means "never resized" — the stylesheet's responsive default applies. */
export function getSidebarWidth(): number | null {
  const saved = Number.parseFloat(localStorage.getItem(STORAGE_KEY) ?? '');
  return Number.isFinite(saved) ? clampWidth(saved) : null;
}

function applySidebarWidth(width: number | null): void {
  const style = document.documentElement.style;
  if (width == null) {
    style.removeProperty('--sidebar-width');
  } else {
    style.setProperty('--sidebar-width', `${width}px`);
  }
}

export function installSidebarResize(sidebarEl: HTMLElement): void {
  applySidebarWidth(getSidebarWidth());

  const handle = document.createElement('div');
  handle.className = 'sidebar-resizer';
  handle.title = i18n.t.sidebarResizeHint;
  i18n.onChange(() => {
    handle.title = i18n.t.sidebarResizeHint;
  });
  sidebarEl.appendChild(handle);

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    // The 0.2s width transition that animates the open/close slide would make
    // dragging lag a fifth of a second behind the pointer.
    sidebarEl.classList.add('resizing');

    const move = (ev: PointerEvent) => {
      applySidebarWidth(clampWidth(ev.clientX - sidebarEl.getBoundingClientRect().left));
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      sidebarEl.classList.remove('resizing');
      localStorage.setItem(STORAGE_KEY, String(sidebarEl.getBoundingClientRect().width));
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });

  handle.addEventListener('dblclick', () => {
    localStorage.removeItem(STORAGE_KEY);
    applySidebarWidth(null);
  });
}
