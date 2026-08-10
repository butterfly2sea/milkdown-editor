import { IMAGE_DATA_TYPE, imageBlockSchema } from '@milkdown/kit/component/image-block';

/**
 * Crepe's block image keeps the display ratio in Markdown's `alt` slot, so
 * `![我的图片](a.png)` comes back as `![1.00](a.png)`: opening a document is
 * enough to lose every block image's alt text.
 *
 * This gives the node a real `alt` attribute and treats the ratio as the
 * fallback occupant of that slot — a document that has alt text keeps it, and
 * one that has none still remembers how the image was resized.
 */

/** Exactly the shape Crepe writes (`Number.parseFloat(ratio).toFixed(2)`), so
 *  documents it already mangled are recognised while ordinary numeric alt text
 *  such as `2024` is left alone. */
const CREPE_RATIO_ALT = /^\d+\.\d{2}$/;

function normalizeRatio(value: unknown): number {
  const ratio = Number(value);
  return Number.isNaN(ratio) || ratio === 0 ? 1 : ratio;
}

/** Registered after Crepe so it replaces the built-in `image-block` schema:
 *  `$node` keys the node registry by id and keeps the last one registered. */
export const imageBlockAltSchema = imageBlockSchema.extendSchema((prev) => (ctx) => {
  const base = prev(ctx);

  return {
    ...base,
    attrs: {
      ...base.attrs,
      alt: { default: '', validate: 'string' },
    },
    parseDOM: [
      {
        tag: `img[data-type="${IMAGE_DATA_TYPE}"]`,
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) return false;
          return {
            src: dom.getAttribute('src') || '',
            caption: dom.getAttribute('caption') || '',
            alt: dom.getAttribute('alt') || '',
            ratio: normalizeRatio(dom.getAttribute('ratio') ?? 1),
          };
        },
      },
    ],
    toDOM: (node) => ['img', { 'data-type': IMAGE_DATA_TYPE, ...node.attrs }],
    parseMarkdown: {
      match: base.parseMarkdown.match,
      runner: (state, node, type) => {
        const raw = (node.alt as string) || '';
        const isRatio = CREPE_RATIO_ALT.test(raw);
        state.addNode(type, {
          src: node.url as string,
          caption: node.title as string,
          alt: isRatio ? '' : raw,
          ratio: isRatio ? normalizeRatio(raw) : 1,
        });
      },
    },
    toMarkdown: {
      match: base.toMarkdown.match,
      runner: (state, node) => {
        const { alt, caption, src, ratio } = node.attrs;
        const numericRatio = normalizeRatio(ratio);
        state.openNode('paragraph');
        state.addNode('image', undefined, undefined, {
          title: caption,
          url: src,
          // One slot, two candidates: alt text is the author's, the ratio is
          // ours, so the author wins. Writing `1.00` for an unresized image
          // would also rewrite every plain `![](x.png)` in the document.
          alt: alt || (numericRatio === 1 ? '' : numericRatio.toFixed(2)),
        });
        state.closeNode();
      },
    },
  };
});
