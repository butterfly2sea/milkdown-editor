/** Clipboard writes that also work inside the desktop webview.
 *
 *  On Linux Tauri renders through WebKitGTK, which refuses the async clipboard
 *  API (`navigator.clipboard.writeText`) unless the webview was built with
 *  `javascript-can-access-clipboard` — wry only turns that on for
 *  `WebViewAttributes::clipboard`, and Tauri leaves it off. Everything that
 *  copies through `document.execCommand('copy')` keeps working, which is why
 *  the toolbar copy button is fine while the code block one is not: milkdown's
 *  `CopyButton` calls `navigator.clipboard.writeText` and its `try/catch`
 *  fallback never runs, because the call is returned instead of awaited so the
 *  rejection escapes the `try` block.
 *
 *  {@link installClipboardFallback} patches the rejection back into that
 *  fallback for every caller, our own code and milkdown's components alike.
 */

/** Copy `text`, preferring the async clipboard API and falling back to a
 *  throw-away `<textarea>` plus `document.execCommand('copy')`.
 *  Resolves to `false` when both paths fail. */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyViaExecCommand(text);
  }
}

/** The legacy copy path: select the text inside an off-screen `<textarea>` and
 *  let the webview's native copy command take it from there. Restores the
 *  document selection and the focused element afterwards. */
function copyViaExecCommand(text: string): boolean {
  const previouslyFocused = document.activeElement;
  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  const area = document.createElement('textarea');
  area.value = text;
  // Keeps mobile keyboards closed and the element out of the layout.
  area.setAttribute('readonly', '');
  area.style.cssText =
    'position:fixed;top:0;left:-9999px;opacity:0;contain:strict;font-size:12pt;';
  document.body.appendChild(area);

  area.select();
  area.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (err) {
    console.warn('[clipboard] execCommand copy failed:', err);
  }

  area.remove();

  if (selection && previousRange) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }
  if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();

  return copied;
}

/** Route `navigator.clipboard.writeText` through {@link writeClipboardText} so
 *  third-party components — milkdown's code block copy button, the diagram
 *  context menus — get the `execCommand` fallback too. Rejections are kept for
 *  callers that handle them, with `onFailure` for the ones that only log.
 *
 *  Call once, before the editor is created. */
export function installClipboardFallback(
  onFailure?: (error: unknown) => void,
): void {
  const clipboard = navigator.clipboard as Clipboard | undefined;

  const write = async (text: string): Promise<void> => {
    if (copyViaExecCommand(text)) return;
    const error = new Error('clipboard write is unavailable');
    onFailure?.(error);
    throw error;
  };

  if (!clipboard) {
    // No secure context: the whole API is missing, not just refusing writes.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: write },
    });
    return;
  }

  const native = clipboard.writeText.bind(clipboard);
  clipboard.writeText = async (text: string): Promise<void> => {
    try {
      await native(text);
    } catch (err) {
      console.warn('[clipboard] async clipboard API failed:', err);
      await write(text);
    }
  };
}
