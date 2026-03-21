import type { NodeViewConstructor } from '@milkdown/kit/prose/view';

type MathMode = 'visual' | 'source';

export function createMathNodeView(display: 'inline' | 'block'): NodeViewConstructor {
  return (node, view, getPos) => {
    let mode: MathMode = 'visual';
    let currentValue: string = node.attrs.value || '';

    // Container
    const dom = document.createElement(display === 'inline' ? 'span' : 'div');
    dom.className = `math-wrapper math-${display}`;
    dom.setAttribute('data-math-mode', mode);

    if (display === 'block') {
      dom.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px 0;
        margin: 8px 0;
        position: relative;
        min-height: 48px;
      `;
    } else {
      dom.style.cssText = `
        display: inline-flex;
        align-items: center;
        position: relative;
        vertical-align: middle;
      `;
    }

    // Visual container (MathLive)
    const mathContainer = document.createElement(display === 'inline' ? 'span' : 'div');
    mathContainer.style.cssText = display === 'block'
      ? 'width: 100%; display: flex; justify-content: center;'
      : 'display: inline;';

    // Source container (textarea)
    const sourceContainer = document.createElement(display === 'inline' ? 'span' : 'div');
    sourceContainer.style.cssText = 'display: none;';

    const textarea = document.createElement('textarea');
    textarea.className = 'math-source-input';
    textarea.value = currentValue;
    textarea.placeholder = 'Enter LaTeX...';
    textarea.style.cssText = `
      font-family: monospace;
      font-size: 14px;
      padding: 8px;
      border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 4px;
      background: var(--code-bg, #f6f8fa);
      color: var(--text-primary, #333);
      resize: vertical;
      outline: none;
      ${display === 'block' ? 'width: 100%; min-height: 60px; box-sizing: border-box;' : 'width: 200px; min-height: 24px;'}
    `;

    textarea.addEventListener('input', () => {
      currentValue = textarea.value;
      updateProseMirrorNode();
    });

    textarea.addEventListener('keydown', (e) => {
      // Escape to switch back to visual
      if (e.key === 'Escape') {
        e.preventDefault();
        switchMode('visual');
      }
    });

    sourceContainer.appendChild(textarea);

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '</>';
    toggleBtn.title = 'Toggle LaTeX source';
    toggleBtn.className = 'math-toggle-btn';
    toggleBtn.style.cssText = `
      position: absolute;
      top: ${display === 'block' ? '2px' : '-2px'};
      right: ${display === 'block' ? '8px' : '-4px'};
      font-size: 10px;
      padding: 1px 4px;
      border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 3px;
      background: var(--bg-elevated, #fff);
      color: var(--text-muted, #999);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 10;
      line-height: 1.2;
    `;
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchMode(mode === 'visual' ? 'source' : 'visual');
    });

    // Show toggle on hover
    dom.addEventListener('mouseenter', () => {
      toggleBtn.style.opacity = '1';
    });
    dom.addEventListener('mouseleave', () => {
      toggleBtn.style.opacity = '0';
    });

    dom.appendChild(mathContainer);
    dom.appendChild(sourceContainer);
    dom.appendChild(toggleBtn);

    // Initialize MathLive
    let mathField: any = null;

    function initMathField() {
      import('mathlive').then(({ MathfieldElement }) => {
        mathField = new MathfieldElement();
        mathField.value = currentValue;
        mathField.style.cssText = `
          display: ${display === 'inline' ? 'inline-block' : 'block'};
          ${display === 'block' ? 'min-width: 200px; font-size: 1.2em;' : 'font-size: 1em;'}
          border: none;
          outline: none;
          background: transparent;
        `;

        // Sync changes back to ProseMirror
        mathField.addEventListener('input', () => {
          currentValue = mathField.value;
          updateProseMirrorNode();
        });

        mathContainer.innerHTML = '';
        mathContainer.appendChild(mathField);
      }).catch((err) => {
        console.error('Failed to load MathLive:', err);
        mathContainer.textContent = currentValue || '(math)';
      });
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

    function switchMode(newMode: MathMode) {
      mode = newMode;
      dom.setAttribute('data-math-mode', mode);

      if (mode === 'visual') {
        sourceContainer.style.display = 'none';
        mathContainer.style.display = display === 'block' ? 'flex' : 'inline';
        if (mathField) {
          mathField.value = currentValue;
        }
      } else {
        mathContainer.style.display = 'none';
        sourceContainer.style.display = display === 'block' ? 'block' : 'inline';
        if (display === 'block') {
          sourceContainer.style.width = '100%';
          sourceContainer.style.padding = '0 16px';
          sourceContainer.style.boxSizing = 'border-box';
        }
        textarea.value = currentValue;
        setTimeout(() => textarea.focus(), 0);
      }
    }

    // Initialize
    initMathField();

    return {
      dom,
      stopEvent: () => true,
      ignoreMutation: () => true,
      update: (updatedNode) => {
        if (updatedNode.type.name !== node.type.name) return false;
        const newValue = updatedNode.attrs.value;
        if (newValue !== currentValue) {
          currentValue = newValue;
          if (mode === 'visual' && mathField) {
            mathField.value = currentValue;
          } else if (mode === 'source') {
            textarea.value = currentValue;
          }
        }
        node = updatedNode;
        return true;
      },
      destroy: () => {
        if (mathField) {
          mathField.remove();
        }
      },
    };
  };
}
