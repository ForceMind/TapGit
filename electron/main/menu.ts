import path from 'node:path';
import { app, BrowserWindow, Menu } from 'electron';
import { APP_EVENTS, AppConfig, AppLanguagePreference, AppLocale } from '../../src/shared/contracts';

function isChineseLanguage(language: string) {
  return language.toLowerCase().startsWith('zh');
}

function toProjectLabel(projectPath: string) {
  return path.basename(projectPath) || projectPath;
}

function pickLabel(chinese: boolean, zh: string, en: string) {
  return chinese ? zh : en;
}

export function resolveMenuLocale(preference: AppLanguagePreference | undefined): AppLocale {
  if (preference === 'zh-CN' || preference === 'en-US') {
    return preference;
  }
  return isChineseLanguage(app.getLocale()) ? 'zh-CN' : 'en-US';
}

function sendMenuCommand(command: string) {
  const focused = BrowserWindow.getFocusedWindow();
  if (!focused) {
    return;
  }
  focused.webContents.send(APP_EVENTS.MENU_COMMAND, command);
}

export function applyAppMenu(config?: Pick<AppConfig, 'recentProjects' | 'settings'> | null) {
  const locale = resolveMenuLocale(config?.settings.language);
  const chinese = locale === 'zh-CN';
  const isMac = process.platform === 'darwin';
  const label = (zh: string, en: string) => pickLabel(chinese, zh, en);

  const recentProjectSubmenu: Electron.MenuItemConstructorOptions[] =
    config?.recentProjects.length
      ? config.recentProjects.map((projectPath) => ({
          label: toProjectLabel(projectPath),
          click: () => sendMenuCommand(`open-recent:${projectPath}`)
        }))
      : [
          {
            label: label('\u8fd8\u6ca1\u6709\u6700\u8fd1\u9879\u76ee', 'No recent projects yet'),
            enabled: false
          }
        ];

  const projectMenu: Electron.MenuItemConstructorOptions = {
    label: label('\u9879\u76ee', 'Project'),
    submenu: [
      {
        label: label('\u6253\u5f00\u672c\u5730\u9879\u76ee...', 'Open Local Project...'),
        accelerator: 'CmdOrCtrl+O',
        click: () => sendMenuCommand('open-project')
      },
      {
        label: label('\u4ece GitHub \u83b7\u53d6\u9879\u76ee...', 'Get Project from GitHub...'),
        accelerator: 'CmdOrCtrl+Shift+O',
        click: () => sendMenuCommand('clone-project')
      },
      {
        label: label('\u6700\u8fd1\u9879\u76ee', 'Recent Projects'),
        submenu: recentProjectSubmenu
      },
      {
        label: label('\u5728\u6587\u4ef6\u5939\u4e2d\u67e5\u770b\u9879\u76ee', 'Show Project in Folder'),
        click: () => sendMenuCommand('show-project-in-folder')
      },
      { type: 'separator' },
      {
        label: label('\u9879\u76ee\u9996\u9875', 'Project Home'),
        accelerator: 'CmdOrCtrl+1',
        click: () => sendMenuCommand('show-home')
      },
      ...(!isMac
        ? [
            { type: 'separator' as const },
            {
              role: 'quit' as const,
              label: label('\u9000\u51fa\u7801\u8ff9', 'Quit TapGit')
            }
          ]
        : [])
    ]
  };

  const progressMenu: Electron.MenuItemConstructorOptions = {
    label: label('\u8fdb\u5ea6', 'Progress'),
    submenu: [
      {
        label: label('\u5f53\u524d\u4fee\u6539', 'Current Changes'),
        accelerator: 'CmdOrCtrl+2',
        click: () => sendMenuCommand('show-changes')
      },
      {
        label: label('\u4fdd\u5b58\u8fd9\u6b21\u5de5\u4f5c', 'Save This Work'),
        accelerator: 'CmdOrCtrl+S',
        click: () => sendMenuCommand('save-all')
      },
      {
        label: label('\u5386\u53f2\u8bb0\u5f55', 'History'),
        accelerator: 'CmdOrCtrl+3',
        click: () => sendMenuCommand('show-timeline')
      }
    ]
  };

  const ideasMenu: Electron.MenuItemConstructorOptions = {
    label: label('\u8bd5\u65b0\u60f3\u6cd5', 'Try Ideas'),
    submenu: [
      {
        label: label('\u8bd5\u65b0\u60f3\u6cd5', 'Idea Lab'),
        accelerator: 'CmdOrCtrl+4',
        click: () => sendMenuCommand('show-plans')
      },
      {
        label: label('\u65b0\u5efa\u4e00\u4e2a\u8bd5\u9a8c\u526f\u672c...', 'Start New Idea Copy...'),
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => sendMenuCommand('create-idea-copy')
      },
      {
        label: label('\u56de\u5230\u7a33\u5b9a\u7248\u672c', 'Return to Stable Version'),
        click: () => sendMenuCommand('switch-to-stable')
      }
    ]
  };

  const cloudMenu: Electron.MenuItemConstructorOptions = {
    label: label('\u4e91\u7aef', 'Cloud'),
    submenu: [
      {
        label: label('\u4e0a\u4f20\u5230\u4e91\u7aef', 'Upload to Cloud'),
        click: () => sendMenuCommand('upload-cloud')
      },
      {
        label: label('\u83b7\u53d6\u4e91\u7aef\u6700\u65b0\u5185\u5bb9', 'Get Latest from Cloud'),
        click: () => sendMenuCommand('download-cloud')
      },
      {
        label: label('\u4e91\u7aef\u8bbe\u7f6e', 'Cloud Settings'),
        accelerator: 'CmdOrCtrl+5',
        click: () => sendMenuCommand('show-cloud')
      }
    ]
  };

  const helpMenu: Electron.MenuItemConstructorOptions = {
    label: label('\u5e2e\u52a9', 'Help'),
    submenu: [
      {
        label: label('\u5bfc\u51fa\u65e5\u5fd7', 'Export Logs'),
        click: () => sendMenuCommand('export-logs')
      },
      {
        role: 'about',
        label: label('\u5173\u4e8e\u7801\u8ff9', 'About TapGit')
      }
    ]
  };

  const template: Electron.MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: label('\u7801\u8ff9', 'TapGit'),
      submenu: [
        { role: 'about', label: label('\u5173\u4e8e\u7801\u8ff9', 'About TapGit') },
        { type: 'separator' },
        { role: 'hide', label: label('\u9690\u85cf\u7801\u8ff9', 'Hide TapGit') },
        { role: 'hideOthers', label: label('\u9690\u85cf\u5176\u4ed6', 'Hide Others') },
        { role: 'unhide', label: label('\u5168\u90e8\u663e\u793a', 'Show All') },
        { type: 'separator' },
        { role: 'quit', label: label('\u9000\u51fa\u7801\u8ff9', 'Quit TapGit') }
      ]
    });
  }

  template.push(projectMenu, progressMenu, ideasMenu, cloudMenu, helpMenu);

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
