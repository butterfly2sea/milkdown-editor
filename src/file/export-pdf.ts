export async function exportPDF(
  editorRoot: HTMLElement,
  theme: 'light' | 'dark',
  title: string,
): Promise<void> {
  // Get computed theme values
  const computedStyle = getComputedStyle(document.documentElement);
  const cssVars = [
    'bg-primary', 'text-primary', 'text-secondary', 'text-muted',
    'border-color', 'code-bg', 'code-text', 'accent',
  ];

  const resolvedVars = cssVars
    .map((v) => `--${v}: ${computedStyle.getPropertyValue(`--${v}`).trim()};`)
    .join('\n    ');

  // Clone content
  const contentClone = editorRoot.cloneNode(true) as HTMLElement;
  contentClone.querySelectorAll('.math-toggle-btn, .plantuml-editor, .plantuml-label').forEach(
    (el) => el.remove(),
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    :root { ${resolvedVars} }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--text-primary);
      line-height: 1.6;
      padding: 0;
    }
    h1 { font-size: 2em; margin: 0.67em 0; }
    h2 { font-size: 1.5em; margin: 0.83em 0; }
    h3 { font-size: 1.17em; margin: 1em 0; }
    p { margin: 1em 0; }
    code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }
    pre {
      background: var(--code-bg);
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1em 0;
      break-inside: avoid;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid var(--border-color);
      padding-left: 16px;
      color: var(--text-secondary);
    }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; break-inside: avoid; }
    th, td { border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; }
    th { background: var(--code-bg); }
    img, svg { max-width: 100%; height: auto; }
    ul, ol { padding-left: 2em; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${contentClone.innerHTML}</body>
</html>`;

  if ('__TAURI_INTERNALS__' in window) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const defaultName = title.replace(/\.md$/, '') + '.pdf.html';
    const path = await save({
      defaultPath: defaultName,
      filters: [
        { name: 'HTML (print to PDF)', extensions: ['html'] },
      ],
    });
    if (path) {
      await writeTextFile(path, html);
    }
  } else {
    // Browser fallback: use iframe print
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position: fixed; top: -10000px; left: -10000px; width: 800px; height: 600px;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      iframe.remove();
      return;
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Wait for content to load, then print
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        // Remove iframe after a delay to allow print dialog
        setTimeout(() => iframe.remove(), 1000);
      }, 250);
    };
  }
}
