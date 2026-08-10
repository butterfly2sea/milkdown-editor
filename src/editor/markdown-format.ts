import type { Ctx } from '@milkdown/kit/ctx';
import { remarkCtx, remarkStringifyOptionsCtx, schemaCtx, serializerCtx } from '@milkdown/kit/core';
import { SerializerState } from '@milkdown/kit/transformer';
import { remarkGFMPlugin } from '@milkdown/kit/preset/gfm';
import { attentionHandlers } from './mdast-attention';

/**
 * The editor rebuilds Markdown from its own AST every time it saves, so any
 * difference between what remark emits and what the author wrote shows up as a
 * spurious diff. This module narrows that gap on two fronts: stringify options
 * that match the conventions most Markdown is written in, and a pass over the
 * mdast tree that undoes distortions introduced on the way out of ProseMirror.
 */

interface MdNode {
  type: string;
  children?: MdNode[];
  value?: string;
  isMark?: boolean;
  spread?: unknown;
  [key: string]: unknown;
}

/** Marks whose split-and-rejoin is invisible once rendered. `link` is
 *  deliberately absent: joining two links would merge two click targets into
 *  one, which is a real change rather than a formatting one. */
const MERGEABLE_MARKS = new Set(['strong', 'emphasis', 'delete']);

/** Register the stringify options. Must run before the editor is created. */
export function configureMarkdownStringify(ctx: Ctx): void {
  ctx.update(remarkStringifyOptionsCtx, (prev) => ({
    ...prev,
    // Milkdown's own emphasis handlers write delimiters that CommonMark does
    // not read back as emphasis. See {@link attentionHandlers}.
    handlers: { ...prev.handlers, ...attentionHandlers },
    // remark defaults to `*` for bullets and `***` for rules; `-` for both is
    // what the overwhelming majority of Markdown in the wild uses.
    bullet: '-' as const,
    rule: '-' as const,
    ruleRepetition: 3,
    ruleSpaces: false,
    listItemIndent: 'one' as const,
  }));
  // Without this, every table cell is padded to its column's widest entry, so
  // editing one cell reflows every row in the table.
  ctx.set(remarkGFMPlugin.options.key, { tablePipeAlign: false });
}

/** Replace the serializer with one that cleans up the mdast tree on the way
 *  out. Must run after the editor has been created. */
export function installMarkdownNormalizer(ctx: Ctx): void {
  const schema = ctx.get(schemaCtx);
  const remark = ctx.get(remarkCtx);
  // One instance, like Milkdown's own `SerializerState.create` — `run` resets
  // the stack each time.
  const state = new SerializerState(schema);

  ctx.set(serializerCtx, (content) => {
    state.run(content);
    const root = state.build() as unknown as MdNode;
    return remark.stringify(normalizeRoot(root) as never);
  });
}

function normalizeRoot(root: MdNode): MdNode {
  normalizeNode(root);
  dropTrailingEmptyParagraphs(root);
  return root;
}

function normalizeNode(node: MdNode): void {
  coerceSpread(node);
  if (!node.children) return;
  node.children.forEach(normalizeNode);
  node.children = hoistSharedMarks(node.children, 0);
}

/**
 * The list serializers hand remark `spread` as the string `'true'` or
 * `'false'`, and `'false'` is truthy — so every tight list is written back as a
 * loose one, gaining a blank line between each item.
 */
function coerceSpread(node: MdNode): void {
  if (node.type !== 'list' && node.type !== 'listItem') return;
  node.spread = node.spread === true || node.spread === 'true';
}

/** Guards against a pathological tree keeping the rewrite going forever; three
 *  levels is already more nesting than emphasis markers can express. */
const MAX_HOIST_DEPTH = 3;

/**
 * ProseMirror stores a run like `**加粗 *斜体* 加粗**` as three text nodes that
 * all carry the same `strong` mark. The serializer closes and reopens the mark
 * at every one of those boundaries, and then moves the boundary spaces outside
 * the mark (`**a **` is not valid emphasis), leaving the reopened marks
 * non-adjacent so Milkdown's own merge step cannot put them back together. What
 * comes out is `**加粗** ***斜体*** **加粗**` — three siblings that are not even
 * the same type, since the middle one nests as `emphasis > strong`.
 *
 * So the fix is not "merge equal neighbours" but "pull out what neighbours have
 * in common": any run of siblings that all carry mark M, separated by nothing
 * but spaces, becomes a single M wrapping the run with M stripped from each
 * member. The example above collapses back to the original.
 *
 * This also rewrites a genuinely separate `**a** **b**` into `**a b**`. The two
 * are the same tree by the time it gets here and render identically, so there
 * is nothing to tell them apart with and nothing lost by picking one.
 */
