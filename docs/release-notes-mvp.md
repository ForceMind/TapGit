# 码迹 TapGit MVP 发布说明

发布日期：2026-04-09

## 版本目标

这一版聚焦普通用户最核心的四件事：

- 保存进度
- 查看历史
- 切换方案
- 恢复版本

## 已交付能力

- 打开项目并开启版本保护
- 查看当前修改和差异详情
- 保存进度，支持全部保存和部分保存
- 保存记录时间线与详情查看
- 恢复到历史保存点，并在恢复前给出安全确认
- 创建、切换、合并方案
- 合并时的冲突处理界面
- 冲突处理进度提示与批量保留某一侧
- 首页“下一步做什么”状态面板
- 云端连接助手
- GitHub 应用内登录状态查看、登录和退出
- 中英文界面与系统语言自动跟随
- GitHub Actions 自动打包 Windows / macOS 产物

## 打包支持

当前打包产物：

- Windows：`.exe`、`win-unpacked`
- macOS：`.dmg`、`.zip`

当前说明：

- Windows 打包已完成本地验证
- macOS 打包已接入 GitHub Actions 的 macOS runner
- macOS 当前为未签名测试包，尚未接入签名与 notarization

## 已修复

- 修复安装包启动时报 `require("fs")` 的主进程打包问题
- 修复恢复历史使用浏览器原生确认框的问题，改为应用内安全确认弹层
- 修复首页和设置页部分流程不够直观的问题，增加状态引导与连接助手

## 验证结果

- `npm run test`：通过
- `npm run build`：通过
- `npm run pack:dir`：通过
- `npm run pack:win`：通过

说明：

- 当前开发环境是 Windows，本地未直接生成 macOS 安装包
- macOS 产物依赖 GitHub Actions 的 macOS runner 验证

## 已知限制

- GitLab 仍未接入应用内登录管理
- macOS 仍未做签名和 notarization
- 构建日志仍有第三方插件警告，但当前不影响产物输出

## 下一阶段建议

- 接入 macOS 签名与 notarization
- 为 GitLab 增加应用内登录状态管理
- 清理 Vite / Rollup 构建警告
- 增加安全快照可视化入口，让恢复和合并前的自动快照可见、可回退
