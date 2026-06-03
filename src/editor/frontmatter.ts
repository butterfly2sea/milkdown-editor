// Frontmatter card: detects YAML frontmatter at the top of a markdown document
// and renders it as a compact, collapsible badge above the editor body.
// Implementation reference: github.com/remarkjs/remark-frontmatter (we don't depend
// on it — the parsing surface here only covers the skill-metadata subset).

import { i18n } from '../i18n';

const FENCE_RE = /^---\s*$/;
const KEY_RE = /^([A-Za-z_][\w-]*):\s*(.*)$/;
const KNOWN_TYPES = ['user', 'feedback', 'project', 'reference'] as const;

export interface FrontmatterSplit {
  yaml: string | null;
  body: string;
}

interface ParsedYaml {
  valid: boolean;
  name?: string;
  description?: string;
  metadataType?: string;
  /** Original parsed lines, preserved for round-trip of unknown fields. */
  raw: string;
}

/** Split a markdown string at the top frontmatter fence. */
export function splitFrontmatter(md: string): FrontmatterSplit {
  if (!md.startsWith('---')) return { yaml: null, body: md };
  const lines = md.split('\n');
  if (!FENCE_RE.test(lines[0] ?? '')) return { yaml: null, body: md };
  for (let i = 1; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i] ?? '')) {
      const yaml = lines.slice(1, i).join('\n');
      // Skip the closing fence; also eat one optional blank line after it
      let bodyStart = i + 1;
      if (lines[bodyStart] === '') bodyStart += 1;
      const body = lines.slice(bodyStart).join('\n');
      return { yaml, body };
    }
  }
  // No closing fence — not a frontmatter block
  return { yaml: null, body: md };
}

/** Re-attach yaml + body. yaml=null returns body unchanged. */
export function composeFrontmatter(yaml: string | null, body: string): string {
  if (yaml === null) return body;
  return `---\n${yaml}\n---\n\n${body}`;
}

function stripQuotes(s: string): string {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Parse the skill-relevant subset of YAML: top-level scalars and one
 *  nested `metadata:` map. Anything outside that surface flips valid=false. */
function parseYaml(yaml: string): ParsedYaml {
  const out: ParsedYaml = { valid: true, raw: yaml };
  const lines = yaml.split('\n');
  let inMetadata = false;
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    // Indented (2 spaces) line — must be inside a known parent map
    if (line.startsWith('  ')) {
      if (!inMetadata) { out.valid = false; continue; }
      const m = KEY_RE.exec(line.slice(2));
      if (!m) { out.valid = false; continue; }
      const [, key, rawVal] = m;
      if (key === 'type') out.metadataType = stripQuotes(rawVal);
      continue;
    }
    inMetadata = false;
    const m = KEY_RE.exec(line);
    if (!m) { out.valid = false; continue; }
    const [, key, rawVal] = m;
    if (rawVal.trim() === '') {
      if (key === 'metadata') inMetadata = true;
      else { /* unknown empty-value parent — preserve via raw */ }
      continue;
    }
    if (key === 'name') out.name = stripQuotes(rawVal);
    else if (key === 'description') out.description = stripQuotes(rawVal);
  }
  return out;
}

