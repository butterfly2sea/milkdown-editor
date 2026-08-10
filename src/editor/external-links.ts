// Every plain <a href> outside the editor's own content gets handed to the
// system browser.
//
// This exists because of the WebView. Crepe's link tooltip renders
// `<a href={url} target="_blank">` with no script behind it, so a browser opens
// a tab while Tauri ignores `target="_blank"` entirely and nothing at all
// happens. The tooltip also lives outside `.ProseMirror`, so the editor plugin
// that handles Ctrl/Cmd+click never sees the event.

import { canOpen, openExternalUrl } from './link-open';
import type { EventManager } from '../utils/event-manager';

/** Links inside the editor content are {@link ./plugins/link-click}'s job: there
 *  a plain click belongs to the editor — place the cursor, pop the tooltip —
 *  and only Ctrl/Cmd+click opens. Handling them here too would open twice. */
const EDITOR_CONTENT = '.ProseMirror';

export function installExternalLinkHandler(events: EventManager): void {
  events.on(
    document,
    'click',
    (event) => {
      if (event.button !== 0 || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href]');
      if (!anchor || anchor.closest(EDITOR_CONTENT)) return;

      const href = anchor.getAttribute('href') ?? '';
      if (!canOpen(href)) return;

      // Both halves matter: the WebView must not try to navigate the app window
      // to the URL, and no other listener should treat this as a second open.
      event.preventDefault();
      event.stopPropagation();
      void openExternalUrl(href);
    },
    { capture: true },
  );
}
