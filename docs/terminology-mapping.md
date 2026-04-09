# 码迹（TapGit）术语映射表

## 1. 默认策略
- 默认界面只显示用户语言
- Git 原词只允许出现在高级模式、日志或诊断信息中
- 所有危险操作优先解释影响，不先抛术语

## 2. 术语映射
| Git / 技术概念 | 默认用户文案 | 使用场景 |
|---|---|---|
| repository | 项目 | 全局 |
| git init | 开启版本保护 | 首次进入项目 |
| clone | 从 GitHub 获取项目 | 首页 / 项目菜单 |
| local repository | 本地项目 | 首页 |
| commit | 保存进度 | 当前修改 |
| commit message | 这次说明 / 进度说明 | 保存输入框 |
| log / history | 保存记录 | 历史页 |
| reset / checkout commit | 恢复到这里 | 历史页 |
| branch | 想法副本 / 稳定版本 | 试新想法 |
| switch branch | 切过去 / 切回稳定版本 | 试新想法 |
| merge | 把想法带回来 | 试新想法 |
| merge conflict | 修改碰到一起 | 合并处理 |
| remote | 云端地址 | 设置 / 云端 |
| push | 上传到云端 | 云端 |
| pull | 获取最新内容 | 云端 |
| tracking branch | 同步关系 | 云端状态 |
| detached HEAD | 特殊状态 | 异常恢复 |

## 3. 功能名称映射
- `我的方案` -> `试新想法`
- `主线分支` -> `稳定版本`
- `新分支` -> `想法副本`
- `合并到主线` -> `把想法带回稳定版本`

## 4. 禁止直接出现的表达
- `branch`
- `merge conflict`
- `checkout`
- `clone repo`
- `pull request`
- `detached HEAD`

除非在高级模式或日志导出中，否则不要直接显示这些词。
