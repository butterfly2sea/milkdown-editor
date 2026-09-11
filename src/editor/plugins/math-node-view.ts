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

/** Longest first, so `\leq` wins over the `\le` inside it. */
const RELATIONS = ['\\leqslant', '\\geqslant', '\\approx', '\\equiv', '\\leq', '\\geq', '\\neq', '\\le', '\\ge', '\\ne', '=', '<', '>'];

const ALIGNED = /^\\begin\{aligned\}([\s\S]*)\\end\{aligned\}$/;

/** Every index at which `token` occurs in `row` outside any `{…}` group. */
function topLevelIndexes(row: string, token: string): number[] {
  const found: number[] = [];
  let depth = 0;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '\\') {
      if (depth === 0 && row.startsWith(token, i)) {
        found.push(i);
        i += token.length - 1;
        continue;
      }
      // Step over the whole command name, so `{` inside `\frac{…}` still counts
      // but the backslash itself never does.
      i++;
      while (i + 1 < row.length && /[a-zA-Z]/.test(row[i + 1] as string)) i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (depth === 0 && row.startsWith(token, i)) {
      found.push(i);
      i += token.length - 1;
    }
  }
  return found;
}

function topLevelIndexOf(row: string, token: string): number {
  return topLevelIndexes(row, token)[0] ?? -1;
}

/** The row's cells, minus the empty trailing ones MathLive adds to pad every
 *  row out to the widest row's column count. Without that trimming a row the
 *  user typed into a single cell looks like it is already split. */
function rowCells(row: string): string[] {
  const cells: string[] = [];
  let start = 0;
  for (const at of topLevelIndexes(row, '&')) {
    cells.push(row.slice(start, at));
    start = at + 1;
  }
  cells.push(row.slice(start));
  while (cells.length > 1 && (cells[cells.length - 1] as string).trim() === '') cells.pop();
  return cells;
}

/** Put an `&` in front of the row's relation, which is what makes `aligned`
 *  line rows up on their equals signs. Rows the user has already split, and
 *  rows with no relation at all, are left alone. */
function alignRow(row: string): string {
  const cells = rowCells(row);
  if (cells.length > 1) return cells.join('&');
  const body = cells[0] as string;
  let at = -1;
  for (const relation of RELATIONS) {
    const index = topLevelIndexOf(body, relation);
    if (index >= 0 && (at < 0 || index < at)) at = index;
  }
  return at < 0 ? body : `${body.slice(0, at)}&${body.slice(at)}`;
}

/** The rows of `latex`, each broken at its relation — or null when a nested
 *  environment brings its own `\\` and `&`, which this splitting would mangle. */
function alignedRows(latex: string): string[] | null {
  const body = ALIGNED.exec(latex)?.[1] ?? latex;
  if (/\\begin\{/.test(body)) return null;
  return body.split(/\\\\/).map(alignRow);
}

function wrapAligned(rows: string[]): string {
  return `\\begin{aligned}${rows.join('\\\\ ')}\\end{aligned}`;
}

/**
 * `latex` with one more row on the end, wrapped in `aligned`, with `#?` (a
 * MathLive placeholder) marking where the caret should land.
 */
export function appendAlignedRow(latex: string): string {
  const rows = alignedRows(latex) ?? [ALIGNED.exec(latex)?.[1] ?? latex];
  return wrapAligned([...rows, '#?']);
}

/**
 * Re-break every row at its relation. Typing goes into whichever cell the caret
 * is in, so a row entered as `c=d` stays unsplit until this runs over it; only
 * formulas that are already `aligned` are touched.
 */
export function normalizeAlignedRows(latex: string): string {
  if (!ALIGNED.test(latex)) return latex;
  const rows = alignedRows(latex);
  return rows ? wrapAligned(rows) : latex;
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

    /** MathLive's own tooltips are grey bubbles drawn above the button, right
     *  on top of the formula being edited. editor-overrides.css hides them; the
     *  descriptions come back as native `title`s, which appear below the cursor
     *  and only after a delay. Re-applied on hover because MathLive rebuilds
     *  the markup on its own schedule. */
    function applyNativeTitles() {
      const shadow = mathField?.shadowRoot;
      if (!shadow) return;
      shadow.querySelector('[part=menu-toggle]')?.setAttribute('title', i18n.t.mathMenu);
      shadow
        .querySelector('[part=virtual-keyboard-toggle]')
        ?.setAttribute('title', i18n.t.mathVirtualKeyboard);
    }

    /** `addRowAfter` seeds new cells with `\placeholder{}`, which must never
     *  reach the markdown. Read the cleaned value, but leave `mathField.value`
     *  alone — assigning to it would reset the caret mid-edit. */
    function syncFromMathField() {
      if (!mathField) return;
      const next: string = mathField.getValue('latex-without-placeholders');
      if (next === currentValue) return;
      currentValue = next;
      updateProseMirrorNode();
    }

    /** Enter inside a block formula adds a LaTeX row rather than committing.
     *
     *  MathLive has no command for this: `aligned` is not one of its multiline
     *  environments, and `setEnvironment` turns the field's root into an array
     *  permanently — after that every assignment to `.value` gets nested inside
     *  it. So the row is spliced in as LaTeX and pushed back through `insert`,
     *  whose `#?` placeholder is what lands the caret on the new row. */
    function insertLineBreak() {
      if (!mathField) return;
      mathField.executeCommand('selectAll');
      mathField.executeCommand([
        'insert',
        appendAlignedRow(mathField.getValue('latex-without-placeholders')),
      ]);
      syncFromMathField();
    }

    /** Pressing Enter realigns the rows, but the row typed *after* the last
     *  Enter is still sitting in one cell. Fix it up once the field is done
     *  being edited, where resetting the caret costs nothing. */
    function normalizeOnBlur() {
      if (!mathField || display !== 'block') return;
      const current: string = mathField.getValue('latex-without-placeholders');
      const next = normalizeAlignedRows(current);
      if (next !== current) mathField.value = next;
      syncFromMathField();
    }

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
      mathField.addEventListener('input', syncFromMathField);

      if (display === 'block') {
        // Physical Enter. Captured so MathLive never sees it as a commit.
        mathField.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key !== 'Enter') return;
          if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          e.stopPropagation();
          insertLineBreak();
        }, true);
        // The virtual keyboard's return key produces no keydown at all — it
        // runs `commit`, which surfaces as a `change`. Blur fires `change`
        // too, so `hasFocus()` is what tells the two apart.
        mathField.addEventListener('change', () => {
          if (mathField?.hasFocus()) insertLineBreak();
        });
      }

      // `focusout`, not `blur`: the focus actually sits inside the shadow
      // root, so only the bubbling event reaches the host element.
      mathField.addEventListener('focusout', normalizeOnBlur);

      mathField.addEventListener('move-out', (e: CustomEvent<{ direction: string }>) => {
        e.preventDefault();
        moveOut(e.detail?.direction);
      });

      // `focus()` before this point is silently dropped: MathLive waits for an
      // IntersectionObserver before it builds the editable interior.
      mathField.addEventListener('mount', () => {
        applyNativeTitles();
        if (wantFocus) focusMathField();
      });
      applyNativeTitles();

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

    dom.addEventListener('pointerenter', applyNativeTitles);

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
