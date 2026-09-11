import type { NodeViewConstructor } from '@milkdown/kit/prose/view';
import { TextSelection } from '@milkdown/kit/prose/state';
import { i18n } from '../../i18n';
import { toast } from '../../ui/toast';

type MathMode = 'visual' | 'source';

type MathfieldCtor = new () => any;

/** MathLive is a large chunk, so it stays behind a dynamic import — but once it
 *  has arrived the constructor is kept here, because a node view that has to
 *  await a promise cannot focus itself before the *next* keystroke lands, and
 *  that keystroke would type straight over the freshly inserted formula. */
let mathfieldCtor: MathfieldCtor | null = null;
let mathfieldLoad: Promise<MathfieldCtor> | null = null;

export function preloadMathLive(): Promise<MathfieldCtor> {
  mathfieldLoad ??= import('mathlive').then(({ MathfieldElement }) => {
    mathfieldCtor = MathfieldElement as unknown as MathfieldCtor;
    return mathfieldCtor;
  });
  return mathfieldLoad;
}

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
    textarea.placeholder = i18n.t.mathPlaceholder;
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
    toggleBtn.title = i18n.t.mathToggleSource;
    toggleBtn.className = 'math-toggle-btn';
    // Visibility is left to editor-overrides.css, which reveals this button and
    // MathLive's own two toggles together on hover.
    toggleBtn.style.cssText = `
      position: absolute;
      top: var(--math-tool-top);
      right: ${display === 'block' ? '10px' : '-2px'};
      font-size: 10px;
      height: 20px;
      padding: 0 4px;
      box-sizing: border-box;
      border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 3px;
      background: var(--bg-elevated, #fff);
      color: var(--text-muted, #999);
      cursor: pointer;
      z-index: 10;
      line-height: 1;
    `;
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchMode(mode === 'visual' ? 'source' : 'visual');
    });

    dom.appendChild(mathContainer);
    dom.appendChild(sourceContainer);
    dom.appendChild(toggleBtn);

    // Initialize MathLive
    let mathField: any = null;
    /** The node is selected, so the caret belongs in MathLive — which may not be
     *  built, or not yet mounted, so the wish outlives any single `focus()`. */
    let wantFocus = false;

    function focusMathField() {
      wantFocus = true;
      if (!mathField) return;
      mathField.focus();
      mathField.executeCommand('moveToMathfieldEnd');
    }

    /** Hand the caret back to ProseMirror when the user arrows or tabs off the
     *  edge of the formula, so a field that auto-focuses is not a trap. */
    function moveOut(direction: string) {
      const pos = getPos();
      if (pos == null) return;
      const backwards = direction === 'backward' || direction === 'upward';
      const target = backwards ? pos : pos + node.nodeSize;
      const $target = view.state.doc.resolve(Math.min(target, view.state.doc.content.size));
      view.dispatch(view.state.tr.setSelection(TextSelection.near($target, backwards ? -1 : 1)));
      view.focus();
    }

    function buildMathField(Mathfield: MathfieldCtor) {
      mathField = new Mathfield();
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

      mathField.addEventListener('move-out', (e: CustomEvent<{ direction: string }>) => {
        e.preventDefault();
        moveOut(e.detail?.direction);
      });

      // `focus()` before this point is silently dropped: MathLive waits for an
      // IntersectionObserver before it builds the editable interior.
      mathField.addEventListener('mount', () => {
        if (wantFocus) focusMathField();
      });

      mathContainer.innerHTML = '';
      mathContainer.appendChild(mathField);

      if (wantFocus) focusMathField();
    }

    function initMathField() {
      // Synchronous whenever MathLive is already in memory, which is what lets
      // a formula created by an input rule take the caret before the user's
      // next keystroke reaches ProseMirror.
      if (mathfieldCtor) {
        buildMathField(mathfieldCtor);
        return;
      }
      preloadMathLive().then(buildMathField).catch((err) => {
        console.error('Failed to load MathLive:', err);
        toast(i18n.t.mathLoadFailed, 'error');
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
      // Defining these takes over from ProseMirror's default class toggling,
      // so the class has to be applied by hand. Focusing here is what makes a
      // freshly typed or slash-inserted formula ready to type into.
      selectNode: () => {
        dom.classList.add('ProseMirror-selectednode');
        if (mode === 'visual') focusMathField();
      },
      deselectNode: () => {
        wantFocus = false;
        dom.classList.remove('ProseMirror-selectednode');
      },
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
