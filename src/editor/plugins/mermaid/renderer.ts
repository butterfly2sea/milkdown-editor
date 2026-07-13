import type { MermaidTheme } from './theme';

export type MermaidRenderResult =
  | { type: 'empty' }
  | { type: 'svg'; svg: string }
  | { type: 'error'; message: string };

// Cache rendered SVG per theme+source so theme toggles and edits re-render only when needed.
const svgCache = new Map<string, string>();
let idCounter = 0;

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const anyErr = err as { str?: string; message?: string };
    if (anyErr.str) return anyErr.str;
    if (anyErr.message) return anyErr.message;
  }
  return 'Invalid diagram syntax';
}

export async function renderMermaidSvg(
  source: string,
  theme: MermaidTheme,
): Promise<MermaidRenderResult> {
  const trimmed = source.trim();
  if (!trimmed) return { type: 'empty' };

  const cacheKey = `${theme}\n${trimmed}`;
  const cached = svgCache.get(cacheKey);
  if (cached) return { type: 'svg', svg: cached };

  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
      fontFamily: 'inherit',
    });

    // Unique id per render; mermaid throws if an element with the id already exists.
    const id = `mermaid-render-${++idCounter}`;
    const { svg } = await mermaid.render(id, trimmed);

    // Defensive cleanup of any temporary nodes mermaid may leave behind on error paths.
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();

    svgCache.set(cacheKey, svg);
    return { type: 'svg', svg };
  } catch (err) {
    return { type: 'error', message: extractErrorMessage(err) };
  }
}
