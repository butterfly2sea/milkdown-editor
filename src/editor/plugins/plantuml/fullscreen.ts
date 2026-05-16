import { EventManager } from '../../../utils/event-manager';

export function showFullscreenSvg(svgEl: SVGElement): () => void {
  const events = new EventManager();
  let closed = false;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.85);
    display: flex; justify-content: center; align-items: center;
    z-index: 2000; cursor: grab;
  `;

  const container = document.createElement('div');
  container.style.cssText = 'transform-origin: center; transition: none;';
  const clone = svgEl.cloneNode(true) as SVGElement;
  clone.style.maxWidth = '90vw';
  clone.style.maxHeight = '90vh';
  clone.style.width = 'auto';
  clone.style.height = 'auto';
  container.appendChild(clone);
  overlay.appendChild(container);

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;

  const updateTransform = () => {
    container.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  };

  const close = () => {
    if (closed) return;
    closed = true;
    events.cleanup();
    overlay.remove();
  };

  events.on(overlay, 'wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.max(0.1, Math.min(10, scale * delta));
    updateTransform();
  }, { passive: false });

  events.on(overlay, 'mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    overlay.style.cursor = 'grabbing';
  });

  events.on(overlay, 'mousemove', (e) => {
    if (!dragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
  });

  events.on(overlay, 'mouseup', () => {
    dragging = false;
    overlay.style.cursor = 'grab';
  });

  events.on(overlay, 'dblclick', close);
  events.on(document, 'keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  document.body.appendChild(overlay);
  return close;
}
