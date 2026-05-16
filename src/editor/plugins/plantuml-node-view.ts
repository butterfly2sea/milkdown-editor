import type { NodeViewConstructor } from '@milkdown/kit/prose/view';
import { i18n } from '../../i18n';
import { EventManager } from '../../utils/event-manager';
import { getPlantUMLServer } from './plantuml-plugin';
import { showPlantUMLCopyMenu } from './plantuml/clipboard';
import { DisposableDebounce, scheduleDisposableTimeout } from './plantuml/debounce';
import { showFullscreenSvg } from './plantuml/fullscreen';
import { renderPlantUMLSvg, type PlantUMLRenderResult } from './plantuml/renderer';

export function createPlantUMLNodeView(): NodeViewConstructor {
  return (node, view, getPos) => {
    const events = new EventManager();
    const renderDebounce = new DisposableDebounce(500);
    let currentValue: string = node.attrs.value || '';
    let disposed = false;
    let renderToken = 0;
    let copyMenuCleanup: (() => void) | null = null;
    let fullscreenCleanup: (() => void) | null = null;
    let focusCleanup: (() => void) | null = null;

    const dom = document.createElement('div');
    dom.className = 'plantuml-wrapper';
    dom.style.cssText = `
      border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 6px;
      margin: 8px 0;
      overflow: hidden;
      transition: border-color 0.15s;
    `;

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
    previewEl.title = i18n.t.plantumlPreviewTitle;

    const editorEl = document.createElement('div');
    editorEl.className = 'plantuml-editor';
    editorEl.style.cssText = `
      display: none;
      border-top: 1px solid var(--border-color, #e8e8e8);
    `;

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

    const collapseBtn = document.createElement('button');
    collapseBtn.textContent = i18n.t.plantumlDone;
    collapseBtn.style.cssText = `
      font-size: 11px;
      padding: 1px 8px;
      border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 3px;
      background: var(--bg-elevated, #fff);
      color: var(--text-secondary, #666);
      cursor: pointer;
    `;
    labelEl.appendChild(collapseBtn);

    const textarea = document.createElement('textarea');
    textarea.className = 'plantuml-source';
    textarea.value = currentValue;
    textarea.placeholder = i18n.t.plantumlSourcePlaceholder;
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

    editorEl.appendChild(labelEl);
    editorEl.appendChild(textarea);
    dom.appendChild(previewEl);
    dom.appendChild(editorEl);

    const closeCopyMenu = () => {
      copyMenuCleanup?.();
      copyMenuCleanup = null;
    };

    const closeFullscreen = () => {
      fullscreenCleanup?.();
      fullscreenCleanup = null;
    };

    const setPreviewMessage = (text: string): void => {
      const span = document.createElement('span');
      span.textContent = text;
      span.style.cssText = 'color: var(--text-muted, #999); font-size: 13px;';
      previewEl.replaceChildren(span);
    };

    const setPreviewError = (message: string): void => {
      const container = document.createElement('div');
      container.style.cssText = `
        color: #e53e3e;
        font-size: 12px;
        white-space: pre-wrap;
        max-height: 200px;
        overflow-y: auto;
        text-align: left;
        padding: 8px;
      `;
      const details = document.createElement('div');
      details.textContent = message.length > 1000 ? `${message.substring(0, 1000)}...` : message;
      const hint = document.createElement('span');
      hint.textContent = i18n.t.plantumlCheckNetwork;
      hint.style.cssText = 'color: var(--text-muted, #999);';
      container.appendChild(details);
      container.appendChild(document.createElement('br'));
      container.appendChild(hint);
      previewEl.replaceChildren(container);
    };

    const setPreviewSvg = (svg: string): void => {
      previewEl.innerHTML = svg;
      const svgEl = previewEl.querySelector('svg');
      if (!svgEl) return;
      svgEl.style.maxWidth = '100%';
      svgEl.style.height = 'auto';
    };

    const applyRenderResult = (result: PlantUMLRenderResult): void => {
      if (result.type === 'empty') {
        setPreviewMessage(i18n.t.plantumlPlaceholder);
        return;
      }
      if (result.type === 'error') {
        setPreviewError(result.message);
        return;
      }
      setPreviewSvg(result.svg);
    };

    const renderPreview = async (): Promise<void> => {
      const token = ++renderToken;
      const value = currentValue;
      const server = getPlantUMLServer();
      if (!value.trim()) {
        applyRenderResult({ type: 'empty' });
        return;
      }

      setPreviewMessage(i18n.t.plantumlRendering);
      const result = await renderPlantUMLSvg(value, server);
      if (disposed || token !== renderToken || value !== currentValue) return;
      applyRenderResult(result);
    };

    const debouncedRender = (): void => {
      renderDebounce.schedule(() => {
        void renderPreview();
      });
    };

    const updateProseMirrorNode = (): void => {
      const pos = getPos();
      if (pos == null) return;
      const tr = view.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        value: currentValue,
      });
      view.dispatch(tr);
    };

    const setEditing = (editing: boolean): void => {
      focusCleanup?.();
      focusCleanup = null;

      if (editing) {
        editorEl.style.display = 'block';
        previewEl.style.cursor = 'default';
        dom.style.borderColor = 'var(--accent, #0366d6)';
        focusCleanup = scheduleDisposableTimeout(() => textarea.focus(), 0);
        return;
      }

      editorEl.style.display = 'none';
      previewEl.style.cursor = 'pointer';
      dom.style.borderColor = 'var(--border-color, #e8e8e8)';
    };

    events.on(previewEl, 'contextmenu', (e) => {
      const svgEl = previewEl.querySelector('svg');
      if (!svgEl) return;
      e.preventDefault();
      e.stopPropagation();
      closeCopyMenu();
      copyMenuCleanup = showPlantUMLCopyMenu(e.clientX, e.clientY, svgEl as SVGElement);
    });

    events.on(collapseBtn, 'click', (e) => {
      e.stopPropagation();
      setEditing(false);
    });

    events.on(textarea, 'input', () => {
      currentValue = textarea.value;
      updateProseMirrorNode();
      debouncedRender();
    });

    events.on(textarea, 'keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditing(false);
      }
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      currentValue = textarea.value;
      updateProseMirrorNode();
      debouncedRender();
    });

    events.on(previewEl, 'click', () => {
      setEditing(true);
    });

    events.on(previewEl, 'dblclick', (e) => {
      e.stopPropagation();
      const svgEl = previewEl.querySelector('svg');
      if (!svgEl) return;
      closeFullscreen();
      fullscreenCleanup = showFullscreenSvg(svgEl as SVGElement);
    });

    if (currentValue) {
      void renderPreview();
      setEditing(false);
    } else {
      setPreviewMessage(i18n.t.plantumlPlaceholder);
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
        disposed = true;
        renderToken += 1;
        renderDebounce.dispose();
        focusCleanup?.();
        closeCopyMenu();
        closeFullscreen();
        events.cleanup();
      },
    };
  };
}
