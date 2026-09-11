// Every plain <a href> outside the editor's own content gets followed here.
//
// This exists because of the WebView. Crepe's link tooltip renders
// `<a href={url} target="_blank">` with no script behind it, so a browser opens
// a tab while Tauri ignores `target="_blank"` entirely and nothing at all
// happens. The tooltip also lives outside `.ProseMirror`, so the editor plugin
// that handles Ctrl/Cmd+click never sees the event.

import { canOpen, isDocLink, openExternalUrl } from './link-open';
import { openDocLink } from './doc-link';
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

      if (canOpen(href) || isDocLink(href)) {
        // Both halves matter: the WebView must not try to navigate the app
        // window to the href — which is exactly what a relative path in the
        // tooltip used to do, taking the whole app with it — and no other
        // listener should treat this as a second open.
        event.preventDefault();
        event.stopPropagation();
        if (canOpen(href)) void openExternalUrl(href);
        else openDocLink(href);
        return;
      }

      // Nothing here follows `file:`, `javascript:` or a bare `#`, but the
      // WebView would happily navigate to them, so the default is still off.
      // A download link is a different thing entirely and is left alone.
      if (!anchor.hasAttribute('download')) event.preventDefault();
    },
    { capture: true },
  );
}
