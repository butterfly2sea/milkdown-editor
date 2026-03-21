# Tauri 桌面应用封装 — 设计文档

> 将 Milkdown 编辑器封装为跨平台桌面应用

## 1. 概述

使用 Tauri v2 将现有 Web 编辑器封装为桌面应用，覆盖 Windows、macOS、Linux 三大平台的 x86_64 和 aarch64 架构。使用 GitHub Actions 自动构建发布。

## 2. 技术选型

| 项目 | 选型 |
|------|------|
| 桌面框架 | Tauri v2 |
| 后端语言 | Rust |
| 前端 | 现有 Vite + TypeScript（不变） |
| 文件操作 | `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog` |
| CI/CD | GitHub Actions + `tauri-apps/tauri-action` |

## 3. 项目结构变更

```
milkdown/
├── src/                    # 前端代码（现有，适配 Tauri API）
├── src-tauri/              # Tauri 后端（新增）
│   ├── Cargo.toml          # Rust 依赖
│   ├── tauri.conf.json     # Tauri 配置（窗口、权限、打包）
│   ├── capabilities/       # 权限声明
│   ├── icons/              # 应用图标（各尺寸）
│   └── src/
│       └── main.rs         # Rust 入口（窗口、菜单）
├── package.json            # 新增 @tauri-apps/* 依赖
├── vite.config.ts          # 不变
└── .github/
    └── workflows/
        └── release.yml     # CI/CD 构建发布
```

## 4. Tauri 配置

### 4.1 tauri.conf.json

```json
{
  "productName": "Milkdown Editor",
  "version": "0.1.0",
  "identifier": "com.milkdown.editor",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [{
      "title": "Milkdown Editor",
      "width": 1200,
      "height": 800,
      "minWidth": 600,
      "minHeight": 400,
      "decorations": false
    }]
  }
}
```

### 4.2 自定义标题栏

- `decorations: false` 隐藏系统原生标题栏
- 复用现有 `#titlebar`，添加 `data-tauri-drag-region` 实现拖拽
- 右上角添加窗口控制按钮（最小化、最大化、关闭）
- macOS 上窗口控制按钮放左上角

### 4.3 原生菜单（macOS）

macOS 通过 Rust `tauri::menu` 创建顶部菜单栏：
- File: New / Open / Open Folder / Save / Save As / Export / Quit
- Edit: Undo / Redo / Cut / Copy / Paste
- View: Toggle Sidebar / Toggle Theme / Zoom
- Help: About

Windows/Linux 不显示原生菜单，通过 `#[cfg(target_os = "macos")]` 条件编译。

## 5. 文件系统迁移

### 5.1 API 映射

| 功能 | 现有 Web API | Tauri 替代 |
|------|-------------|-----------|
| 打开文件 | `showOpenFilePicker()` | `dialog.open()` |
| 保存文件 | `handle.createWritable()` | `fs.writeTextFile()` |
| 另存为 | `showSaveFilePicker()` | `dialog.save()` |
| 打开文件夹 | `showDirectoryPicker()` | `dialog.open({ directory: true })` |
| 读取目录 | `dirHandle.values()` | `fs.readDir()` |
| 删除文件 | `dirHandle.removeEntry()` | `fs.remove()` |

### 5.2 改造要点

- 重写 `src/file/fs.ts`，移除 `FallbackFileManager`
- 使用文件路径字符串替代 `FileSystemHandle`
- 自动保存逻辑不变（2 秒防抖），直接写文件系统
- 所有平台行为一致，不再需要降级方案

## 6. 构建目标矩阵

| 平台 | 架构 | 安装包格式 | CI Runner |
|------|------|-----------|-----------|
| Windows | x86_64 | `.msi` + `.exe` | `windows-latest` |
| Windows | aarch64 | `.msi` + `.exe` | `windows-latest`（交叉编译） |
| macOS | x86_64 | `.dmg` | `macos-latest` |
| macOS | aarch64 | `.dmg` | `macos-latest`（ARM 原生） |
| Linux | x86_64 | `.deb` + `.AppImage` | `ubuntu-22.04` |
| Linux | aarch64 | `.deb` + `.AppImage` | `ubuntu-22.04-arm` |

## 7. CI/CD 发布流程

### 7.1 触发条件

推送 `v*` tag 时自动触发构建。

### 7.2 工作流

```yaml
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - platform: macos-latest
            target: x86_64-apple-darwin
          - platform: macos-latest
            target: aarch64-apple-darwin
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
          - platform: windows-latest
            target: aarch64-pc-windows-msvc
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
          - platform: ubuntu-22.04-arm
            target: aarch64-unknown-linux-gnu
```

每个 Job 步骤：
1. Checkout 代码
2. 安装 Rust + 对应 target
3. 安装 Node.js + npm 依赖
4. Linux: 安装系统依赖（`libwebkit2gtk-4.1-dev` 等）
5. 运行 `tauri-apps/tauri-action` 构建并上传到 GitHub Release

### 7.3 发布流程

1. 更新 `package.json` 和 `tauri.conf.json` 版本号
2. `git tag v0.1.0 && git push --tags`
3. CI 自动构建 6 个目标，生成约 10 个安装包
4. 自动创建 GitHub Release 并附带所有安装包

### 7.4 产物命名

```
milkdown-editor_0.1.0_x64-setup.exe
milkdown-editor_0.1.0_x64.msi
milkdown-editor_0.1.0_arm64-setup.exe
milkdown-editor_0.1.0_arm64.msi
milkdown-editor_0.1.0_x64.dmg
milkdown-editor_0.1.0_arm64.dmg
milkdown-editor_0.1.0_amd64.deb
milkdown-editor_0.1.0_amd64.AppImage
milkdown-editor_0.1.0_arm64.deb
milkdown-editor_0.1.0_arm64.AppImage
```
