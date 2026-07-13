export type MermaidTheme = 'light' | 'dark';

export function getMermaidTheme(): MermaidTheme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

type ThemeListener = (theme: MermaidTheme) => void;

const listeners = new Set<ThemeListener>();
let observer: MutationObserver | null = null;
let lastTheme: MermaidTheme | null = null;

// Subscribe to <html data-theme> changes with a single shared MutationObserver.
export function onThemeChange(listener: ThemeListener): () => void {
  listeners.add(listener);

  if (!observer) {
    lastTheme = getMermaidTheme();
    observer = new MutationObserver(() => {
      const theme = getMermaidTheme();
      if (theme === lastTheme) return;
      lastTheme = theme;
      listeners.forEach((fn) => fn(theme));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && observer) {
      observer.disconnect();
      observer = null;
      lastTheme = null;
    }
  };
}
