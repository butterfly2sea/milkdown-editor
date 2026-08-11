/** Feedback for milkdown's code block copy button.
 *
 *  The button is rendered by `@milkdown/components` and keeps the same label
 *  forever, so a copy that worked looked exactly like one that did not. The
 *  `onCopy` config hook only receives the copied text, never the button, so the
 *  click is tracked here to know which label to swap. */

const COPIED_LABEL = 'Copied';
const COPIED_LABEL_MS = 1500;

let clickedButton: HTMLElement | null = null;
let listening = false;

/** Remember the copy button being clicked. Capture phase, so it runs before the
 *  component's own click handler starts the copy. */
export function trackCodeBlockCopyClicks(): void {
  if (listening) return;
  listening = true;

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      clickedButton = target?.closest<HTMLElement>('.copy-button') ?? null;
    },
    true,
  );
}

/** Show `Copied` on the button that was just used, then put its label back. */
export function markCodeBlockCopied(): void {
  const button = clickedButton;
  if (!button) return;

  const label = [...button.childNodes].find(
    (node): node is Text => node.nodeType === Node.TEXT_NODE,
  );
  // Already counting down from an earlier click: leave that timer alone rather
  // than restoring `Copied` as if it were the original label.
  if (!label || label.data === COPIED_LABEL) return;

  const original = label.data;
  label.data = COPIED_LABEL;
  window.setTimeout(() => {
    if (label.data === COPIED_LABEL) label.data = original;
  }, COPIED_LABEL_MS);
}
