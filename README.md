# 码迹 TapGit

码迹是一个面向普通人的代码进度保存与恢复桌面应用。  
它把底层版本控制能力包装成更容易理解的动作：保存进度、查看历史、切换方案、恢复到之前可用的状态。

## 当前交付

- 桌面壳：Electron + React + TypeScript
- 主要语言：中文 / English
- 默认语言：英文；系统语言为中文时自动显示中文
- 当前可打包平台：Windows、macOS
- 当前主要定位：本地优先，云端同步为基础版

## MVP 功能

- 打开本地项目并检测是否已开启版本保护
- 一键开启版本保护
- 查看当前修改列表和变化详情
- 保存全部修改或只保存选中文件
- 查看保存记录时间线
- 恢复到历史保存点，并带安全确认
- 创建、切换、合并“方案”
- 冲突处理界面，支持逐个处理和批量保留一侧
- 设置页支持语言切换、日志导出、云端连接助手
- 应用内 GitHub 登录状态查看、登录与退出

## 环境要求

- Node.js 22+
- npm 10+
- Git

## 本地运行

安装依赖：

```bash
npm install
```

开发运行：

```bash
npm run dev
```

## 测试与构建

运行测试：

```bash
npm run test
```

构建应用：

```bash
npm run build
```

## 打包

Windows 安装包：

```bash
npm run pack:win
```

macOS 安装包：

```bash
npm run pack:mac
```

目录包：

```bash
npm run pack:dir
```

常见输出目录：

- `release/TapGit-*.exe`
- `release/win-unpacked/`
- `release/TapGit-*.dmg`
- `release/TapGit-*.zip`

说明：

- Windows 机器上可以本地打 `Windows` 包。
- macOS 安装包建议在 macOS 或 GitHub Actions 的 macOS runner 上生成。
- 当前 macOS 包默认是未签名构建，适合测试和内部分发。

## GitHub Actions

仓库已配置自动桌面打包：

- Push 到 `main`：自动运行 Windows 和 macOS 构建、测试并上传产物
- Push `v*` tag：额外自动创建 GitHub Release，并附带 Windows / macOS 安装包

## 主要目录

```text
docs/                 产品和设计文档
electron/             主进程、预加载、Git/认证/日志封装
src/                  React 前端
release/              本地打包输出
.github/workflows/    CI 打包流水线
```

## 设计文档

- `docs/product-overview.md`
- `docs/information-architecture.md`
- `docs/terminology-mapping.md`
- `docs/technical-design.md`
- `docs/roadmap.md`
- `docs/ui-wireframes.md`
- `docs/design-guidelines.md`
- `docs/microcopy.md`
- `docs/testing-checklist.md`
- `docs/release-notes-mvp.md`

## 当前限制

- GitLab 仍是浏览器引导式连接，尚未做应用内账号登录管理
- macOS 当前为基础打包支持，未接入签名与 notarization
- 构建日志里仍有 Vite / Rollup 插件警告，但不影响当前构建和打包
