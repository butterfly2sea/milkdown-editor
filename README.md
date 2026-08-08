# Milkdown Editor

[English](README.md) | [中文](README.zh.md)

A Typora-like WYSIWYG Markdown editor built with [Milkdown](https://milkdown.dev/) and [Tauri v2](https://v2.tauri.app/).

## Features

* **WYSIWYG Editing** — Real-time Markdown rendering powered by Milkdown (ProseMirror)

* **MathLive Formulas** — Interactive visual math editing with `$...$` and `$$...$$`, toggle to LaTeX source

* **PlantUML Diagrams** — Live SVG rendering via configurable PlantUML server, right-click to copy as SVG/PNG

* **Mermaid Diagrams** — Flowcharts, sequence, class, and other diagrams from `mermaid` fenced code blocks

* **Code Blocks** — CodeMirror 6 with syntax highlighting for 100+ languages

* **Table Editing** — Interactive table creation and editing

* **Find & Replace** — Regex, case-sensitive, and whole-word search with capture-group replacement, in both WYSIWYG and source mode

* **Multiple Cursors** — `Alt`+click, `Alt`+drag for column selection, and `Alt+J` to add the next occurrence

* **Highlight** — `==highlight==` marks, toggled from the selection toolbar (pure Markdown, no HTML)

* **Editor Zoom** — Zoom the editing area with `Ctrl`+scroll or `Ctrl`+`]` / `[` / `0`

* **Flexible Image Storage** — Keep images as Base64, online URLs, or relative files in a `<name>.assets/` folder

* **File Management** — Open files/folders, save, configurable auto-save

* **Export** — Export to HTML (with embedded styles) or PDF (via print)

* **Themes** — Light and dark mode with smooth transitions

* **Source Mode** — Toggle between WYSIWYG and a CodeMirror 6 raw Markdown editor

* **i18n** — English and Chinese, auto-detects system language, extensible

* **Cross-platform** — Windows, macOS, Linux (x86\_64 & ARM64)

## Usage

### Editing

Type Markdown and it renders as you go: `# `…`###### ` for headings, `- ` / `1. ` / `- [ ] ` for lists, `> ` for quotes, `` `code` ``, `**bold**`, `*italic*`, `~~strike~~`, `==highlight==`, and `---` for a divider.

* **Slash menu** — type `/` to insert blocks (heading, list, code block, table, image, math, quote, divider, …).
* **Block handle** — hover the left edge of a block to drag-reorder it or open its actions.
* **Selection toolbar** — select text for bold / italic / strikethrough / inline code / link / **highlight**, plus copy / cut / paste.

### Highlight

Type `==text==`, or select text and click the highlight button in the selection toolbar. Stored as pure Markdown `==text==` — no HTML is written to the file.

### Find & Replace

* `Ctrl+F` opens find, `Ctrl+H` opens find & replace.
* Toggles: **Aa** match case, **ab** whole word, **`.*`** regular expression.
* In regex mode, replacements support capture groups (`$1`, `$2`, `$&`).
* `Enter` / `Shift+Enter` jump to the next / previous match. The bar stays pinned to the top-right.
* Works the same in WYSIWYG and source mode.

### Multiple Cursors

Available in the WYSIWYG editor, in source mode, and inside code blocks:

* `Alt`+click adds a cursor (click an existing one again to remove it).
* `Alt`+drag or `Shift+Alt`+drag selects a block of lines — one selection per row.
* `Alt+J` adds the next occurrence of the selection, `Shift+Alt+J` the previous one. With nothing selected, the first press selects the word under the cursor. Then just type to replace every occurrence at once.
* Typing, `Backspace`, `Delete` and pasting plain text apply to every cursor. `Esc`, `Enter`, the arrow keys or a plain click collapse back to one.

> On Linux, GNOME and KDE grab `Alt`+drag to move windows by default. If block selection does nothing, remap or disable that binding in your desktop settings.

### Math

Write `$inline$` or `$$block$$` math. Click a formula to edit it visually (MathLive) and toggle to LaTeX source.

### Diagrams

* **Mermaid** — add a `mermaid` fenced code block to render flowcharts, sequence, class diagrams, and more.
* **PlantUML** — add a `plantuml` fenced code block; set the PlantUML server in **Settings** first. Right-click a diagram to copy it as SVG/PNG, or open it fullscreen (scroll to zoom).

### Code Blocks & Tables

* Fenced code blocks use CodeMirror 6 with a language selector and highlighting for 100+ languages.
* Insert a table from the slash menu; add or remove rows and columns with the in-table controls.

### Zoom

Zoom the editing area only — the toolbar and status bar stay at native size:

* `Ctrl`+scroll, or `Ctrl+]` / `Ctrl+[` to zoom in / out, and `Ctrl+0` to reset. The level is remembered across sessions and shown in the status bar.

### Images

Choose a storage mode for each document from **Edit → Image Storage**. Local assets require the document to be saved first; Base64 also works in unsaved documents.

* **Paste or drop an image** into the editor → it uses the current document's image storage mode and can be resized or captioned immediately.
* **Change image storage** — use **Edit → Image Storage** to embed images as Base64, copy them into `<filename>.assets/`, or keep existing online URLs. Switching Base64/local modes converts existing references immediately.
* **Online URL mode** preserves existing web URLs. Pasting a new local image in this mode requires an upload provider, so the editor keeps the document unchanged and shows a warning.
* **Convert to local assets directly** — press `Ctrl+Alt+I` to download remote images and decode embedded images into the assets folder.

Local images render through Tauri's asset protocol while Markdown keeps portable relative paths. (Desktop app only.)

### Files

* `Ctrl+O` open, `Ctrl+N` new, `Ctrl+S` save, `Ctrl+Shift+S` save as.
* **Drop a `.md` file** onto the window to open it; **drop a folder** to open it as a file tree in the sidebar.
* Auto-save runs after you stop typing. **Settings → Editor** turns it off or changes the delay (2 / 5 / 10 / 30 / 60 seconds, default 2). `Ctrl+S` always saves regardless.
* **File → Show in File Manager** opens the current document's folder with the file selected (Explorer / Finder / your Linux file manager).
* **One window per document** — you can run several windows at once, but a document that is already open somewhere will not open a second time. Opening it again brings the window that has it to the front instead, so two auto-saving copies can never overwrite each other.

### Opening `.md` files with Milkdown (macOS)

Select any `.md` file in Finder, press `Cmd+I`, pick **Milkdown Editor** under *Open with*, then click **Change All…**.

If the setting does not stick — the file still opens in your old editor — macOS is most likely resolving the association to a stale copy of the app. Keep exactly one copy in `/Applications`, delete any others (Downloads, an old build directory), then rebuild the LaunchServices database:

```bash
LSR=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
$LSR -kill -r -domain local -domain system -domain user
$LSR -f "/Applications/Milkdown Editor.app"
```

Then set the default app again with `Cmd+I`.

### Sidebar · Source Mode · Export · Theme · Language

* `Ctrl+\` toggles the sidebar (file tree + document outline). The file tree tab only appears once a folder is open.
* The **`</>`** button (status bar) switches between WYSIWYG and raw Markdown source. Source mode is a full CodeMirror 6 editor with Markdown highlighting, undo history, find & replace and multiple cursors.
* The **Export** button exports to HTML with embedded styles; `Ctrl+Shift+E` opens the export menu.
* `Ctrl+/` or the sun/moon button toggles light / dark theme; the **EN/ZH** button switches language.

### Keyboard Shortcuts

| Action                  | Shortcut                                          |
| ----------------------- | ------------------------------------------------- |
| Save / Save As          | `Ctrl+S` / `Ctrl+Shift+S`                         |
| Open / New file         | `Ctrl+O` / `Ctrl+N`                               |
| Find / Replace          | `Ctrl+F` / `Ctrl+H`                               |
| Add cursor              | `Alt`+click                                       |
| Column selection        | `Alt`+drag / `Shift+Alt`+drag                     |
| Select next / prev occurrence | `Alt+J` / `Shift+Alt+J`                     |
| Heading 1-6             | `Ctrl+1` ... `Ctrl+6`                             |
| Convert to body text    | `Ctrl+Alt+0`                                       |
| Bold / Italic           | `Ctrl+B` / `Ctrl+I`                               |
| Highlight / Strike      | `Ctrl+Shift+H` / `Ctrl+Shift+X`                   |
| Inline code / Link      | `Ctrl+Shift+K` / `Ctrl+K`                         |
| Zoom in / out / reset   | `Ctrl+]` / `Ctrl+[` / `Ctrl+0` (or `Ctrl`+scroll) |
| Localize images         | `Ctrl+Alt+I`                                      |
| Toggle sidebar / theme  | `Ctrl+\` / `Ctrl+/`                               |
| Export menu             | `Ctrl+Shift+E`                                    |

## Screenshots

<!-- Add screenshots here -->

## Development

### Prerequisites

* [Node.js](https://nodejs.org/) (v20+)

* [Rust](https://rustup.rs/) (stable)

* Linux: `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Project Structure

```
src/                        # Frontend (TypeScript)
├── main.ts                 # App entry point
├── editor/                 # Milkdown editor setup & plugins
│   ├── setup.ts            # Editor initialization
│   └── plugins/            # MathLive, PlantUML, custom plugins
├── file/                   # File operations & export
├── sidebar/                # File tree sidebar
├── titlebar/               # Title bar
├── statusbar/              # Status bar (word count, theme, export, language)
├── i18n/                   # Internationalization (en, zh)
├── styles/                 # Global CSS & theme overrides
└── theme/                  # Light/dark theme variables

src-tauri/                  # Backend (Rust)
├── src/lib.rs              # Tauri setup, native menu, IPC commands
├── tauri.conf.json         # App configuration
├── capabilities/           # Permission declarations
└── icons/                  # App icons (all sizes)
```

## Building

### Local Build

```bash
npm run tauri build
```

Output will be in `src-tauri/target/release/bundle/`.

### CI/CD Release

Push a version tag to trigger automated builds for all platforms:

```bash
# Update version in package.json and src-tauri/tauri.conf.json
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions will build and publish installers to GitHub Releases:

| Platform | Architecture | Format              |
| -------- | ------------ | ------------------- |
| Windows  | x64          | `.msi`, `.exe`      |
| Windows  | ARM64        | `.msi`, `.exe`      |
| macOS    | x64          | `.dmg`              |
| macOS    | ARM64        | `.dmg`              |
| Linux    | x64          | `.deb`, `.AppImage` |

## Adding a New Language

1. Add a new locale object in `src/i18n/locales.ts`:

   ```typescript
   export const ja: Locale = {
     untitled: '無題',
     // ... all keys
   };
   export const locales = { en, zh, ja };
   ```

2. Register it in `src/i18n/index.ts`:

   ```typescript
   get availableLanguages() {
     return [
       { code: 'en', label: 'English' },
       { code: 'zh', label: '中文' },
       { code: 'ja', label: '日本語' },
     ];
   }
   ```

3. Add a menu item in `src-tauri/src/lib.rs`:

   ```rust
   .item(&MenuItemBuilder::with_id("lang-ja", "日本語").build(app).unwrap())
   ```

4. Add the event listener in `src/main.ts`:

   ```typescript
   'menu-lang-ja': () => i18n.setLang('ja'),
   ```

## Tech Stack

| Component | Technology                                                |
| --------- | --------------------------------------------------------- |
| Editor    | [Milkdown](https://milkdown.dev/) (ProseMirror)           |
| Code      | [CodeMirror 6](https://codemirror.net/)                   |
| Math      | [MathLive](https://mathlive.io/)                          |
| Diagrams  | [PlantUML](https://plantuml.com/) (server-side) + [Mermaid](https://mermaid.js.org/) |
| Desktop   | [Tauri v2](https://v2.tauri.app/)                         |
| Frontend  | TypeScript + Vite                                         |
| Backend   | Rust                                                      |

## License

MIT
