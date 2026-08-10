// Ctrl/Cmd+click on a link in source mode opens it in the system browser.
//
// Source mode is plain text, so there is nothing to hit-test: links are located
// by scanning the hovered line (see `link-open.ts`). While the modifier is held
// the link under the pointer is underlined, the way an IDE marks it clickable.

import { StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type PluginValue,
} from '@codemirror/view';
import { hasModifier, isModifierClick, linkAt, openExternalUrl } from './link-open';

interface HoveredLink {
  from: number;
  to: number;
}

const setHoveredLink = StateEffect.define<HoveredLink | null>();

const linkMark = Decoration.mark({ class: 'cm-md-link' });

const hoveredLink = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHoveredLink)) {
        return effect.value
          ? Decoration.set([linkMark.range(effect.value.from, effect.value.to)])
          : Decoration.none;
      }
    }
    // An edit can move or invalidate the span; the next mousemove re-derives it.
    return tr.docChanged ? Decoration.none : decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Watches the modifier key and the pointer, and marks the link where they
 *  meet. `posAtCoords` only runs while the modifier is down, so an idle mouse
 *  costs nothing. */
class LinkHoverTracker implements PluginValue {
  private modifier = false;
  private pointer: { x: number; y: number } | null = null;
  private marked: HoveredLink | null = null;

  constructor(private readonly view: EditorView) {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onWindowBlur);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onWindowBlur);
  }

  pointerAt(coords: { x: number; y: number } | null): void {
    this.pointer = coords;
    this.sync();
  }

  /** The link at the pointer, in document positions. */
  linkUnder(coords: { x: number; y: number }): { from: number; to: number; url: string } | null {
    const pos = this.view.posAtCoords(coords);
    if (pos == null) return null;
    const line = this.view.state.doc.lineAt(pos);
    const span = linkAt(line.text, pos - line.from);
    if (!span) return null;
    return { from: line.from + span.from, to: line.from + span.to, url: span.url };
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    this.modifier = hasModifier(e);
    this.sync();
  };

  private readonly onWindowBlur = (): void => {
    this.modifier = false;
    this.sync();
  };

  private sync(): void {
    const next =
      this.modifier && this.pointer ? this.linkUnder(this.pointer) : null;
    if (next?.from === this.marked?.from && next?.to === this.marked?.to) return;
    this.marked = next ? { from: next.from, to: next.to } : null;
    this.view.dispatch({ effects: setHoveredLink.of(this.marked) });
  }
}

const linkHoverTracker = ViewPlugin.fromClass(LinkHoverTracker);

const linkMouseHandlers = EditorView.domEventHandlers({
  mousemove(event, view) {
    view.plugin(linkHoverTracker)?.pointerAt({ x: event.clientX, y: event.clientY });
    return false;
  },
  mouseleave(_event, view) {
    view.plugin(linkHoverTracker)?.pointerAt(null);
    return false;
  },
  mousedown(event, view) {
    if (!isModifierClick(event)) return false;
    const link = view
      .plugin(linkHoverTracker)
      ?.linkUnder({ x: event.clientX, y: event.clientY });
    if (!link) return false;
    // Keep the click from also moving the cursor / starting a drag selection.
    event.preventDefault();
    void openExternalUrl(link.url);
    return true;
  },
});

export const cmLinkClick = [hoveredLink, linkHoverTracker, linkMouseHandlers];