function needsQuoting(s: string): boolean {
  return /[:#&*!|>'"%@`,\[\]{}]/.test(s) || /^\s|\s$/.test(s);
}

function emitScalar(s: string): string {
  return needsQuoting(s) ? JSON.stringify(s) : s;
}

/** Merge edited known fields back into the raw YAML, preserving unknown keys
 *  and original line order/formatting where possible. */
function serializeYaml(parsed: ParsedYaml, edits: Partial<{ name: string; description: string; metadataType: string }>): string {
  const next = {
    name: edits.name !== undefined ? edits.name : parsed.name,
    description: edits.description !== undefined ? edits.description : parsed.description,
    metadataType: edits.metadataType !== undefined ? edits.metadataType : parsed.metadataType,
  };
  const lines = parsed.raw.split('\n');
  const out: string[] = [];
  let inMetadata = false;
  let touched = { name: false, description: false, type: false };
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) { out.push(line); continue; }
    if (line.startsWith('  ')) {
      const m = KEY_RE.exec(line.slice(2));
      if (m && inMetadata && m[1] === 'type' && next.metadataType !== undefined) {
        out.push(`  type: ${emitScalar(next.metadataType)}`);
        touched.type = true;
      } else {
        out.push(line);
      }
      continue;
    }
    inMetadata = false;
    const m = KEY_RE.exec(line);
    if (!m) { out.push(line); continue; }
    const [, key, rawVal] = m;
    if (key === 'name' && next.name !== undefined) {
      out.push(`name: ${emitScalar(next.name)}`); touched.name = true;
    } else if (key === 'description' && next.description !== undefined) {
      out.push(`description: ${emitScalar(next.description)}`); touched.description = true;
    } else {
      out.push(line);
      if (key === 'metadata' && rawVal.trim() === '') inMetadata = true;
    }
  }
  // Append any known field that wasn't present in the original
  if (!touched.name && next.name !== undefined && next.name !== '') {
    out.unshift(`name: ${emitScalar(next.name)}`);
  }
  if (!touched.description && next.description !== undefined && next.description !== '') {
    const insertAt = touched.name ? 1 : 0;
    out.splice(insertAt, 0, `description: ${emitScalar(next.description)}`);
  }
  if (!touched.type && next.metadataType !== undefined && next.metadataType !== '') {
    out.push('metadata:', `  type: ${emitScalar(next.metadataType)}`);
  }
  return out.join('\n');
}

export interface FrontmatterCard {
  /** Mount the card as the first child of `parent`. Idempotent. */
  mount(parent: HTMLElement): void;
  /** Replace the displayed YAML. Pass null to hide the card. */
  setYaml(yaml: string | null): void;
  /** Get the current YAML (with edits applied), or null if no frontmatter. */
  getYaml(): string | null;
  /** Fires on any user edit committed through the card. */
  onChange(cb: () => void): void;
  destroy(): void;
}

