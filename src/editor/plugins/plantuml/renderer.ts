async function encodePlantUML(text: string): Promise<string> {
  const { encode } = await import('plantuml-encoder');
  return encode(text);
}

export type PlantUMLRenderResult =
  | { type: 'empty' }
  | { type: 'svg'; svg: string }
  | { type: 'error'; message: string };

const svgCache = new Map<string, string>();

export async function renderPlantUMLSvg(
  source: string,
  server: string,
): Promise<PlantUMLRenderResult> {
  const trimmed = source.trim();
  if (!trimmed) return { type: 'empty' };

  const cacheKey = `${server}\n${source}`;
  const cached = svgCache.get(cacheKey);
  if (cached) return { type: 'svg', svg: cached };

  try {
    const encoded = await encodePlantUML(source);
    const response = await fetch(`${server}/svg/${encoded}`);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || `HTTP ${response.status}`);
    }

    const responseText = await response.text();
    const svgStart = responseText.indexOf('<svg');
    if (svgStart < 0) throw new Error('Invalid SVG response');

    const svg = responseText.substring(svgStart);
    svgCache.set(cacheKey, svg);
    return { type: 'svg', svg };
  } catch (err) {
    return {
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