function hoistSharedMarks(children: MdNode[], depth: number): MdNode[] {
  if (depth > MAX_HOIST_DEPTH) return children;
  let result = children;
  for (const type of MERGEABLE_MARKS) {
    result = hoistMark(result, type, depth);
  }
  return result;
}

function hoistMark(children: MdNode[], type: string, depth: number): MdNode[] {
  const result: MdNode[] = [];
  let index = 0;

  while (index < children.length) {
    const start = children[index]!;
    if (markDepth(start, type) < 0) {
      result.push(start);
      index += 1;
      continue;
    }

    // Extend over spaces to the last sibling that also carries the mark; a
    // sibling without it (ordinary text, a link, a differently marked run) ends
    // the run, and trailing spaces stay outside so the mark never wraps them.
    let end = index;
    for (let probe = index + 1; probe < children.length; probe += 1) {
      const node = children[probe]!;
      if (isSpacesOnly(node)) continue;
      if (markDepth(node, type) < 0) break;
      end = probe;
    }
    if (end === index) {
      result.push(start);
      index += 1;
      continue;
    }

    const inner: MdNode[] = [];
    for (let member = index; member <= end; member += 1) {
      const node = children[member]!;
      if (isSpacesOnly(node)) inner.push(node);
      else inner.push(...stripMark(node, type));
    }

    const { children: _children, ...marker } = markNode(start, type);
    result.push({ ...marker, children: hoistSharedMarks(inner, depth + 1) });
    index = end + 1;
  }

  return result;
}

/**
 * The marks wrapping a node, outermost first, following single-child links
 * only: `emphasis(strong(text))` yields `[emphasis, strong]`.
 */
function markPath(node: MdNode): MdNode[] {
  const path: MdNode[] = [];
  let current: MdNode | undefined = node;
  while (current?.isMark === true) {
    path.push(current);
    if (current.children?.length !== 1) break;
    current = current.children[0];
  }
  return path;
}

/** Where `type` sits in the node's mark path, or -1 if it is absent. */
function markDepth(node: MdNode, type: string): number {
  return markPath(node).findIndex((mark) => mark.type === type);
}

function markNode(node: MdNode, type: string): MdNode {
  const path = markPath(node);
  return path[path.findIndex((mark) => mark.type === type)]!;
}

/** Rebuild the node with `type` removed from its mark path, keeping the rest of
 *  the nesting intact. Returns a list because the innermost mark may hold
 *  several children. */
function stripMark(node: MdNode, type: string): MdNode[] {
  const path = markPath(node);
  const target = path.findIndex((mark) => mark.type === type);
  if (target < 0) return [node];

  let rebuilt = path[path.length - 1]!.children ?? [];
  for (let level = path.length - 1; level >= 0; level -= 1) {
    if (level === target) continue;
    rebuilt = [{ ...path[level]!, children: rebuilt }];
  }
  return rebuilt;
}

function isSpacesOnly(node: MdNode): boolean {
  return node.type === 'text' && typeof node.value === 'string' && /^[ \t]+$/.test(node.value);
}

/**
 * Milkdown keeps an empty paragraph at the end of the document so there is
 * always somewhere to click below a table or code block. It is scaffolding, not
 * content, and serializing it appends a blank line to the file on every save.
 */
function dropTrailingEmptyParagraphs(root: MdNode): void {
  const children = root.children;
  if (!children) return;
  while (children.length > 1 && isEmptyParagraph(children[children.length - 1]!)) {
    children.pop();
  }
}

function isEmptyParagraph(node: MdNode): boolean {
  if (node.type !== 'paragraph') return false;
  const children = node.children;
  if (!children || children.length === 0) return true;
  return children.every((child) => child.type === 'text' && !child.value);
}
