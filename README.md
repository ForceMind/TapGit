# 码迹 TapGit（Windows MVP）

码迹是一个面向普通人的代码进度保存与恢复桌面应用。  
目标是让不懂 Git 的用户也能完成：`保存进度`、`查看历史`、`切换方案`、`恢复版本`。

## 当前实现状态
- 桌面壳：Electron + React + TypeScript
- 平台：Windows 10 / 11
- 交付形态：开发模式、可构建产物、可生成 Windows 安装包
- 语言：中英文双语（默认英文；系统语言为中文时自动显示中文；可在设置中手动切换）

## 已完成 MVP 功能
- 打开本地项目，检测是否开启版本保护
- 一键开启版本保护（底层 Git 初始化）
- 当前修改列表与变化详情
- 保存进度（支持全部保存、选中文件保存）
- 保存记录时间线与详情
- 恢复到历史保存点（恢复前自动安全快照）
- 新方案创建与切换
- 合并方案回主线
- 两边改到同一部分时的可视化决策界面
- 设置页（环境检测、高级模式、安全快照开关、日志导出）
- 设置页语言切换（自动/English/中文），中文模式覆盖导航、顶栏与页面主文案
- 云端同步基础版（连接向导、连接测试、上传到云端、获取最新内容、同步状态显示）
- 首页新手引导卡（可在设置中关闭）

## 本地运行
前置要求：
- Node.js 22+
- npm 10+
- Git for Windows（建议已加入 PATH）

安装依赖：
```bash
npm install
```

开发运行（会启动 Vite + Electron）：
```bash
npm run dev
```

## 测试与构建
运行单元测试：
```bash
npm run test
```

构建产物：
```bash
npm run build
```

## 打包说明（Windows）
生成可安装包（NSIS）：
```bash
npm run pack:win
```

输出目录：
- `release/TapGit-1.0.0.exe`（安装包）
- `release/win-unpacked/`（免安装目录）

## GitHub 打包与发布
- Push 到 `main` 后，GitHub Actions 会自动运行 Windows 打包、测试并上传构建产物
- Push `v*` Tag（例如 `v1.0.1`）后，Actions 会额外创建 GitHub Release，并附带：
- `TapGit-*.exe`
- `TapGit-*.exe.blockmap`
- `TapGit-win-unpacked.zip`

## 项目结构
```text
docs/                 产品文档、设计文档、测试与发布文档
electron/             主进程与预加载（IPC、Git 封装、配置、日志）
src/                  React 前端（页面、状态、样式、共享协议）
release/              打包输出（运行打包命令后生成）
```

## 设计与规格文档
- `docs/product-overview.md`
- `docs/information-architecture.md`
- `docs/terminology-mapping.md`
- `docs/technical-design.md`
- `docs/roadmap.md`
- `docs/ui-wireframes.md`
- `docs/design-guidelines.md`
- `docs/microcopy.md`

## 已知问题
- 构建输出含第三方插件警告（不影响当前打包与运行）
- 目前未提供自定义应用图标，安装包使用默认 Electron 图标
- 云端同步暂不包含 OAuth 登录流程，当前使用手动填写云端地址方式
