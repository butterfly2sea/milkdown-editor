import type { NodeViewConstructor } from '@milkdown/kit/prose/view';
import { getPlantUMLServer } from './plantuml-plugin';

async function encodePlantUML(text: string): Promise<string> {
  const { encode } = await import('plantuml-encoder');
  return encode(text);
}

// Convert SVG element to PNG blob
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
      const ctx = canvas.getContext('2d')!;
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

function showFullscreenSvg(svgEl: SVGElement): void {
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

  overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.max(0.1, Math.min(10, scale * delta));
    updateTransform();
  }, { passive: false });

  overlay.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      dragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      overlay.style.cursor = 'grabbing';
    }
  });

  overlay.addEventListener('mousemove', (e) => {
    if (dragging) {
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateTransform();
    }
  });

  overlay.addEventListener('mouseup', () => {
    dragging = false;
    overlay.style.cursor = 'grab';
  });

  // Close on Escape or click outside SVG
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };
  overlay.addEventListener('dblclick', close);
  document.addEventListener('keydown', onKeyDown);

  document.body.appendChild(overlay);
}

export function createPlantUMLNodeView(): NodeViewConstructor {
  return (node, view, getPos) => {
    let currentValue: string = node.attrs.value || '';
    let isEditing = !currentValue;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSvgText: string = '';

    // Container
    const dom = document.createElement('div');
    dom.className = 'plantuml-wrapper';
    dom.style.cssText = `
      border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 6px;
      margin: 8px 0;
      overflow: hidden;
      transition: border-color 0.15s;
    `;

    // Preview area
    const previewEl = document.createElement('div');
    previewEl.className = 'plantuml-preview';
    previewEl.style.cssText = `
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
      min-height: 80px;
      cursor: pointer;
      background: var(--bg-primary, #fff);
      position: relative;
    `;
    previewEl.title = 'Click to edit, right-click to copy';

    // Right-click context menu on preview
    previewEl.addEventListener('contextmenu', (e) => {
      const svgEl = previewEl.querySelector('svg');
      if (!svgEl) return; // No SVG rendered, use default menu

      e.preventDefault();
      e.stopPropagation();
      showCopyMenu(e.clientX, e.clientY, svgEl as SVGElement);
    });

    // Editor area
    const editorEl = document.createElement('div');
    editorEl.className = 'plantuml-editor';
    editorEl.style.cssText = `
      display: none;
      border-top: 1px solid var(--border-color, #e8e8e8);
    `;

    // Label
    const labelEl = document.createElement('div');
    labelEl.className = 'plantuml-label';
    labelEl.textContent = 'PlantUML';
    labelEl.style.cssText = `
      font-size: 11px;
      color: var(--text-muted, #999);
      padding: 4px 8px;
      background: var(--bg-secondary, #f8f9fa);
      border-bottom: 1px solid var(--border-color, #e8e8e8);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    // Collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.textContent = 'Done';
    collapseBtn.style.cssText = `
      font-size: 11px;
      padding: 1px 8px;
      border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 3px;
      background: var(--bg-elevated, #fff);
      color: var(--text-secondary, #666);
      cursor: pointer;
    `;
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setEditing(false);
    });
    labelEl.appendChild(collapseBtn);

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'plantuml-source';
    textarea.value = currentValue;
    textarea.placeholder = '@startuml\nAlice -> Bob: Hello\n@enduml';
    textarea.spellcheck = false;
    textarea.style.cssText = `
      width: 100%;
      min-height: 120px;
      padding: 8px;
      font-family: monospace;
      font-size: 13px;
      border: none;
      outline: none;
      resize: vertical;
      background: var(--code-bg, #f6f8fa);
      color: var(--text-primary, #333);
    `;

    textarea.addEventListener('input', () => {
      currentValue = textarea.value;
      updateProseMirrorNode();
      debouncedRender();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditing(false);
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        currentValue = textarea.value;
        updateProseMirrorNode();
        debouncedRender();
      }
    });

    editorEl.appendChild(labelEl);
    editorEl.appendChild(textarea);

    // Click preview to edit
    previewEl.addEventListener('click', () => {
      setEditing(true);
    });

    // Double-click preview to fullscreen view
    previewEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const svgEl = previewEl.querySelector('svg');
      if (!svgEl) return;
      showFullscreenSvg(svgEl as SVGElement);
    });

    dom.appendChild(previewEl);
    dom.appendChild(editorEl);

    function setEditing(editing: boolean) {
      isEditing = editing;
      if (editing) {
        editorEl.style.display = 'block';
        previewEl.style.cursor = 'default';
        dom.style.borderColor = 'var(--accent, #0366d6)';
        setTimeout(() => textarea.focus(), 0);
      } else {
        editorEl.style.display = 'none';
        previewEl.style.cursor = 'pointer';
        dom.style.borderColor = 'var(--border-color, #e8e8e8)';
      }
    }

    function updateProseMirrorNode() {
      const pos = getPos();
      if (pos == null) return;
      const tr = view.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        value: currentValue,
      });
      view.dispatch(tr);
    }

    function debouncedRender() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => renderPreview(), 500);
    }

    async function renderPreview() {
      if (!currentValue.trim()) {
        previewEl.innerHTML = '<span style="color: var(--text-muted, #999); font-size: 13px;">Enter PlantUML code to preview</span>';
        lastSvgText = '';
        return;
      }

      previewEl.innerHTML = '<span style="color: var(--text-muted, #999); font-size: 13px;">Rendering...</span>';

      try {
        const encoded = await encodePlantUML(currentValue);
        const server = getPlantUMLServer();
        const url = `${server}/svg/${encoded}`;

        const response = await fetch(url);
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(errorBody || `HTTP ${response.status}`);
        }

        const svg = await response.text();
        if (svg.includes('<svg')) {
          // Extract SVG part (skip XML declaration if present)
          const svgStart = svg.indexOf('<svg');
          lastSvgText = svg.substring(svgStart);
          previewEl.innerHTML = lastSvgText;

          const svgEl = previewEl.querySelector('svg');
          if (svgEl) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
          }
        } else {
          throw new Error('Invalid SVG response');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        lastSvgText = '';
        const sanitized = msg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const truncated = sanitized.length > 1000 ? sanitized.substring(0, 1000) + '...' : sanitized;
        previewEl.innerHTML = `<div style="color: #e53e3e; font-size: 12px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; text-align: left; padding: 8px;">${truncated}<br><span style="color: var(--text-muted, #999);">Check syntax or configure PlantUML server</span></div>`;
      }
    }

    function showCopyMenu(x: number, y: number, svgEl: SVGElement) {
      // Remove existing menu
      document.querySelector('.plantuml-ctx-menu')?.remove();

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

      const items = [
        {
          label: 'Copy as SVG',
          action: async () => {
            try {
              const svgData = new XMLSerializer().serializeToString(svgEl);
              await navigator.clipboard.write([
                new ClipboardItem({
                  'text/plain': new Blob([svgData], { type: 'text/plain' }),
                }),
              ]);
            } catch {
              // Fallback: copy as text
              const svgData = new XMLSerializer().serializeToString(svgEl);
              await navigator.clipboard.writeText(svgData);
            }
          },
        },
        {
          label: 'Copy as PNG',
          action: async () => {
            try {
              const pngBlob = await svgToPngBlob(svgEl);
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': pngBlob }),
              ]);
            } catch (err) {
              console.error('Failed to copy as PNG:', err);
            }
          },
        },
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
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'var(--sidebar-hover, #e8e8e8)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'transparent';
        });
        btn.addEventListener('click', () => {
          menu.remove();
          item.action();
        });
        menu.appendChild(btn);
      }

      document.body.appendChild(menu);

      const closeMenu = (ev: MouseEvent) => {
        if (!menu.contains(ev.target as Node)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // Initial state
    if (currentValue) {
      renderPreview();
      setEditing(false);
    } else {
      previewEl.innerHTML = '<span style="color: var(--text-muted, #999); font-size: 13px;">Enter PlantUML code to preview</span>';
      setEditing(true);
    }

    return {
      dom,
      stopEvent: () => true,
      ignoreMutation: () => true,
      update: (updatedNode) => {
        if (updatedNode.type.name !== node.type.name) return false;
        const newValue = updatedNode.attrs.value;
        if (newValue !== currentValue) {
          currentValue = newValue;
          textarea.value = currentValue;
          debouncedRender();
        }
        node = updatedNode;
        return true;
      },
      destroy: () => {
        if (debounceTimer) clearTimeout(debounceTimer);
      },
    };
  };
}
