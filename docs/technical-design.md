# 码迹（TapGit）技术方案

## 1. 当前技术选型
当前落地选型：
- `Electron`
- `React 18`
- `TypeScript`
- `Vite`
- `simple-git`
- `zustand`
- `vitest`

继续沿用 Electron 的原因：
- Windows 桌面能力成熟
- 文件系统、Git 命令、系统菜单、安装包链路都已打通
- 当前重点是产品重构，而不是迁移桌面壳

## 2. 本轮技术目标
围绕这次产品调整，代码需要补强三件事：
- 顶部菜单从系统默认结构改成任务菜单
- 首页支持两个起步入口
- 新增“从 GitHub 获取项目”能力

## 3. 主进程能力设计
现有主进程已具备：
- 打开本地项目
- 开启版本保护
- 读取修改
- 保存进度
- 历史记录
- 想法副本
- 合并处理
- 云端连接

本轮新增：
- `chooseCloneDestination()`
- `cloneProjectFromGitHub(remoteUrl, parentDirectory, folderName?)`
- `openProjectInFileManager(projectPath)`（可选，但适合放入任务菜单）

## 4. “从 GitHub 获取项目”实现思路
前端流程：
1. 用户点击首页或菜单中的“从 GitHub 获取项目”
2. 打开获取项目弹层
3. 输入仓库地址
4. 选择目标父目录
5. 点击“开始获取”
6. 成功后自动打开项目并加入最近项目

主进程流程：
1. 校验仓库地址和目标路径
2. 计算最终目录名
3. 检查目标目录是否已存在且非空
4. 执行 `git clone <url> <targetPath>`
5. 成功后复用现有 `openProject()` 返回项目摘要

错误翻译：
- 地址为空 -> `EMPTY_REMOTE_URL`
- 目标位置为空 -> `EMPTY_DESTINATION`
- 目标目录已存在 -> `TARGET_ALREADY_EXISTS`
- clone 失败 -> `CLONE_PROJECT_FAILED`

## 5. 顶部菜单实现原则
菜单不是系统能力展示区，而是全局动作入口。

菜单命令通过现有事件桥接发送到渲染进程：
- `open-project`
- `clone-project`
- `show-changes`
- `show-timeline`
- `save-all`
- `show-plans`
- `create-idea-copy`
- `switch-to-main`
- `open-settings`
- `cloud-upload`
- `cloud-download`
- `export-logs`

渲染进程根据当前项目状态决定：
- 直接执行
- 跳转到对应页面
- 或提示还差哪一步

## 6. 首页实现原则
- 未打开项目时：两张大卡片 + 最近项目
- 已打开项目时：一个主动作 + 一组解锁顺序
- 中文模式下优先减少文字，不靠缩小字号解决拥挤

## 7. 共享契约调整
`src/shared/contracts.ts` 需要新增：
- `CloneProjectPayload`
- `chooseCloneDestination()`
- `cloneProjectFromGitHub()`

必要时为菜单命令补充更多 `APP_EVENTS.MENU_COMMAND` 值。

## 8. 测试范围
本轮至少补这几类测试：
- 首页未打开项目时显示两个主入口
- 获取项目弹层交互
- 菜单命令到渲染进程动作映射
- 中文文案不再重复出现多个“打开项目”主按钮

## 9. 风险与降级
- 风险：GitHub 获取项目流程做成完整 OAuth 过重
  - 降级：先支持仓库地址 + 本机 Git 凭据
- 风险：菜单动作过多导致状态判断复杂
  - 降级：先落高频动作，低频项放回设置页
- 风险：首页改动过大影响已有测试
  - 降级：先确保两种入口和中文布局正确，再逐步细调视觉
