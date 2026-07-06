# 多实例打开支持计划

## 日期
2026-07-06

## 背景

当前版本不能打开多个独立实例。代码审计定位到直接原因：

- `src-tauri/src/lib.rs` 注册了 `tauri_plugin_single_instance::init(...)`。
- 第二次启动应用时，插件回调会把命令行路径转发给已有 `main` 窗口，然后新启动的实例退出。
- 前端通过 `open-file` / `open-folder-path` 事件接收转发路径，因此表现为复用已有窗口，而不是打开新的独立实例。

官方资料结论：

- Tauri Single Instance 插件的目标是确保同一时间只运行一个应用实例。
- Linux 下该插件通过 DBus 服务实现，后续实例通知首个实例后立即退出。
- 该插件没有 JavaScript API，因此移除它不需要改 capabilities。

参考：

- https://v2.tauri.app/plugin/single-instance/
- https://docs.rs/tauri-plugin-single-instance/latest/tauri_plugin_single_instance/

## 目标

支持同一用户会话中启动多个独立 Milkdown Editor 实例：

1. 每次从可执行文件、快捷方式或命令行启动应用，都创建新的 Tauri 进程和自己的 `main` 窗口。
2. 带 `.md` / `.markdown` 文件路径或文件夹路径启动时，由当前新实例读取启动参数并打开对应文件或文件夹。
3. 保留现有拖拽打开、菜单打开、文件夹打开和 macOS `Opened` 事件兜底逻辑。

## 非目标

- 不实现应用内多窗口或标签页。
- 不修改 `tauri.conf.json`、权限、capabilities 或文件关联配置。
- 不解决同一个文件被多个实例同时编辑时的内容冲突；现有外部变更检测继续作为兜底。

## 实施方案

1. Rust 后端
   - 从 `src-tauri/Cargo.toml` 移除 `tauri-plugin-single-instance` 依赖。
   - 从 `tauri::Builder` 链中移除 `.plugin(tauri_plugin_single_instance::init(...))`。
   - 保留 `PendingFile` 和启动参数读取逻辑，确保新实例冷启动时仍能打开传入路径。

2. 前端
   - 保留 `open-file` / `open-folder-path` 监听，用于 macOS Opened 事件和未来 OS 集成。
   - 更新注释，避免把该事件路径继续描述成 single-instance 转发。

3. 锁文件
   - 运行 Rust 验证命令，让 Cargo 更新 `src-tauri/Cargo.lock` 中不再需要的 single-instance 依赖。

## 验收标准

1. `npm run build` 通过。
2. `cd src-tauri && cargo check` 通过。
3. `cd src-tauri && cargo clippy --all-targets -- -D warnings` 通过。
4. 手动验证：
   - 启动应用 A。
   - 再次启动应用，出现独立应用 B，而不是聚焦 A。
   - 通过命令行分别以两个 Markdown 文件路径启动两次，两个实例分别打开自己的文件。
   - 在两个实例中分别新建、打开、保存、关闭文件，确认互不影响且无 console error。

## 风险

- 同一文件被多个实例同时编辑时，最后保存的一方可能覆盖另一方；现有外部变更检测只能在窗口重新聚焦时提示。
- macOS Finder/Dock 的应用激活策略可能仍会把某些“打开方式”事件投递给已运行进程；本次先解除项目内 single-instance 插件限制，不扩展到动态多窗口。

## 回滚

revert 本变更即可恢复单实例行为；无需迁移用户数据。
