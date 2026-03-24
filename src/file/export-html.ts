import { marked, type Tokens } from 'marked';
import hljs from 'highlight.js';
import plantumlEncoder from 'plantuml-encoder';
import { getPlantUMLServer } from '../editor/plugins/plantuml-plugin';

// Configure marked with custom renderer for syntax highlighting and PlantUML
marked.use({
  renderer: {
    code({ text, lang }: Tokens.Code): string {
      if (lang === 'plantuml') {
        const encoded = plantumlEncoder.encode(text);
        const server = getPlantUMLServer();
        return `<div class="plantuml-diagram"><img src="${server}/svg/${encoded}" alt="PlantUML diagram" style="max-width:100%;" /></div>\n`;
      }
      let highlighted: string;
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(text, { language: lang }).value;
      } else {
        highlighted = hljs.highlightAuto(text).value;
      }
      return `<pre><code class="hljs language-${escapeAttr(lang || '')}">${highlighted}</code></pre>\n`;
    },
  },
});

export async function exportHTML(
  markdown: string,
  theme: 'light' | 'dark',
  title: string,
): Promise<void> {
  // Convert markdown to HTML (math formulas $..$ and $$...$$ are preserved as-is by marked)
  const htmlContent = marked(markdown) as string;

  const hljsCSS = getHighlightCSS(theme);
  const html = buildHTMLDocument(htmlContent, title, theme, hljsCSS);

  // Save
  if ('__TAURI_INTERNALS__' in window) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({
      defaultPath: title.replace(/\.md$/, '') + '.html',
      filters: [{ name: 'HTML', extensions: ['html'] }],
    });
    if (path) await writeTextFile(path, html);
  } else {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/\.md$/, '') + '.html';
    a.click();
    URL.revokeObjectURL(url);
  }
}

export function markdownToHTML(markdown: string): string {
  return marked(markdown) as string;
}

export function getHighlightCSS(theme: 'light' | 'dark'): string {
  if (theme === 'dark') {
    return `
      .hljs { color: #c9d1d9; background: #2d2d2d; }
      .hljs-keyword, .hljs-selector-tag { color: #ff7b72; }
      .hljs-string, .hljs-attr { color: #a5d6ff; }
      .hljs-comment { color: #8b949e; font-style: italic; }
      .hljs-number { color: #79c0ff; }
      .hljs-function .hljs-title, .hljs-title.function_ { color: #d2a8ff; }
      .hljs-built_in { color: #ffa657; }
      .hljs-type, .hljs-title.class_ { color: #7ee787; }
      .hljs-literal { color: #79c0ff; }
      .hljs-meta { color: #8b949e; }
      .hljs-params { color: #c9d1d9; }
      .hljs-variable { color: #ffa657; }
      .hljs-regexp { color: #a5d6ff; }
      .hljs-symbol { color: #79c0ff; }
      .hljs-deletion { color: #ffa198; background: rgba(248, 81, 73, 0.15); }
      .hljs-addition { color: #7ee787; background: rgba(46, 160, 67, 0.15); }`;
  }
  return `
      .hljs { color: #24292e; background: #f6f8fa; }
      .hljs-keyword, .hljs-selector-tag { color: #d73a49; }
      .hljs-string, .hljs-attr { color: #032f62; }
      .hljs-comment { color: #6a737d; font-style: italic; }
      .hljs-number { color: #005cc5; }
      .hljs-function .hljs-title, .hljs-title.function_ { color: #6f42c1; }
      .hljs-built_in { color: #e36209; }
      .hljs-type, .hljs-title.class_ { color: #22863a; }
      .hljs-literal { color: #005cc5; }
      .hljs-meta { color: #6a737d; }
      .hljs-params { color: #24292e; }
      .hljs-variable { color: #e36209; }
      .hljs-regexp { color: #032f62; }
      .hljs-symbol { color: #005cc5; }
      .hljs-deletion { color: #b31d28; background: #ffeef0; }
      .hljs-addition { color: #22863a; background: #f0fff4; }`;
}

