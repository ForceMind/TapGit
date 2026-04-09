import path from 'node:path';
import { app, BrowserWindow, Menu } from 'electron';
import { APP_EVENTS, AppConfig, AppLanguagePreference, AppLocale } from '../../src/shared/contracts';

function isChineseLanguage(language: string) {
  return language.toLowerCase().startsWith('zh');
}

function toProjectLabel(projectPath: string) {
  return path.basename(projectPath) || projectPath;
}

export function resolveMenuLocale(preference: AppLanguagePreference | undefined): AppLocale {
  if (preference === 'zh-CN' || preference === 'en-US') {
    return preference;
  }
  return isChineseLanguage(app.getLocale()) ? 'zh-CN' : 'en-US';
}

function sendMenuCommand(command: string) {
  const focused = BrowserWindow.getFocusedWindow();
  if (!focused) return;
  focused.webContents.send(APP_EVENTS.MENU_COMMAND, command);
}

export function applyAppMenu(config?: Pick<AppConfig, 'recentProjects' | 'settings'> | null) {
  const locale = resolveMenuLocale(config?.settings.language);
  const chinese = locale === 'zh-CN';
  const isMac = process.platform === 'darwin';

  const recentProjectSubmenu: Electron.MenuItemConstructorOptions[] =
    config?.recentProjects.length
      ? config.recentProjects.map((projectPath) => ({
          label: toProjectLabel(projectPath),
          click: () => sendMenuCommand(`open-recent:${projectPath}`)
        }))
      : [
          {
            label: chinese ? '还没有最近项目' : 'No recent projects yet',
            enabled: false
          }
        ];

  const projectMenu: Electron.MenuItemConstructorOptions = {
    label: chinese ? '项目' : 'Project',
    submenu: [
      {
        label: chinese ? '打开本地项目…' : 'Open Local Project...',
        accelerator: 'CmdOrCtrl+O',
        click: () => sendMenuCommand('open-project')
      },
      {
        label: chinese ? '从 GitHub 获取项目…' : 'Get Project from GitHub...',
        accelerator: 'CmdOrCtrl+Shift+O',
        click: () => sendMenuCommand('clone-project')
      },
      {
        label: chinese ? '最近项目' : 'Recent Projects',
        submenu: recentProjectSubmenu
      },
      {
        label: chinese ? '打开当前项目位置' : 'Show Current Project in Folder',
        click: () => sendMenuCommand('show-project-in-folder')
      },
      { type: 'separator' },
      {
        label: chinese ? '回到首页' : 'Go to Home',
        accelerator: 'CmdOrCtrl+1',
        click: () => sendMenuCommand('show-home')
      },
      { type: 'separator' },
      isMac
        ? { role: 'close', label: chinese ? '关闭窗口' : 'Close Window' }
        : { role: 'quit', label: chinese ? '退出码迹' : 'Quit TapGit' }
    ]
  };

  const progressMenu: Electron.MenuItemConstructorOptions = {
    label: chinese ? '进度' : 'Progress',
    submenu: [
      {
        label: chinese ? '查看当前修改' : 'Current Changes',
        accelerator: 'CmdOrCtrl+2',
        click: () => sendMenuCommand('show-changes')
      },
      {
        label: chinese ? '保存全部修改' : 'Save All Changes',
        accelerator: 'CmdOrCtrl+S',
        click: () => sendMenuCommand('save-all')
      },
      {
        label: chinese ? '查看保存记录' : 'Saved Records',
        accelerator: 'CmdOrCtrl+3',
        click: () => sendMenuCommand('show-timeline')
      }
    ]
  };

  const ideasMenu: Electron.MenuItemConstructorOptions = {
    label: chinese ? '试新想法' : 'Try Ideas',
    submenu: [
      {
        label: chinese ? '开一个想法副本…' : 'Start a New Idea Copy...',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => sendMenuCommand('create-idea-copy')
      },
      {
        label: chinese ? '打开试新想法页' : 'Open Try Ideas',
        accelerator: 'CmdOrCtrl+4',
        click: () => sendMenuCommand('show-plans')
      },
      {
        label: chinese ? '切回稳定版本' : 'Switch to Stable Version',
        click: () => sendMenuCommand('switch-to-stable')
      }
    ]
  };

  const cloudMenu: Electron.MenuItemConstructorOptions = {
    label: chinese ? '云端' : 'Cloud',
    submenu: [
      {
        label: chinese ? '打开云端设置' : 'Open Cloud Settings',
        accelerator: 'CmdOrCtrl+5',
        click: () => sendMenuCommand('show-cloud')
      },
      {
        label: chinese ? '上传到云端' : 'Upload to Cloud',
        click: () => sendMenuCommand('upload-cloud')
      },
      {
        label: chinese ? '获取最新内容' : 'Get Latest from Cloud',
        click: () => sendMenuCommand('download-cloud')
      }
    ]
  };

  const helpMenu: Electron.MenuItemConstructorOptions = {
    label: chinese ? '帮助' : 'Help',
    submenu: [
      {
        label: chinese ? '设置与问题诊断' : 'Settings and Troubleshooting',
        click: () => sendMenuCommand('show-settings')
      },
      {
        label: chinese ? '导出日志' : 'Export Logs',
        click: () => sendMenuCommand('export-logs')
      },
      { type: 'separator' },
      { role: 'about', label: chinese ? '关于码迹' : 'About TapGit' }
    ]
  };

  const template: Electron.MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: chinese ? '码迹' : 'TapGit',
      submenu: [
        { role: 'about', label: chinese ? '关于码迹' : 'About TapGit' },
        { type: 'separator' },
        { role: 'hide', label: chinese ? '隐藏码迹' : 'Hide TapGit' },
        { role: 'hideOthers', label: chinese ? '隐藏其他' : 'Hide Others' },
        { role: 'unhide', label: chinese ? '全部显示' : 'Show All' },
        { type: 'separator' },
        { role: 'quit', label: chinese ? '退出码迹' : 'Quit TapGit' }
      ]
    });
  }

  template.push(projectMenu, progressMenu, ideasMenu, cloudMenu, helpMenu);

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
