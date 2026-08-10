import { defaultHandlers } from 'mdast-util-to-markdown';
import type { Handle, Handlers, State } from 'mdast-util-to-markdown';

/**
 * `**x**` is only emphasis when its delimiters "flank": CommonMark decides that
 * from the characters on either side of the run. `**（重点）**` wedged between
 * two Chinese characters does not flank — the opening run has a letter before
 * it and punctuation after it — so the file reads back as literal asterisks.
 *
 * remark already solves this: where a bare delimiter would not form, it writes
 * the neighbouring character as a numeric reference (`前&#x9762;**（重点）**`),
 * which parses back to exactly the same text. Milkdown replaces the `strong`
 * and `emphasis` handlers with a copy that predates that fix — it only adds the
 * `*`/`_` the author originally used — and replacing them drops the escaping
 * with it. These handlers put the escaping back and keep the marker.
 */

type PeekableHandle = Handle & { peek?: Handle };

/**
 * Run `handler` with the node's own emphasis marker in force. The upstream
 * handlers read the marker off `state.options`, which is a per-serialization
 * object, so setting it around the one call is enough to keep `_x_` from
 * turning into `*x*`.
 */
function withMarker(handler: PeekableHandle, option: 'strong' | 'emphasis'): PeekableHandle {
  const wrapped: PeekableHandle = (node, parent, state, info) => {
    const marker = (node as { marker?: unknown }).marker;
    if (marker !== '*' && marker !== '_') return handler(node, parent, state, info);
    const previous = state.options[option];
    state.options[option] = marker;
    try {
      return handler(node, parent, state, info);
    } finally {
      state.options[option] = previous;
    }
  };
  // `containerPhrasing` calls `peek` to learn which character the next sibling
  // starts with. Without one it calls the handler itself, and the handler
  // leaves the "encode my surroundings" flag on the state — which then gets
  // applied to whatever node is serialized next.
  wrapped.peek = handler.peek;
  return wrapped;
}

const WHITESPACE = /\s/;
const PUNCTUATION = /\p{P}|\p{S}/u;

type CharacterKind = 'letter' | 'whitespace' | 'punctuation';

/** micromark's `classifyCharacter`. `NaN` — what `charCodeAt` returns past
 *  either end of a string — falls through to `letter`, as it does upstream. */
function classify(code: number): CharacterKind {
  const character = String.fromCharCode(code);
  if (WHITESPACE.test(character)) return 'whitespace';
  if (PUNCTUATION.test(character)) return 'punctuation';
  return 'letter';
}

interface EncodeSides {
  /** Encode the character just inside the run. */
  inside: boolean;
  /** Ask the parent to encode the character just outside it. */
  outside: boolean;
}

/**
 * Which side of a `~~` run has to be encoded for it to form at all. This is
 * mdast-util-to-markdown's `encodeInfo` without the stricter `_` branch: `~`
 * flanks the way `*` does.
 */
function encodeSides(outside: number, inside: number): EncodeSides {
  const outsideKind = classify(outside);
  const insideKind = classify(inside);
  // Whitespace on the inner edge never forms a run, whatever is outside it.
  if (insideKind === 'whitespace') {
    return { inside: true, outside: outsideKind !== 'punctuation' };
  }
  // Punctuation on the inner edge forms unless a letter sits against it.
  return { inside: false, outside: outsideKind === 'letter' && insideKind === 'punctuation' };
}

function encodeCharacterReference(code: number): string {
  return '&#x' + code.toString(16).toUpperCase() + ';';
}

declare module 'mdast-util-to-markdown' {
  /** `strikethrough` is the construct mdast-util-gfm-strikethrough enters, but
   *  that package never registers the name — it is plain JavaScript, so nothing
   *  there ever needed the declaration. Registering it is the extension
   *  mechanism mdast-util-to-markdown documents. */
  interface ConstructNameMap {
    strikethrough: 'strikethrough';
  }
}

/**
 * GFM strikethrough flanks like emphasis does, so `~~（重点）~~` between two
 * Chinese characters is lost the same way — but mdast-util-gfm-strikethrough
 * has never carried the fix upstream applied to `strong` and `emphasis`. This
 * is its handler with that logic added.
 */
const handleDelete: PeekableHandle = (node, _parent, state, info) => {
  const tracker = state.createTracker(info);
  const exit = state.enter('strikethrough');
  const before = tracker.move('~~');

  let between = tracker.move(
    state.containerPhrasing(node as Parameters<State['containerPhrasing']>[0], {
      ...tracker.current(),
      before,
      after: '~',
    }),
  );

  const betweenHead = between.charCodeAt(0);
  const open = encodeSides(info.before.charCodeAt(info.before.length - 1), betweenHead);
  if (open.inside) between = encodeCharacterReference(betweenHead) + between.slice(1);

  const betweenTail = between.charCodeAt(between.length - 1);
  const close = encodeSides(info.after.charCodeAt(0), betweenTail);
  if (close.inside) between = between.slice(0, -1) + encodeCharacterReference(betweenTail);

  const after = tracker.move('~~');
  exit();

  state.attentionEncodeSurroundingInfo = { after: close.outside, before: open.outside };
  return before + between + after;
};
handleDelete.peek = () => '~';

export const attentionHandlers: Partial<Handlers> = {
  strong: withMarker(defaultHandlers.strong, 'strong'),
  emphasis: withMarker(defaultHandlers.emphasis, 'emphasis'),
  delete: handleDelete,
};
