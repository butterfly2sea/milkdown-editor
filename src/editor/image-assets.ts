export const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;

const normalize = (path: string): string => path.replace(/\\/g, '/');

export const dirOf = (path: string): string => normalize(path).split('/').slice(0, -1).join('/');

export const baseName = (path: string): string => normalize(path).split('/').pop() ?? '';

function assetsDirName(mdPath: string): string {
  return baseName(mdPath).replace(/\.(md|markdown)$/i, '') + '.assets';
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/avif': 'avif',
};

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
};

export function extFor(name: string, mime: string): string {
  const match = name.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
  if (match) return match[1].toLowerCase();
  const mediaType = mime.toLowerCase().split(';', 1)[0].trim();
  return MIME_EXT[mediaType] ?? 'png';
}

export function mimeFor(name: string): string {
  const ext = extFor(name, '').toLowerCase();
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return fileToDataUrl(new File([copy.buffer], 'image', { type: mime }));
}

export async function saveToAssets(mdPath: string, bytes: Uint8Array, ext: string): Promise<string> {
  const { mkdir, writeFile, exists } = await import('@tauri-apps/plugin-fs');
  const dirName = assetsDirName(mdPath);
  const dir = `${dirOf(mdPath)}/${dirName}`;
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = `img-${unique}.${ext}`;
  await writeFile(`${dir}/${fileName}`, bytes);
  return `${dirName}/${fileName}`;
}

export const isAbsolute = (path: string): boolean => /^([a-zA-Z]:[\\/]|\/)/.test(path);
