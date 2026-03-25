import { diffLines } from 'diff';

export interface DiffBlock {
  type: 'same' | 'add' | 'remove' | 'modify';
  localLines: string[];
  remoteLines: string[];
  resolved?: 'local' | 'remote';
}

/**
 * Compute line-level diff between local and remote content.
 * Adjacent remove+add pairs are merged into 'modify' blocks.
 */
export function computeDiff(localContent: string, remoteContent: string): DiffBlock[] {
  const changes = diffLines(localContent, remoteContent);
  const raw: DiffBlock[] = [];

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, '').split('\n');
    if (!change.added && !change.removed) {
      raw.push({ type: 'same', localLines: lines, remoteLines: lines });
    } else if (change.removed) {
      raw.push({ type: 'remove', localLines: lines, remoteLines: [] });
    } else if (change.added) {
      raw.push({ type: 'add', localLines: [], remoteLines: lines });
    }
  }

  // Merge adjacent remove+add into modify blocks
  const merged: DiffBlock[] = [];
  for (let i = 0; i < raw.length; i++) {
    const curr = raw[i];
    const next = raw[i + 1];
    if (curr.type === 'remove' && next?.type === 'add') {
      merged.push({
        type: 'modify',
        localLines: curr.localLines,
        remoteLines: next.remoteLines,
      });
      i++; // skip next
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

/**
 * Build merged content from resolved diff blocks.
 * Unresolved modify/add/remove blocks default to local version.
 */
export function buildMergedContent(blocks: DiffBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    if (block.type === 'same') {
      lines.push(...block.localLines);
    } else if (block.resolved === 'remote') {
      lines.push(...block.remoteLines);
    } else {
      // Default to local (for unresolved or explicitly 'local')
      lines.push(...block.localLines);
    }
  }
  return lines.join('\n');
}