export function createFrontmatterCard(): FrontmatterCard {
  let currentYaml: string | null = null;
  let parsed: ParsedYaml | null = null;
  let expanded = false;
  let rawMode = false;
  const listeners: Array<() => void> = [];

  const root = document.createElement('div');
  root.className = 'frontmatter-card';
  root.style.display = 'none';

  const emit = () => { for (const cb of listeners) cb(); };

  function render() {
    root.innerHTML = '';
    if (currentYaml === null) { root.style.display = 'none'; return; }
    root.style.display = '';
    root.dataset.expanded = expanded ? 'true' : 'false';
    if (expanded) renderExpanded();
    else renderCompact();
  }

  function renderCompact() {
    const header = document.createElement('div');
    header.className = 'frontmatter-card__compact';

    const title = document.createElement('span');
    title.className = 'frontmatter-card__title';
    title.textContent = parsed?.name || i18n.t.frontmatterUntitled;

    const badge = document.createElement('span');
    badge.className = 'frontmatter-card__badge';
    if (parsed?.metadataType) {
      badge.textContent = parsed.metadataType;
      badge.dataset.type = parsed.metadataType;
    } else {
      badge.style.display = 'none';
    }

    const chevron = document.createElement('span');
    chevron.className = 'frontmatter-card__chevron';
    chevron.textContent = '▾'; // ▾

    const top = document.createElement('div');
    top.className = 'frontmatter-card__top';
    top.append(title, badge, chevron);

    const desc = document.createElement('div');
    desc.className = 'frontmatter-card__desc';
    desc.textContent = parsed?.description || '';
    if (!parsed?.description) desc.style.display = 'none';

    header.append(top, desc);
    header.addEventListener('click', () => { expanded = true; render(); });
    root.appendChild(header);
  }

  function renderExpanded() {
    const head = document.createElement('div');
    head.className = 'frontmatter-card__head';
    const headTitle = document.createElement('span');
    headTitle.textContent = i18n.t.frontmatterTitle;
    headTitle.className = 'frontmatter-card__head-title';

    const rawBtn = document.createElement('button');
    rawBtn.type = 'button';
    rawBtn.className = 'frontmatter-card__raw-btn';
    rawBtn.textContent = rawMode ? i18n.t.frontmatterStructured : i18n.t.frontmatterRaw;
    rawBtn.addEventListener('click', () => { rawMode = !rawMode; render(); });

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'frontmatter-card__collapse-btn';
    collapseBtn.textContent = '▴'; // ▴
    collapseBtn.title = i18n.t.frontmatterCollapse;
    collapseBtn.addEventListener('click', () => { expanded = false; render(); });

    head.append(headTitle, rawBtn, collapseBtn);
    root.appendChild(head);

    const body = document.createElement('div');
    body.className = 'frontmatter-card__body';
    if (rawMode || !parsed?.valid) renderRawForm(body);
    else renderStructuredForm(body);
    root.appendChild(body);

    if (!parsed?.valid && !rawMode) {
      const warn = document.createElement('div');
      warn.className = 'frontmatter-card__warn';
      warn.textContent = i18n.t.frontmatterInvalidWarn;
      root.appendChild(warn);
    }
  }

  function renderStructuredForm(body: HTMLElement) {
    body.append(
      labeledInput('name', parsed?.name ?? '', i18n.t.frontmatterName, (v) => {
        currentYaml = serializeYaml(parsed!, { name: v });
        parsed = parseYaml(currentYaml);
        emit();
      }),
      labeledInput('description', parsed?.description ?? '', i18n.t.frontmatterDescription, (v) => {
        currentYaml = serializeYaml(parsed!, { description: v });
        parsed = parseYaml(currentYaml);
        emit();
      }, true),
      labeledSelect('type', parsed?.metadataType ?? '', i18n.t.frontmatterType, KNOWN_TYPES, (v) => {
        currentYaml = serializeYaml(parsed!, { metadataType: v });
        parsed = parseYaml(currentYaml);
        emit();
      }),
    );
  }

  function renderRawForm(body: HTMLElement) {
    const label = document.createElement('label');
    label.className = 'frontmatter-card__label';
    label.textContent = 'YAML';
    const ta = document.createElement('textarea');
    ta.className = 'frontmatter-card__textarea';
    ta.value = currentYaml ?? '';
    ta.rows = Math.min(12, Math.max(3, (currentYaml ?? '').split('\n').length + 1));
    ta.addEventListener('input', () => {
      currentYaml = ta.value;
      parsed = parseYaml(currentYaml);
      emit();
    });
    body.append(label, ta);
  }

  function labeledInput(name: string, value: string, label: string, onCommit: (v: string) => void, multiline = false): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'frontmatter-card__field';
    const lbl = document.createElement('label');
    lbl.className = 'frontmatter-card__label';
    lbl.textContent = label;
    const input = multiline
      ? document.createElement('textarea')
      : document.createElement('input');
    input.className = 'frontmatter-card__input';
    if (input instanceof HTMLTextAreaElement) input.rows = 2;
    else (input as HTMLInputElement).type = 'text';
    (input as HTMLInputElement | HTMLTextAreaElement).value = value;
    input.dataset.name = name;
    input.addEventListener('input', () => {
      onCommit((input as HTMLInputElement | HTMLTextAreaElement).value);
    });
    wrap.append(lbl, input);
    return wrap;
  }

  function labeledSelect(name: string, value: string, label: string, options: readonly string[], onCommit: (v: string) => void): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'frontmatter-card__field';
    const lbl = document.createElement('label');
    lbl.className = 'frontmatter-card__label';
    lbl.textContent = label;
    const select = document.createElement('select');
    select.className = 'frontmatter-card__select';
    select.dataset.name = name;
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = '—'; // —
    select.appendChild(blank);
    let matched = false;
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      if (opt === value) { o.selected = true; matched = true; }
      select.appendChild(o);
    }
    if (!matched && value) {
      const o = document.createElement('option');
      o.value = value; o.textContent = value; o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener('change', () => onCommit(select.value));
    wrap.append(lbl, select);
    return wrap;
  }

  return {
    mount(parent: HTMLElement) {
      if (root.parentElement === parent) return;
      parent.insertBefore(root, parent.firstChild);
    },
    setYaml(yaml: string | null) {
      currentYaml = yaml;
      parsed = yaml === null ? null : parseYaml(yaml);
      // Reset to compact on document switch so the user sees the summary first
      expanded = false;
      rawMode = false;
      render();
    },
    getYaml() { return currentYaml; },
    onChange(cb) { listeners.push(cb); },
    destroy() {
      listeners.length = 0;
      root.remove();
    },
  };
}
