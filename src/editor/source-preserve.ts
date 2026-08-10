import { diffArrays } from 'diff';
import { splitFrontmatter } from './frontmatter';

/**
 * Even a well-behaved serializer has to pick one spelling for constructs that
 * Markdown lets you write several ways, so saving rewrites `1)` to `1.`,
 * `~~~` to ```` ``` ````, a setext heading to `#`, and — worse — adds
 * backslashes to `**注意：**这里` and `a_b_c` to pin down how CommonMark reads
 * them. None of that is an edit the author made.
 *
 * The fix is to write less. Line the document's top-level blocks up against the
 * ones in the file on disk, and for every block that still *means* the same
 * thing, put the original text back verbatim. Only blocks the author actually
 * changed get the serializer's spelling.
 */

interface PositionedNode {
  position?: { start?: { offset?: number }; end?: { offset?: number } };
}

interface ParsedRoot {
  children?: PositionedNode[];
}

export interface MarkdownProcessor {
  parse: (markdown: string) => ParsedRoot;
  stringify: (tree: ParsedRoot) => string;
}

interface Block {
  /** The block itself, exactly as it appears in its source. */
  text: string;
  /** Whatever separates it from the next block in its own source — blank lines,
   *  and for the last block whatever trailing whitespace the file ends with. */
  gap: string;
  /** How the block reads after a parse/serialize round-trip. Two blocks with
   *  equal keys say the same thing however differently they are spelled. */
  key: string;
  /** Which document it came from, and where in it. A gap only describes the
   *  join between these two particular neighbours, so it may only be reused
   *  when the same two blocks end up adjacent again. */
  source: string;
  index: number;
  last: boolean;
}

/**
 * @param original what is currently on disk
 * @param generated what the editor produced
 * @returns `generated`, with every semantically untouched block replaced by its
 *          original text. Falls back to `generated` unchanged if anything at
 *          all looks off.
 */
export function preserveSourceBlocks(
  original: string,
  generated: string,
  processor: MarkdownProcessor,
): string {
  try {
    return merge(original, generated, processor);
  } catch {
    // A malformed document must never cost the user their save.
    return generated;
  }
}

function merge(original: string, generated: string, processor: MarkdownProcessor): string {
  if (!original.trim()) return generated;

  const originalSplit = splitFrontmatter(original);
  const generatedSplit = splitFrontmatter(generated);
  // Both `body` values are suffixes of their input, so the frontmatter is
  // whatever precedes them. Reusing the original's keeps its fence style and
  // spacing when the metadata itself did not change.
  const head = originalSplit.yaml === generatedSplit.yaml
    ? original.slice(0, original.length - originalSplit.body.length)
    : generated.slice(0, generated.length - generatedSplit.body.length);

  const originalBlocks = splitBlocks(originalSplit.body, processor, 'original');
  const generatedBlocks = splitBlocks(generatedSplit.body, processor, 'generated');
  if (!originalBlocks || !generatedBlocks) return generated;

  const merged = mergeBlocks(originalBlocks, generatedBlocks);

  // The safety net: whatever was stitched together has to parse to the same
  // document the editor meant to write. If it does not — an unforeseen block
  // type, a slice that does not stand on its own, a gap that changed how the
  // next block is read — the merge is dropped rather than debugged at the
  // user's expense.
  if (canonical(merged, processor) !== canonical(generatedSplit.body, processor)) {
    return generated;
  }

  return head + merged;
}

function mergeBlocks(original: Block[], generated: Block[]): string {
  const parts = diffArrays(
    original.map((block) => block.key),
    generated.map((block) => block.key),
  );

  const pieces: Block[] = [];
  let originalIndex = 0;
  let generatedIndex = 0;

  for (const part of parts) {
    const count = part.count ?? part.value.length;
    if (part.removed) {
      originalIndex += count;
      continue;
    }
    if (part.added) {
      pieces.push(...generated.slice(generatedIndex, generatedIndex + count));
      generatedIndex += count;
      continue;
    }
    // Unchanged: the original's spelling wins, and so does its spacing.
    pieces.push(...original.slice(originalIndex, originalIndex + count));
    originalIndex += count;
    generatedIndex += count;
  }

  return pieces.map((block, index) => block.text + join(block, pieces[index + 1])).join('');
}

/**
 * What to put between a block and whatever follows it. The block's own gap only
 * applies when its original neighbour is still the one behind it — the
 * whitespace that separated a table from the end of the file is not enough to
 * separate that same table from a newly added paragraph, which would be read as
 * another table row. Anywhere the document was rearranged, one blank line is
 * the safe answer.
 */
function join(block: Block, next: Block | undefined): string {
  if (!next) return block.last ? block.gap : '\n';
  const stillAdjacent = next.source === block.source && next.index === block.index + 1;
  return stillAdjacent ? block.gap : '\n\n';
}

function splitBlocks(markdown: string, processor: MarkdownProcessor, source: string): Block[] | null {
  const children = processor.parse(markdown).children ?? [];
  if (children.length === 0) return null;

  const blocks: Block[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const start = children[index]?.position?.start?.offset;
    const end = children[index]?.position?.end?.offset;
    // Positions are what make this work at all; without them there is no way to
    // recover a block's original text.
    if (start == null || end == null) return null;
    const nextStart = children[index + 1]?.position?.start?.offset ?? markdown.length;
    const text = markdown.slice(start, end);
    blocks.push({
      text,
      gap: markdown.slice(end, nextStart),
      key: canonical(text, processor),
      source,
      index,
      last: index === children.length - 1,
    });
  }
  return blocks;
}

function canonical(markdown: string, processor: MarkdownProcessor): string {
  return processor.stringify(processor.parse(markdown)).trim();
}
