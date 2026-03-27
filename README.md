# Milkdown Editor

A Typora-like WYSIWYG Markdown editor built with [Milkdown](https://milkdown.dev/) and [Tauri v2](https://v2.tauri.app/).

## Features

* **WYSIWYG Editing** — Real-time Markdown rendering powered by Milkdown (ProseMirror)

* **MathLive Formulas** — Interactive visual math editing with `$...$` and `$$...$$`, toggle to LaTeX source

* **PlantUML Diagrams** — Live SVG rendering via configurable PlantUML server, right-click to copy as SVG/PNG

* **Code Blocks** — CodeMirror 6 with syntax highlighting for 100+ languages

* **Table Editing** — Interactive table creation and editing

* **File Management** — Open files/folders, save, auto-save (2s debounce)

* **Export** — Export to HTML (with embedded styles) or PDF (via print)

* **Themes** — Light and dark mode with smooth transitions

* **Source Mode** — Toggle between WYSIWYG and raw Markdown source

* **i18n** — English and Chinese, auto-detects system language, extensible

* **Cross-platform** — Windows, macOS, Linux (x86\_64 & ARM64)

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
| Diagrams  | [PlantUML](https://plantuml.com/) (server-side rendering) |
| Desktop   | [Tauri v2](https://v2.tauri.app/)                         |
| Frontend  | TypeScript + Vite                                         |
| Backend   | Rust                                                      |

## License

MIT
