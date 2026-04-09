import path from 'node:path';
import { app, BrowserWindow, Menu } from 'electron';
import { APP_EVENTS, AppConfig, AppLanguagePreference, AppLocale } from '../../src/shared/contracts';

function isChineseLanguage(language: string) {
  return language.toLowerCase().startsWith('zh');
}

function toProjectLabel(projectPath: string) {
  return path.basename(projectPath) || projectPath;
}

function zh(text: string) {
  return text;
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
            label: chinese ? zh('还没有最近项目') : 'No recent projects yet',
            enabled: false
          }
        ];

  const projectMenu: Electron.MenuItemConstructorOptions = {
    label: chinese ? zh('项目') : 'Project',
    submenu: [
      {
        label: chinese ? zh('打开本地项目...') : 'Open Local Project...',
        accelerator: 'CmdOrCtrl+O',
        click: () => sendMenuCommand('open-project')
      },
      {
        label: chinese ? zh('从 GitHub 获取项目...') : 'Get Project from GitHub...',
        accelerator: 'CmdOrCtrl+Shift+O',
        click: () => sendMenuCommand('clone-project')
      },
      {
        label: chinese ? zh('最近项目') : 'Recent Projects',
        submenu: recentProjectSubmenu
      },
      {
        label: chinese ? zh('在文件夹中查看项目') : 'Show Project in Folder',
        click: () => sendMenuCommand('show-project-in-folder')
      },
      { type: 'separator' },
      {
        label: chinese ? zh('项目概览') : 'Project Overview',
        accelerator: 'CmdOrCtrl+1',
        click: () => sendMenuCommand('show-home')
      },
      { type: 'separator' },
      isMac
        ? { role: 'close', label: chinese ? zh('关闭窗口') : 'Close Window' }
        : { role: 'quit', label: chinese ? zh('退出码迹') : 'Quit TapGit' }
    ]
  };

  const changesMenu: Electron.MenuItemConstructorOptions = {
    label: chinese ? zh('修改') : 'Changes',
    submenu: [
      {
        label: chinese ? zh('打开当前修改') : 'Open Changes',
        accelerator: 'CmdOrCtrl+2',
        click: () => sendMenuCommand('show-changes')
      },
      {
        label: chinese ? zh('保存这次进度') : 'Save Current Progress',
        accelerator: 'CmdOrCtrl+S',
        click: () => sendMenuCommand('save-all')
      },
      {
        label: chinese ? zh('打开历史') : 'Open History',
        accelerator: 'CmdOrCtrl+3',
        click: () => sendMenuCommand('show-timeline')
      }
    ]
  };

  const ideasMenu: Electron.MenuItemConstructorOptions = {
    label: chinese ? zh('试验区') : 'Idea Lab',
    submenu: [
      {
        label: chinese ? zh('新建试验副本...') : 'Start New Idea Copy...',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => sendMenuCommand('create-idea-copy')
      },
      {
        label: chinese ? zh('打开试验区') : 'Open Idea Lab',
        accelerator: 'CmdOrCtrl+4',
        click: () => sendMenuCommand('show-plans')
      },
      {
        label: chinese ? zh('回到稳定版本') : 'Return to Stable Version',
        click: () => sendMenuCommand('switch-to-stable')
      }
    ]
  };

  const cloudMenu: Electron.MenuItemConstructorOptions = {
    label: chinese ? zh('云端') : 'Cloud',
    submenu: [
      {
        label: chinese ? zh('打开云端设置') : 'Open Cloud Settings',
        accelerator: 'CmdOrCtrl+5',
        click: () => sendMenuCommand('show-cloud')
      },
      {
        label: chinese ? zh('上传到云端') : 'Upload to Cloud',
        click: () => sendMenuCommand('upload-cloud')
      },
      {
        label: chinese ? zh('获取云端最新内容') : 'Get Latest from Cloud',
        click: () => sendMenuCommand('download-cloud')
      }
    ]
  };

  const moreMenu: Electron.MenuItemConstructorOptions = {
    label: chinese ? zh('更多') : 'More',
    submenu: [
      {
        label: chinese ? zh('设置与问题诊断') : 'Settings and Troubleshooting',
        click: () => sendMenuCommand('show-settings')
      },
      {
        label: chinese ? zh('导出日志') : 'Export Logs',
        click: () => sendMenuCommand('export-logs')
      },
      { type: 'separator' },
      { role: 'about', label: chinese ? zh('关于码迹') : 'About TapGit' }
    ]
  };

  const template: Electron.MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: chinese ? zh('码迹') : 'TapGit',
      submenu: [
        { role: 'about', label: chinese ? zh('关于码迹') : 'About TapGit' },
        { type: 'separator' },
        { role: 'hide', label: chinese ? zh('隐藏码迹') : 'Hide TapGit' },
        { role: 'hideOthers', label: chinese ? zh('隐藏其他') : 'Hide Others' },
        { role: 'unhide', label: chinese ? zh('全部显示') : 'Show All' },
        { type: 'separator' },
        { role: 'quit', label: chinese ? zh('退出码迹') : 'Quit TapGit' }
      ]
    });
  }

  template.push(projectMenu, changesMenu, ideasMenu, cloudMenu, moreMenu);

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
