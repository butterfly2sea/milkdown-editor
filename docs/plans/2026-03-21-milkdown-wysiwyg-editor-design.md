# Milkdown WYSIWYG Markdown Editor — 设计文档

> 对标 Typora 的所见即所得 Markdown 编辑器

## 1. 项目概述

基于 Milkdown（ProseMirror 内核）构建一个类 Typora 的所见即所得 Markdown 编辑器。使用纯 TypeScript 开发，无框架依赖。先以 Web 应用形态交付，架构上预留桌面化（Electron/Tauri）空间。

## 2. 技术栈

| 类别          | 选型                                                      |
| ----------- | ------------------------------------------------------- |
| 构建工具        | Vite + TypeScript                                       |
| 编辑器内核       | `@milkdown/kit`（core、prose、ctx）                         |
| Markdown 预设 | `@milkdown/preset-commonmark` + `@milkdown/preset-gfm`  |
| 代码高亮        | `@milkdown/plugin-prism` + Prism.js                     |
| 数学公式        | MathLive（`mathlive` Web Component）                      |
| 斜杠命令        | `@milkdown/plugin-slash`                                |
| 文件操作        | File System Access API（降级：`<input type="file">` + Blob） |
| 导出 PDF      | 浏览器原生 `window.print()`                                  |
| 主题          | CSS 变量驱动，浅色/深色                                          |

## 3. 项目结构

```
src/
├── main.ts            # 入口，初始化 App Shell
├── editor/
│   ├── setup.ts       # Milkdown 编辑器初始化与插件配置
│   ├── plugins/       # 自定义插件（语法隐藏、表格增强等）
│   │   ├── math-node-view.ts   # MathLive NodeView
│   │   ├── code-block-view.ts  # 代码块增强 NodeView
│   │   └── table-view.ts       # 表格增强 NodeView
│   └── keymap.ts      # 快捷键绑定
├── sidebar/
│   └── file-tree.ts   # 文件树组件
├── statusbar/
│   └── statusbar.ts   # 底部状态栏
├── file/
│   └── fs.ts          # 文件读写、导出逻辑
├── theme/
│   ├── light.css      # 浅色主题
│   ├── dark.css       # 深色主题
│   └── toggle.ts      # 主题切换逻辑
└── styles/
    └── global.css     # 全局样式、布局
```

## 4. 整体架构

```
┌─────────────────────────────────────────────┐
│                  App Shell                   │
│  ┌──────────┐  ┌──────────────────────────┐  │
│  │ Sidebar  │  │      Editor Area         │  │
│  │          │  │                          │  │
│  │ 文件树    │  │   Milkdown Editor        │  │
│  │ (可收起)  │  │   (ProseMirror 内核)      │  │
│  │          │  │                          │  │
│  │          │  │  插件层:                   │  │
│  │          │  │  - 语法即时渲染             │  │
│  │          │  │  - 代码高亮 (Prism)        │  │
│  │          │  │  - 表格编辑               │  │
│  │          │  │  - 数学公式 (MathLive)     │  │
│  │          │  │                          │  │
│  └──────────┘  └──────────────────────────┘  │
│  ┌──────────────────────────────────────────┐│
│  │           Status Bar (底部状态栏)         ││
│  │  字数统计 │ 行号 │ 主题切换 │ 导出按钮     ││
│  └──────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

## 5. 编辑器核心体验

### 5.1 Markdown 语法即时渲染

* Milkdown 基于 ProseMirror 的结构化编辑，输入 Markdown 语法后直接渲染为富文本节点

* 行内语法隐藏：加粗文字不显示 `**`，光标聚焦到节点时才展示标记符号（通过自定义 ProseMirror decorations 插件实现）

* 斜杠命令 `/`：使用 `@milkdown/plugin-slash`，菜单项包括标题级别、列表、代码块、表格、公式块、分割线

### 5.2 代码块

* `@milkdown/plugin-prism` 实现语法高亮

* 代码块顶部显示语言选择下拉框（自定义 NodeView）

* 代码块内等宽字体，块外使用正文字体

### 5.3 数学公式（MathLive 集成）

* 通过自定义 ProseMirror NodeView 集成 MathLive Web Component

* **默认态（visual）：** MathLive 渲染模式，公式以可视化形式呈现，点击可直接用可视化方式编辑（光标移动、分数输入、上下标等）

* **手动切换（source）：** 公式节点右上角 `</>` 按钮，点击切换为 LaTeX 源码文本框编辑，再点击切回可视化

* 行内公式 `$...$`：inline NodeView，内嵌 MathLive 实例

* 块级公式 `$$...$$`：block NodeView，居中显示

```
MathNodeView:
  ├── 状态: "visual" | "source"
  ├── visual 模式 → 创建 <math-field> (MathLive Web Component)
  ├── source 模式 → 创建 <textarea> 显示 LaTeX 源码
  └── 切换按钮 → 在两种模式间切换，同步 LaTeX 字符串
