# Milkdown Editor

[English](README.md) | [中文](README.zh.md)

一款类 Typora 的所见即所得 Markdown 编辑器，基于 [Milkdown](https://milkdown.dev/) 与 [Tauri v2](https://v2.tauri.app/) 构建。

## 功能特性

* **所见即所得编辑** — 基于 Milkdown（ProseMirror）的实时 Markdown 渲染

* **MathLive 公式** — 可视化交互式数学公式编辑，支持 `$...$` 与 `$$...$$`，可切换 LaTeX 源码

* **PlantUML 图表** — 通过可配置的 PlantUML 服务器实时渲染 SVG，右键可复制为 SVG/PNG

* **Mermaid 图表** — 用 `mermaid` 代码块渲染流程图、时序图、类图等

* **代码块** — CodeMirror 6，支持 100+ 语言语法高亮

* **表格编辑** — 交互式表格创建与编辑

* **查找替换** — 支持正则、区分大小写、全词匹配，替换支持捕获分组；所见即所得与源码模式下均可用

* **多光标** — `Alt`+点击加光标、`Alt`+拖拽块选择、`Alt+J` 累加选中下一处出现

* **高亮** — `==高亮==` 标记，可从选中悬浮工具栏切换（纯 Markdown，不含 HTML）

* **编辑区缩放** — `Ctrl`+滚轮 或 `Ctrl`+`]` / `[` / `0` 缩放正文

* **灵活的图片存储** — 每篇文档可选 Base64、在线 URL 或 `<文件名>.assets/` 相对路径

* **文件管理** — 打开文件/文件夹、保存、可配置的自动保存

* **导出** — 导出 HTML（内嵌样式）或 PDF（通过打印）

* **主题** — 明暗主题，平滑过渡

* **源码模式** — 在所见即所得与 CodeMirror 6 的 Markdown 源码编辑器之间切换

* **国际化** — 中英文，自动检测系统语言，可扩展

* **跨平台** — Windows、macOS、Linux（x86\_64 与 ARM64）

## 使用说明

### 编辑

边输入边渲染：`# `…`###### ` 生成标题，`- ` / `1. ` / `- [ ] ` 生成列表，`> ` 生成引用，`` `代码` ``、`**加粗**`、`*斜体*`、`~~删除线~~`、`==高亮==`，`---` 生成分割线。

* **斜杠菜单** — 输入 `/` 插入块（标题、列表、代码块、表格、图片、公式、引用、分割线……）。
* **块拖拽手柄** — 鼠标移到块左侧，可拖动重排或打开该块的操作。
* **选中工具栏** — 选中文字后可加粗 / 斜体 / **高亮** / 删除线 / 行内代码 / 链接，以及复制 / 剪切 / 粘贴。

### 高亮

输入 `==文字==`，或选中文字后点击悬浮工具栏里的高亮按钮。以纯 Markdown `==文字==` 保存，不写入任何 HTML。

### 查找替换

* `Ctrl+F` 打开查找，`Ctrl+H` 打开查找替换。
* 开关：**Aa** 区分大小写、**ab** 全词匹配、**`.*`** 正则表达式。
* 正则模式下，替换支持捕获分组（`$1`、`$2`、`$&`）。
* `Enter` / `Shift+Enter` 跳到下一个 / 上一个匹配。查找栏固定悬浮在右上角。
* 所见即所得模式与源码模式下行为一致。

### 多光标

所见即所得正文、源码模式、代码块内部三处均可用：

* `Alt`+点击新增一个光标（再点一次已有光标则移除）。
* `Alt`+拖拽或 `Shift+Alt`+拖拽做块选择——每一行生成一个选区。
* `Alt+J` 累加选中下一处出现，`Shift+Alt+J` 向前。未选中内容时，第一次按下会选中光标所在的单词；随后直接输入即可一次性替换所有已选中处。
* 输入、`Backspace`、`Delete` 和粘贴纯文本会作用于所有光标。`Esc`、`Enter`、方向键或普通点击都会收敛回单光标。

> Linux 上 GNOME 与 KDE 默认把 `Alt`+拖拽绑定为「移动窗口」。如果块选择没有反应，请在桌面环境设置里改掉或关闭该绑定。

### 数学公式

输入 `$行内$` 或 `$$块级$$` 公式。点击公式可用 MathLive 可视化编辑，并切换到 LaTeX 源码。

### 图表

* **Mermaid** — 写一个 `mermaid` 代码块即可渲染流程图、时序图、类图等。
* **PlantUML** — 写一个 `plantuml` 代码块；需先在**设置**里配置 PlantUML 服务器。右键图表可复制为 SVG/PNG，或全屏查看（滚轮缩放）。

### 代码块与表格

* 代码块使用 CodeMirror 6，带语言选择器，支持 100+ 语言高亮。
* 从斜杠菜单插入表格；用表格内的控件增删行列。

### 缩放

只缩放编辑区正文，工具栏和状态栏保持原始大小：

* `Ctrl`+滚轮，或 `Ctrl+]` / `Ctrl+[` 放大 / 缩小，`Ctrl+0` 恢复。缩放级别会被记住并显示在状态栏。

### 图片

从**编辑 → 图片存储**为每篇文档选择存储模式。本地图片模式需先保存文档，Base64 模式也可用于未保存的文档。

* **粘贴或拖入图片** → 按本文档当前的图片存储模式写入，插入后可立即调整尺寸和标注。
* **切换图片存储模式** — 可嵌入为 Base64、复制到 `<文件名>.assets/`，或保留已有在线 URL；切换 Base64 / 本地图片模式会立即转换已有引用。
* **在线 URL 模式**只保留已有网络地址。新粘贴的本地图片需要上传服务；未配置上传服务时编辑器不会修改文档，并显示提示。
* **直接转换为本地资源** — 按 `Ctrl+Alt+I`，把网络图片下载、嵌入图片解码到资源文件夹，并改写为相对路径。

本地图片通过 Tauri 的 asset 协议显示，Markdown 保持便于迁移的相对路径。（仅桌面版应用。）

### 文件

* `Ctrl+O` 打开、`Ctrl+N` 新建、`Ctrl+S` 保存、`Ctrl+Shift+S` 另存为。
* **拖入 `.md` 文件**到窗口即可打开；**拖入文件夹**会在侧边栏以文件树打开。
* 停止输入后自动保存。可在**设置 → 编辑器**中关闭，或调整延时（2 / 5 / 10 / 30 / 60 秒，默认 2 秒）；`Ctrl+S` 手动保存不受此开关影响。
* **文件 → 打开文件所在文件夹**：在系统文件管理器中打开当前文档所在目录，并选中该文件（资源管理器 / 访达 / Linux 文件管理器）。
* **同一文档只在一个窗口打开** — 可以同时开多个窗口，但已经打开的文档不会再打开第二份；再次打开它只会把持有它的窗口切到前台，避免两份副本各自自动保存、互相覆盖。

### 侧边栏 · 源码模式 · 导出 · 主题 · 语言

* `Ctrl+\` 切换侧边栏（文件树 + 文档大纲）。文件树 tab 只在打开文件夹后才出现。
* 状态栏的 **`</>`** 按钮在所见即所得与 Markdown 源码之间切换。源码模式是完整的 CodeMirror 6 编辑器，带 Markdown 高亮、撤销历史、查找替换与多光标。
* **导出**按钮导出为内嵌样式的 HTML；`Ctrl+Shift+E` 打开导出菜单。
* `Ctrl+/` 或太阳/月亮按钮切换明暗主题；**EN/ZH** 按钮切换语言。

### 快捷键

| 操作 | 快捷键 |
| ---- | ------ |
| 保存 / 另存为 | `Ctrl+S` / `Ctrl+Shift+S` |
| 打开 / 新建 | `Ctrl+O` / `Ctrl+N` |
| 查找 / 替换 | `Ctrl+F` / `Ctrl+H` |
| 新增光标 | `Alt`+点击 |
| 块选择 | `Alt`+拖拽 / `Shift+Alt`+拖拽 |
| 累加选中下一处 / 上一处 | `Alt+J` / `Shift+Alt+J` |
| 一级至六级标题 | `Ctrl+1` … `Ctrl+6` |
| 转换为正文 | `Ctrl+Alt+0` |
| 加粗 / 斜体 | `Ctrl+B` / `Ctrl+I` |
| 高亮 / 删除线 | `Ctrl+Shift+H` / `Ctrl+Shift+X` |
| 行内代码 / 链接 | `Ctrl+Shift+K` / `Ctrl+K` |
| 放大 / 缩小 / 重置 | `Ctrl+]` / `Ctrl+[` / `Ctrl+0`（或 `Ctrl`+滚轮） |
| 本地化图片 | `Ctrl+Alt+I` |
| 侧边栏 / 主题 | `Ctrl+\` / `Ctrl+/` |
| 导出菜单 | `Ctrl+Shift+E` |

## 开发

### 环境要求

* [Node.js](https://nodejs.org/)（v20+）

* [Rust](https://rustup.rs/)（stable）

* Linux：`sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### 安装与运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 生产构建
npm run tauri build
```

## 构建与发布

### 本地构建

```bash
npm run tauri build
```

产物位于 `src-tauri/target/release/bundle/`。

### CI/CD 发布

推送版本标签即可触发所有平台的自动构建：

```bash
# 更新 package.json 与 src-tauri/tauri.conf.json 中的版本号
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions 会构建并发布安装包到 GitHub Releases：

| 平台 | 架构 | 格式 |
| ---- | ---- | ---- |
| Windows | x64 | `.msi`、`.exe` |
| Windows | ARM64 | `.msi`、`.exe` |
| macOS | x64 | `.dmg` |
| macOS | ARM64 | `.dmg` |
| Linux | x64 | `.deb`、`.AppImage` |

## 技术栈

| 组成 | 技术 |
| ---- | ---- |
| 编辑器 | [Milkdown](https://milkdown.dev/)（ProseMirror） |
| 代码 | [CodeMirror 6](https://codemirror.net/) |
| 数学 | [MathLive](https://mathlive.io/) |
| 图表 | [PlantUML](https://plantuml.com/)（服务端渲染）+ [Mermaid](https://mermaid.js.org/) |
| 桌面 | [Tauri v2](https://v2.tauri.app/) |
| 前端 | TypeScript + Vite |
| 后端 | Rust |

## 许可证

MIT
