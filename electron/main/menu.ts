import { app, BrowserWindow, Menu } from 'electron';
import { APP_EVENTS, AppLanguagePreference, AppLocale } from '../../src/shared/contracts';

function isChineseLanguage(language: string) {
  return language.toLowerCase().startsWith('zh');
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

export function applyAppMenu(preference: AppLanguagePreference | undefined) {
  const locale = resolveMenuLocale(preference);
  const chinese = locale === 'zh-CN';
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: chinese ? '码迹' : 'TapGit',
      submenu: [
        { role: 'about', label: chinese ? '关于码迹' : 'About TapGit' },
        { type: 'separator' },
        { role: 'services', label: chinese ? '服务' : 'Services' },
        { type: 'separator' },
        { role: 'hide', label: chinese ? '隐藏码迹' : 'Hide TapGit' },
        { role: 'hideOthers', label: chinese ? '隐藏其他' : 'Hide Others' },
        { role: 'unhide', label: chinese ? '全部显示' : 'Show All' },
        { type: 'separator' },
        { role: 'quit', label: chinese ? '退出码迹' : 'Quit TapGit' }
      ]
    });
  }

  template.push(
    {
      label: chinese ? '文件' : 'File',
      submenu: [
        {
          label: chinese ? '打开项目…' : 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuCommand('open-project')
        },
        { type: 'separator' },
        isMac
          ? { role: 'close', label: chinese ? '关闭窗口' : 'Close Window' }
          : { role: 'quit', label: chinese ? '退出' : 'Quit' }
      ]
    },
    {
      label: chinese ? '编辑' : 'Edit',
      submenu: [
        { role: 'undo', label: chinese ? '撤销' : 'Undo' },
        { role: 'redo', label: chinese ? '重做' : 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: chinese ? '剪切' : 'Cut' },
        { role: 'copy', label: chinese ? '复制' : 'Copy' },
        { role: 'paste', label: chinese ? '粘贴' : 'Paste' },
        { role: 'selectAll', label: chinese ? '全选' : 'Select All' }
      ]
    },
    {
      label: chinese ? '查看' : 'View',
      submenu: [
        { role: 'reload', label: chinese ? '重新加载' : 'Reload' },
        { role: 'forceReload', label: chinese ? '强制重新加载' : 'Force Reload' },
        { type: 'separator' },
        { role: 'resetZoom', label: chinese ? '恢复默认缩放' : 'Actual Size' },
        { role: 'zoomIn', label: chinese ? '放大' : 'Zoom In' },
        { role: 'zoomOut', label: chinese ? '缩小' : 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: chinese ? '切换全屏' : 'Toggle Full Screen' }
      ]
    },
    {
      label: chinese ? '窗口' : 'Window',
      submenu: [
        { role: 'minimize', label: chinese ? '最小化' : 'Minimize' },
        { role: 'zoom', label: chinese ? '缩放窗口' : 'Zoom' }
      ]
    },
    {
      label: chinese ? '帮助' : 'Help',
      submenu: [
        {
          label: chinese ? '打开项目' : 'Open Project',
          click: () => sendMenuCommand('open-project')
        }
      ]
    }
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