export function buildHTMLDocument(
  content: string,
  title: string,
  theme: 'light' | 'dark',
  hljsCSS: string,
): string {
  const isDark = theme === 'dark';
  const bg = isDark ? '#1e1e1e' : '#ffffff';
  const text = isDark ? '#d4d4d4' : '#24292e';
  const textSecondary = isDark ? '#a0a0a0' : '#586069';
  const border = isDark ? '#333333' : '#e1e4e8';
  const codeBg = isDark ? '#2d2d2d' : '#f6f8fa';
  const codeText = isDark ? '#d4d4d4' : '#24292e';
  const accent = isDark ? '#569cd6' : '#0366d6';
  const blockquoteBorder = isDark ? '#444444' : '#dfe2e5';
  const tableBg = isDark ? '#252525' : '#f6f8fa';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: ${bg};
      color: ${text};
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    /* Headings */
    h1 { font-size: 2em; margin: 0.67em 0; padding-bottom: 0.3em; border-bottom: 1px solid ${border}; }
    h2 { font-size: 1.5em; margin: 0.83em 0; padding-bottom: 0.3em; border-bottom: 1px solid ${border}; }
    h3 { font-size: 1.25em; margin: 1em 0; }
    h4 { font-size: 1em; margin: 1em 0; }
    h5 { font-size: 0.875em; margin: 1em 0; }
    h6 { font-size: 0.85em; margin: 1em 0; color: ${textSecondary}; }
    /* Paragraphs & inline */
    p { margin: 1em 0; }
    a { color: ${accent}; text-decoration: none; }
    a:hover { text-decoration: underline; }
    strong { font-weight: 600; }
    /* Code */
    code {
      background: ${codeBg};
      color: ${codeText};
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.85em;
    }
    pre {
      background: ${codeBg};
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1em 0;
      line-height: 1.45;
    }
    pre code {
      background: none;
      padding: 0;
      border-radius: 0;
      font-size: 0.85em;
    }
    /* Highlight.js theme */
    ${hljsCSS}
    /* Blockquote */
    blockquote {
      border-left: 4px solid ${blockquoteBorder};
      padding: 0.5em 1em;
      color: ${textSecondary};
      margin: 1em 0;
    }
    blockquote > p:first-child { margin-top: 0; }
    blockquote > p:last-child { margin-bottom: 0; }
    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      overflow-x: auto;
      display: block;
    }
    th, td {
      border: 1px solid ${border};
      padding: 8px 12px;
      text-align: left;
    }
    th { background: ${tableBg}; font-weight: 600; }
    /* Lists */
    ul, ol { padding-left: 2em; margin: 1em 0; }
    li { margin: 0.25em 0; }
    li > p { margin: 0.5em 0; }
    /* Task lists */
    li input[type="checkbox"] { margin-right: 0.5em; }
    /* Horizontal rule */
    hr { border: none; border-top: 1px solid ${border}; margin: 2em 0; }
    /* Images */
    img, svg { max-width: 100%; height: auto; }
    /* PlantUML */
    .plantuml-diagram { text-align: center; margin: 1em 0; }
    /* Math (preserved as-is) */
    .math-inline, .math-block { font-family: 'KaTeX_Main', 'Times New Roman', serif; }
    /* Definition lists */
    dt { font-weight: 600; margin-top: 1em; }
    dd { margin-left: 2em; }
    /* Keyboard */
    kbd {
      background: ${codeBg};
      border: 1px solid ${border};
      border-radius: 3px;
      padding: 0.1em 0.4em;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 0.85em;
    }
    /* Footnotes */
    .footnotes { border-top: 1px solid ${border}; margin-top: 2em; padding-top: 1em; font-size: 0.9em; }
    /* Print styles */
    @media print {
      body { max-width: none; padding: 0; }
      pre { white-space: pre-wrap; word-wrap: break-word; }
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
