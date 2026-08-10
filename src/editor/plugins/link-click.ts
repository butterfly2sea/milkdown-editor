// Ctrl/Cmd+click on a link in the WYSIWYG editor opens it in the system
// browser.
//
// Unlike source mode there are real <a> elements to hit-test, so this is just a
// matter of getting in before Crepe's link tooltip claims the click.

import { Plugin, PluginKey } from 'prosemirror-state';
import { isModifierClick, openExternalUrl, canOpen } from '../link-open';

const MODIFIER_CLASS = 'link-modifier-down';

/** The <a> under the event, if it is one the browser should handle. */
function linkFrom(event: Event): HTMLAnchorElement | null {
  const target = event.target as HTMLElement | null;
  const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!anchor) return null;
  const href = anchor.getAttribute('href') ?? '';
  return canOpen(href) ? anchor : null;
}

export function createLinkClickPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('milkdown-link-click'),
    view(view) {
      // Held-modifier state lives on the editor's DOM so the cursor can switch
      // to a pointer in CSS, matching what source mode does with a decoration.
      const setModifier = (down: boolean) => {
        view.dom.classList.toggle(MODIFIER_CLASS, down);
      };
      const onKey = (e: KeyboardEvent) => setModifier((e.ctrlKey || e.metaKey) && !e.altKey);
      const onBlur = () => setModifier(false);

      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
      window.addEventListener('blur', onBlur);

      return {
        destroy() {
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('keyup', onKey);
          window.removeEventListener('blur', onBlur);
        },
      };
    },
    props: {
      handleDOMEvents: {
        // mousedown, not click: the link tooltip opens on mousedown, and a
        // plain click would also have moved the cursor into the link text.
        mousedown(_view, event) {
          if (!isModifierClick(event)) return false;
          const anchor = linkFrom(event);
          if (!anchor) return false;
          event.preventDefault();
          event.stopPropagation();
          void openExternalUrl(anchor.getAttribute('href') ?? '');
          return true;
        },
      },
    },
  });
}
