// Whole-document Markdown source editor, backed by CodeMirror 6.
//
// This replaces the plain <textarea> that source mode used to be. A textarea
// can only ever hold a single selection, so multi-cursor and column selection
// were physically impossible there, and the find bar had nothing to drive.

import { Compartment, EditorSelection, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  dropCursor,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput } from '@codemirror/language';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { highlightSelectionMatches } from '@codemirror/search';
import { multiCursorSupport } from './cm-multi-cursor';
import { cmSearchHighlight } from './cm-search-highlight';

const MONO_STACK = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

/** Colours come from the app's CSS variables so theme switching is pure CSS —
 *  only the syntax highlight style has to be swapped at runtime. */
const themeSpec = {
  '&': {
    height: '100%',
    fontSize: '14px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-primary)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: MONO_STACK,
    lineHeight: '1.6',
    overflow: 'auto',
  },
  '.cm-content': { caretColor: 'var(--text-primary)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text-primary)' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    borderRight: '1px solid var(--border-subtle)',
  },
  // drawSelection() paints the selection into a layer *behind* the text
  // (z-index: -2), so an opaque line background hides it completely — which is
  // exactly what a single-line selection is: the selected line is also the
  // active line. Both of these have to stay translucent.
  '.cm-activeLine': { backgroundColor: 'var(--cm-active-line-bg)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--cm-active-line-bg)',
    color: 'var(--text-secondary)',
  },
  // drawSelection() renders selections itself, so the native ::selection colour
  // is never used for the primary selection — but it still is for the extra
  // ranges the browser paints during a native drag.
  //
  // The focused case needs CodeMirror's own full selector path: its base theme
  // ships `&light.cm-focused > .cm-scroller > .cm-selectionLayer
  // .cm-selectionBackground`, which outweighs anything shorter and would
  // otherwise win with its stock lilac.
  '.cm-selectionBackground, & ::selection': {
    background: 'var(--cm-selection-bg)',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    background: 'var(--cm-selection-bg)',
  },
  '.cm-selectionMatch': { backgroundColor: 'rgba(255, 213, 0, 0.25)' },
};

// Built once each, not per theme switch: `EditorView.theme` mints a fresh class
// name on every call, and those accumulate in the document's stylesheet.
const lightTheme = EditorView.theme(themeSpec, { dark: false });
const darkTheme = EditorView.theme(themeSpec, { dark: true });

const isDarkTheme = () => document.documentElement.getAttribute('data-theme') === 'dark';

/** The theme has to be swapped along with the highlight style so CodeMirror's
 *  own `&dark` base rules match the app's theme. */
const appearanceFor = (dark: boolean): Extension => [
  dark ? darkTheme : lightTheme,
  syntaxHighlighting(dark ? oneDarkHighlightStyle : defaultHighlightStyle, { fallback: true }),
];

export class SourceEditor {
  private wrapper: HTMLElement;
  private editorView: EditorView;
  private appearanceCompartment = new Compartment();
  private themeObserver: MutationObserver;
  /** Guards the update listener while `value` is assigned programmatically, so
   *  loading a file does not look like the user typing. */
  private applyingValue = false;
  private visible = false;

  constructor(host: HTMLElement, onInput: (value: string) => void) {
    this.wrapper = document.createElement('div');
    this.wrapper.id = 'source-editor';
    this.wrapper.style.cssText = 'display: none; height: 100%;';
    host.appendChild(this.wrapper);

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      dropCursor(),
      indentOnInput(),
      EditorView.lineWrapping,
      markdown(),
      this.appearanceCompartment.of(appearanceFor(isDarkTheme())),
      highlightSelectionMatches(),
      cmSearchHighlight,
      // Alt+click / Alt+drag multi-cursor plus Alt+J occurrence selection.
      multiCursorSupport,
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !this.applyingValue) {
          onInput(update.state.doc.toString());
        }
      }),
    ];

    this.editorView = new EditorView({
      state: EditorState.create({ doc: '', extensions }),
      parent: this.wrapper,
    });

    this.themeObserver = new MutationObserver(() => {
      this.editorView.dispatch({
        effects: this.appearanceCompartment.reconfigure(appearanceFor(isDarkTheme())),
      });
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  get view(): EditorView {
    return this.editorView;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  get value(): string {
    return this.editorView.state.doc.toString();
  }

  set value(next: string) {
    if (next === this.value) return;
    this.applyingValue = true;
    try {
      this.editorView.dispatch({
        changes: { from: 0, to: this.editorView.state.doc.length, insert: next },
        selection: EditorSelection.single(0),
      });
    } finally {
      this.applyingValue = false;
    }
  }

  show(): void {
    this.visible = true;
    this.wrapper.style.display = 'block';
    // The view measured itself while hidden (zero height), so line heights and
    // the viewport are stale until it is laid out again.
    this.editorView.requestMeasure();
  }

  hide(): void {
    this.visible = false;
    this.wrapper.style.display = 'none';
  }

  focus(): void {
    this.editorView.focus();
  }

  destroy(): void {
    this.themeObserver.disconnect();
    this.editorView.destroy();
    this.wrapper.remove();
  }
}
