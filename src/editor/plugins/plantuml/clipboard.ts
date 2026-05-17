import { i18n } from '../../../i18n';
import { toast } from '../../../ui/toast';
import { EventManager } from '../../../utils/event-manager';

let activeMenuCleanup: (() => void) | null = null;

function svgToPngBlob(svgEl: SVGElement, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to create canvas context'));
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create PNG blob'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG'));
    };
    img.src = url;
  });
}

async function copySvg(svgEl: SVGElement): Promise<void> {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([svgData], { type: 'text/plain' }),
      }),
    ]);
  } catch {
    await navigator.clipboard.writeText(svgData);
  }
}

async function copyPng(svgEl: SVGElement): Promise<void> {
  const pngBlob = await svgToPngBlob(svgEl);
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': pngBlob }),
  ]);
}

function showCopyError(): void {
  toast(i18n.t.plantumlCopyFailed, 'error');
}

export function closePlantUMLCopyMenu(): void {
  activeMenuCleanup?.();
  activeMenuCleanup = null;
}

export function showPlantUMLCopyMenu(
  x: number,
  y: number,
  svgEl: SVGElement,
): () => void {
  closePlantUMLCopyMenu();

  const events = new EventManager();
  let closed = false;
  const menu = document.createElement('div');
  menu.className = 'plantuml-ctx-menu';
  menu.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: var(--bg-elevated, #fff);
    border: 1px solid var(--border-color, #e8e8e8);
    border-radius: 6px;
    box-shadow: var(--shadow-md, 0 2px 8px rgba(0,0,0,0.1));
    overflow: hidden;
    z-index: 300;
    min-width: 150px;
  `;

  const close = () => {
    if (closed) return;
    closed = true;
    events.cleanup();
    menu.remove();
    if (activeMenuCleanup === close) activeMenuCleanup = null;
  };

  const items = [
    { label: i18n.t.plantumlCopySVG, action: () => copySvg(svgEl) },
    { label: i18n.t.plantumlCopyPNG, action: () => copyPng(svgEl) },
  ];

  for (const item of items) {
    const btn = document.createElement('button');
    btn.textContent = item.label;
    btn.style.cssText = `
      display: block;
      width: 100%;
      padding: 8px 14px;
      border: none;
      background: transparent;
      color: var(--text-primary, #333);
      cursor: pointer;
      font-size: 13px;
      text-align: left;
      white-space: nowrap;
    `;
    events.on(btn, 'mouseenter', () => {
      btn.style.background = 'var(--sidebar-hover, #e8e8e8)';
    });
    events.on(btn, 'mouseleave', () => {
      btn.style.background = 'transparent';
    });
    events.on(btn, 'click', () => {
      close();
      item.action().catch(showCopyError);
    });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);

  setTimeout(() => {
    if (closed) return;
    events.on(document, 'click', (ev) => {
      if (!menu.contains(ev.target as Node)) close();
    });
  }, 0);

  activeMenuCleanup = close;
  return close;
}
