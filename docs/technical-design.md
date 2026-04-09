# 码迹（TapGit）技术方案（Phase 1）

## 1. 技术选型结论
目标选型：`Tauri 2 + React 18 + TypeScript + Vite`

当前落地选型（本仓库 MVP）：`Electron + React 18 + TypeScript + Vite`

执行理由：
- 目标层面优先 Tauri：更轻量、资源占用更低
- 当前环境未安装 Rust/Cargo，先用 Electron 可更快完成可运行 MVP
- Electron 同样具备成熟 IPC、文件系统与 Git 调用能力
- 前端层保持 React + TS 不变，后续可平滑迁移到 Tauri 壳

迁移预案：
- 业务层保持“任务语义 API”，避免 UI 绑定具体桌面壳
- Git 网关继续使用“命令行 Git + 输出解析”，可在 Tauri/Rust 侧复刻
- 自动更新先手动检查，后续再接入平台能力

## 2. 技术栈清单（MVP）
- 桌面壳：`electron`
- 前端框架：`react@18` + `typescript`
- 路由：`react-router-dom`
- 状态管理：`zustand`
- 服务请求管理：`@tanstack/react-query`（用于异步状态与缓存）
- UI 组件：`Fluent UI React v9`（Windows 风格一致性）+ 自定义主题
- 代码校验：`eslint` + `prettier`
- 前端测试：`vitest` + `testing-library`
- E2E（后续）：`playwright`
- Node 日志：`electron-log` + 本地日志文件
- 配置：本地 JSON 配置文件

## 3. 架构设计
```text
React UI
  -> Application Layer (use-cases + stores)
    -> Electron IPC
      -> Main Process Domain Services
        -> Git Gateway (CLI git wrapper)
        -> File System / Config / Log
```

分层目标：
- UI 层不处理 Git 细节，只消费任务语义对象（修改列表、保存记录、方案）
- 主进程统一封装 Git 命令与错误翻译，输出稳定 DTO
- 错误统一映射为用户可理解的文案码（例如 `SAVE_FAILED`, `MERGE_NEEDS_DECISION`）

## 4. Git 操作封装（MVP API 草案）
前端调用（Electron IPC）：
- `open_project(path)`
- `enable_protection(path)`  // git init
- `get_current_changes(path)`
- `save_progress(path, message, selectedFiles?)`
- `list_history(path, limit, cursor?)`
- `restore_to_record(path, recordId, createSafetySnapshot=true)`
- `list_plans(path)`
- `create_plan(path, name, fromPlan?)`
- `switch_plan(path, planId)`
- `merge_plan(path, fromPlan, toPlan)`
- `resolve_collision(path, filePath, strategy)` // keep-left / keep-right / manual
- `get_cloud_sync_status(path)`
- `connect_cloud(path, remoteUrl)`
- `upload_to_cloud(path)`
- `get_cloud_latest(path)`

Git 命令策略（Main Process 内部）：
- 状态：`git status --porcelain=v1 -z`
- 差异：`git diff --numstat` + `git diff -- <file>`
- 保存：`git add` + `git commit -m`
- 方案：`git branch` / `git switch`
- 历史：`git log --pretty=format:...`
- 恢复：`git checkout <commit>`（后续可切 `git restore` 细化）
- 合并：`git merge`
- 云端连接：`git remote add/set-url`
- 上传：`git push -u`
- 获取：`git fetch` + `git pull --ff-only`

## 5. 安全机制
- 危险动作前默认创建“安全快照”（隐藏技术实现，可用临时方案或记录点）
- 合并/恢复前做干净度检查，提示用户先保存当前进度
- 所有写操作落日志：时间、项目、动作、结果、错误码
- 日志可一键导出供问题排查

## 6. 配置与日志
本地配置建议路径（Windows）：
- `%APPDATA%/TapGit/config.json`
- `%APPDATA%/TapGit/projects.json`
- `%APPDATA%/TapGit/logs/*.log`

配置项（MVP）：
- `ui.language`
- `ui.showAdvancedMode`
- `save.defaultMessageTemplate`
- `safety.autoSnapshotBeforeRestore`
- `safety.autoSnapshotBeforeMerge`
- `cloud.lastRemoteUrl`

## 7. 项目目录结构草案
```text
TapGit/
├─ docs/
├─ src/                        # React + TS
│  ├─ app/                     # App 壳、路由、布局
│  ├─ pages/                   # 首页/当前修改/保存记录/我的方案/设置
│  ├─ modules/                 # 领域模块
│  │  ├─ project/
│  │  ├─ changes/
│  │  ├─ timeline/
│  │  ├─ plans/
│  │  └─ settings/
│  ├─ components/              # 通用组件
│  ├─ stores/                  # Zustand 状态
│  ├─ services/
│  │  ├─ bridge/               # IPC 调用封装
│  │  └─ dto/
│  ├─ styles/
│  └─ types/
├─ electron/                   # Electron 主进程与预加载
│  ├─ main/
│  └─ preload/
├─ tests/
│  ├─ unit/
│  └─ e2e/
├─ scripts/
└─ README.md
```

## 8. 三方库选型说明（MVP 优先）
- `simple-git`：采用，降低 Git 命令封装成本并提高跨平台稳定性
- `git2-rs`：当前实现不采用，后续若迁移 Tauri/Rust 再评估
- UI 采用 Fluent v9：贴合 Windows 视觉与可访问性基线，减少自建组件成本
