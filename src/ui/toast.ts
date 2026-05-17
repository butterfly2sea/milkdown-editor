export type ToastLevel = 'info' | 'success' | 'warn' | 'error';

let container: HTMLDivElement | null = null;

export function toast(
  message: string,
  level: ToastLevel = 'info',
  duration = 3000,
): void {
  const host = getToastContainer();
  const item = document.createElement('div');
  item.setAttribute('role', 'status');
  item.style.cssText = `
    max-width: min(420px, calc(100vw - 32px));
    padding: 9px 12px;
    border-radius: 6px;
    box-shadow: var(--shadow-md, 0 2px 8px rgba(0,0,0,0.16));
    color: #fff;
    font-size: 13px;
    line-height: 1.4;
    word-break: break-word;
    background: ${getBackground(level)};
  `;
  item.textContent = message;
  host.appendChild(item);

  window.setTimeout(() => {
    item.remove();
    if (container && container.childElementCount === 0) {
      container.remove();
      container = null;
    }
  }, duration);
}

function getToastContainer(): HTMLDivElement {
  if (container?.isConnected) return container;

  container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    z-index: 3000;
    pointer-events: none;
  `;
  document.body.appendChild(container);
  return container;
}

function getBackground(level: ToastLevel): string {
  switch (level) {
    case 'success':
      return '#2f855a';
    case 'warn':
      return '#b7791f';
    case 'error':
      return '#c53030';
    default:
      return '#2d3748';
  }
}
