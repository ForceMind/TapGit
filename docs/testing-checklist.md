# MVP 测试检查清单

## 环境检查

- [ ] 已安装 Node.js 22+
- [ ] 已安装 Git，且 `git --version` 可用
- [ ] `npm install` 成功，无阻塞错误

## 自动化检查

- [x] `npm run test`
- [x] `npm run build`
- [x] `npm run pack:dir`
- [x] `npm run pack:win`
- [ ] `npm run pack:mac`（需在 macOS 或 GitHub Actions macOS runner 验证）

## 核心流程手测

### 打开项目与开启版本保护

- [ ] 能选择本地文件夹
- [ ] 非保护项目会出现“开启版本保护”
- [ ] 开启后可正常进入后续功能

### 当前修改与保存进度

- [ ] 修改文件后能在“当前修改”页看到变化
- [ ] 能查看单文件差异详情
- [ ] 能保存全部修改
- [ ] 能保存选中的文件

### 保存记录与恢复

- [ ] 保存后能在“保存记录”看到新条目
- [ ] 能查看记录详情
- [ ] 能恢复到历史保存点
- [ ] 恢复前有安全确认说明

### 方案与合并

- [ ] 能创建新方案并切换
- [ ] 能切换已有方案
- [ ] 能把来源方案合并到目标方案
- [ ] 冲突时能进入决策界面
- [ ] 冲突界面支持逐个处理
- [ ] 冲突界面支持批量保留某一侧

### 云端同步

- [ ] 连接向导能生成标准 GitHub / GitLab 地址
- [ ] GitHub 登录状态可见
- [ ] 能在应用里触发 GitHub 登录
- [ ] 能在应用里退出 GitHub 账号
- [ ] 连接测试能区分通过 / 权限不足 / 地址错误 / 网络异常
- [ ] 能完成连接云端
- [ ] 能上传到云端
- [ ] 能获取云端最新内容

### 本地化

- [ ] 默认英文界面
- [ ] 系统语言为中文时默认中文
- [ ] 设置页切换语言后立即生效
- [ ] 中文模式覆盖导航、顶栏和主要页面文案

## 打包产物检查

### Windows

- [x] 生成 `release/TapGit-*.exe`
- [x] 生成 `release/win-unpacked/`
- [x] `win-unpacked/TapGit.exe` 可启动

### macOS

- [ ] 生成 `release/TapGit-*.dmg`
- [ ] 生成 `release/TapGit-*.zip`
- [ ] GitHub Actions 的 macOS runner 可完成打包

## 发布链路检查

- [ ] Push 到 `main` 后自动生成 Windows / macOS 构建产物
- [ ] Push `v*` tag 后自动创建 GitHub Release
- [ ] Release 附带 Windows 与 macOS 安装包
