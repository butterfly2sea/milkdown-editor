# WebDAV 同步冲突处理设计

## 日期
2026-03-25

## 概述
为 Milkdown Editor 的 WebDAV 同步功能设计冲突检测和解决方案。支持多对一映射（多个本地文件绑定同一远端路径），使用 mtime 初筛 + content hash 确认的两级检测机制，冲突时提供 JetBrains 风格的左右逐块对比合并 UI。

## 映射模型

### 当前模型
```typescript
interface SyncMapping {
  localPath: string;
  remotePath: string;
}
```
严格一对一。

### 新模型
允许多对一：多个本地文件可以绑定到同一个远端路径。远端作为"权威源"，当远端内容变化时，所有绑定到它的本地副本都需要同步。

不支持一对多（一个本地文件同步到多个远端路径），因为当前只有一个 WebDAV 服务器配置。

### 重复绑定处理
尝试将本地文件绑定到已被其他本地文件绑定的远端路径时，允许绑定但提示用户："该远端路径已被 xxx 绑定，继续绑定将形成多对一同步"。

## 冲突检测

### Manifest 结构
```typescript
interface SyncManifestEntry {
  localMtime: number;
  remoteMtime: number;
  lastSyncedAt: number;
  localHash: string;   // 上次同步时的本地内容 hash (MD5 或 SHA-256)
  remoteHash: string;  // 上次同步时的远端内容 hash
}
```

### 两级检测机制
1. **mtime 初筛**：比较当前 mtime 与 manifest 中记录的 mtime，快速排除未变化的文件
2. **hash 确认**：mtime 变了的文件，读取内容计算 hash，与 manifest 中的 hash 比较确认是否真的变了

这样做的好处：
- mtime 比较几乎零开销（PROPFIND 已返回远端 mtime，本地 stat 也是 O(1)）
- 只有 mtime 变了才需要读文件内容算 hash，减少 IO
- hash 消除了"保存但未改内容"和"时钟不同步"导致的误判

### 检测时机
1. **保存后上传**：本地保存 → 上传前先检查远端 mtime → 如果变了，下载远端内容算 hash 确认
2. **周期性同步**：遍历所有映射，按 mtime 初筛 + hash 确认
3. **窗口获焦时**：快速检查已映射文件的远端状态

### 完整同步流程（单个文件映射）
1. `stat(localPath)` 读本地 mtime → 与 `manifest.localMtime` 比较
2. 如果本地 mtime 变了 → `readTextFile(localPath)` 算 `localHash`
3. `PROPFIND` 远端 mtime → 与 `manifest.remoteMtime` 比较
4. 如果远端 mtime 变了 → `GET` 下载远端内容算 `remoteHash`
5. 判定：

| 本地 hash 变化 | 远端 hash 变化 | 行为 |
|---------------|---------------|------|
| 否 | 否 | 跳过 |
| 是 | 否 | 自动上传 |
| 否 | 是 | 提示：远端已更新，是否下载？ |
| 是 | 是 | 弹出 diff 合并 UI |

6. 操作完成后更新 manifest（mtime + hash + lastSyncedAt）

### 远端变化提示
仅远端变化时（本地未修改），弹简单确认框：
```
"notes.md 远端已更新，是否下载最新版本？"
[下载更新] [暂时忽略]
```
选择"暂时忽略"时更新 manifest 的 remoteMtime/remoteHash 避免重复提示，但不修改本地文件。

## Diff 合并 UI

### 布局
```
┌─────────────────────────────────────────────────────┐
│  ⚠ 同步冲突: notes.md                         [×]  │
├────────────────────┬──┬─────────────────────────────┤
│ 本地版本           │  │ 远端版本                     │
│                    │  │                              │
│ # My Notes         │  │ # My Notes                   │
│                    │  │                              │
│-这是本地修改的内容  │←→│+这是远端修改的内容            │
│                    │  │                              │
│ 相同的段落...       │  │ 相同的段落...                 │
│                    │  │                              │
│-本地新增的段落      │ → │                              │
│                    │  │                              │
├────────────────────┴──┴─────────────────────────────┤
│        [使用本地全部] [使用远端全部] [保存合并结果]     │
└─────────────────────────────────────────────────────┘
```

### 交互
- 左栏：本地内容，右栏：远端内容
- 差异块高亮：绿=新增，红=删除，黄=修改
- 每个差异块中间有箭头按钮：`←` 使用本地版本，`→` 使用远端版本
- 相同部分灰色显示，可折叠以聚焦差异
- 底部三个按钮：使用本地全部 / 使用远端全部 / 保存合并结果

### Diff 算法
使用 `diff` npm 包的 `diffLines(oldText, newText)` 进行行级比较。

### 数据结构
```typescript
interface DiffBlock {
  type: 'same' | 'add' | 'remove' | 'modify';
  localLines: string[];    // 本地内容行
  remoteLines: string[];   // 远端内容行
  resolved?: 'local' | 'remote'; // 用户对此块的选择
}
```
- `same`：两端相同的行
- `add`：仅远端有的行（本地没有）
- `remove`：仅本地有的行（远端没有）
- `modify`：同一位置两端内容不同（相邻的 remove + add 合并为 modify）

### 合并结果生成
遍历所有 DiffBlock，根据 `resolved` 字段拼接最终内容：
- `same` → 直接使用
- `add` / `remove` / `modify` → 使用 `resolved` 指定的那一边的行
- 未选择的块使用本地版本作为默认

## 多对一同步逻辑

### 场景
本地文件 A (`/work/notes.md`) 和 B (`/personal/notes.md`) 都绑定到远端 `/notes.md`。

### 行为
1. A 保存后上传到远端 `/notes.md`
2. 下次同步时，B 的 manifest 中 `remoteHash` 是旧的 → 检测到远端变了
3. B 本地未修改 → 提示"远端已更新，是否下载？"
4. B 本地也修改了 → 弹 diff 合并 UI

### 关键点
- 每个映射有独立的 manifest entry（key 是 localPath）
- A 上传后只更新 A 的 manifest，B 的 manifest 不变
- B 下次同步时自然检测到远端 hash 不匹配

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/sync/sync-manager.ts` | 重构 | mtime 初筛 + hash 确认，新提示流程 |
| `src/sync/sync-config.ts` | 修改 | manifest 增加 localHash/remoteHash |
| `src/sync/diff-merge.ts` | 新建 | DiffBlock 数据结构，行级 diff 封装 |
| `src/sync/merge-modal.ts` | 新建 | 左右对比合并 UI 组件 |
| `src/i18n/locales.ts` | 修改 | 合并相关 i18n 字符串 |
| `package.json` | 修改 | 添加 `diff` 依赖 |

## 不做的事情
- 字符级 diff（行级对 Markdown 足够）
- 三路合并（没有 common ancestor 概念）
- 自动合并（所有冲突都让用户决定）
- 一对多映射（一个本地文件同步到多个远端路径）
