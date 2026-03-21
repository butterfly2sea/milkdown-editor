export function exportHTML(
  editorRoot: HTMLElement,
  theme: 'light' | 'dark',
  title: string,
): void {
  // Clone editor content DOM
  const contentClone = editorRoot.cloneNode(true) as HTMLElement;

  // Remove any UI elements that shouldn't be in export
  contentClone.querySelectorAll('.math-toggle-btn, .plantuml-editor, .plantuml-label').forEach(
    (el) => el.remove(),
  );

  // Get computed theme values
  const computedStyle = getComputedStyle(document.documentElement);
  const cssVars = [
    'bg-primary', 'text-primary', 'text-secondary', 'text-muted',
    'border-color', 'code-bg', 'code-text', 'accent',
  ];

  const resolvedVars = cssVars
    .map((v) => `--${v}: ${computedStyle.getPropertyValue(`--${v}`).trim()};`)
    .join('\n    ');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      ${resolvedVars}
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    h1 { font-size: 2em; margin: 0.67em 0; }
    h2 { font-size: 1.5em; margin: 0.83em 0; }
    h3 { font-size: 1.17em; margin: 1em 0; }
    p { margin: 1em 0; }
    a { color: var(--accent); }
    code {
      background: var(--code-bg);
      color: var(--code-text);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }
    pre {
      background: var(--code-bg);
      color: var(--code-text);
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid var(--border-color);
      padding-left: 16px;
      color: var(--text-secondary);
      margin: 1em 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      text-align: left;
    }
    th { background: var(--code-bg); }
    img, svg { max-width: 100%; height: auto; }
    ul, ol { padding-left: 2em; margin: 1em 0; }
    li { margin: 0.25em 0; }
    hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }
    .math-wrapper { text-align: center; margin: 1em 0; }
    .plantuml-preview { text-align: center; margin: 1em 0; }
  </style>
</head>
<body>
${contentClone.innerHTML}
</body>
</html>`;

  // Download
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = title.replace(/\.md$/, '') + '.html';
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