```

### 5.4 表格编辑

* 基于 `@milkdown/preset-gfm` 的表格支持

* 自定义 NodeView 增强：点击单元格编辑、Tab 跳转下一单元格、右键菜单添加/删除行列

* 表格上方悬浮工具条：添加行、添加列、删除表格

## 6. 文件管理

### 6.1 侧边栏文件树

* 默认隐藏，`Ctrl+\` 或左侧边缘悬浮触发滑出

* 滑出时编辑区向右收缩（非覆盖），宽度约 240px

* `showDirectoryPicker()` 打开文件夹，递归读取目录，只显示 `.md` / `.markdown` 文件和文件夹

* 支持：单击打开、右键菜单（新建、重命名、删除）、拖拽排序

### 6.2 文件操作

```
FileManager:
  ├── openFolder()      → showDirectoryPicker() → 构建文件树
  ├── openFile(handle)  → handle.getFile() → 读取内容 → 加载到编辑器
  ├── saveFile()        → Markdown 序列化 → handle.createWritable() → 写入
  ├── saveAs()          → showSaveFilePicker() → 另存为
  └── newFile()         → 清空编辑器 → 标记为未保存新文件
```

* 自动保存：内容变更防抖 2 秒自动保存

* 未保存提示：关闭或切换文件时弹出确认对话框

* 降级方案：Firefox/Safari 使用 `<input type="file">` + Blob 下载

### 6.3 标题栏

* 顶部极简标题栏，显示当前文件名

* 未保存时文件名旁显示 `●` 标记

* 标题栏可拖拽移动窗口（桌面化预留）

## 7. 导出功能

### 7.1 导出 HTML

* 编辑器内容序列化为 Markdown，转为完整 HTML 文档

* 内嵌当前主题样式（CSS 变量展开为具体值）

* 代码高亮样式内嵌

* 数学公式导出为 MathML（MathLive `getValue('math-ml')`）

### 7.2 导出 PDF

* 浏览器原生 `window.print()`

* 隐藏 iframe 注入导出 HTML，调用 `iframe.contentWindow.print()`

* `@media print` CSS 控制打印样式、分页、页边距

* 零依赖，排版由浏览器引擎保证

### 7.3 导出入口

* 底部状态栏导出按钮，下拉菜单：`导出 HTML` / `导出 PDF`

* 快捷键：`Ctrl+Shift+E`

## 8. 主题系统

CSS 变量驱动，通过 `<html data-theme="light|dark">` 切换。

```css
:root[data-theme="light"] {
  --bg-primary: #ffffff;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border: #e8e8e8;
  --code-bg: #f6f8fa;
  --accent: #0366d6;
}
:root[data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --text-primary: #d4d4d4;
  --text-secondary: #999999;
  --border: #333333;
  --code-bg: #2d2d2d;
  --accent: #58a6ff;
}
```

* 底部状态栏图标切换，偏好存入 `localStorage`

* 首次加载跟随系统 `prefers-color-scheme`

## 9. 快捷键

| 快捷键            | 功能    |
| -------------- | ----- |
| `Ctrl+S`       | 保存    |
| `Ctrl+Shift+S` | 另存为   |
| `Ctrl+O`       | 打开文件  |
| `Ctrl+N`       | 新建文件  |
| `Ctrl+\`       | 切换侧边栏 |
| `Ctrl+Shift+E` | 导出菜单  |
| `Ctrl+B`       | 加粗    |
| `Ctrl+I`       | 斜体    |
| `Ctrl+Shift+K` | 行内代码  |
| `Ctrl+Shift+M` | 行内公式  |
| `Ctrl+/`       | 切换主题  |

## 10. Markdown 往返一致性

核心质量指标：Markdown → 编辑器 → 序列化回 Markdown，内容不丢失不变形。使用 `@milkdown/kit` 内置的序列化能力，需重点测试边界情况（嵌套列表、表格内行内样式、公式中的特殊字符等）。

## 11. 浏览器兼容性

* **完整体验：** Chrome / Edge（File System Access API 支持）

* **降级体验：** Firefox / Safari（文件操作降级为传统方式）

* 编辑器核心功能全浏览器兼容

