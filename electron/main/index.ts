import path from 'node:path';
import { app, BrowserWindow, shell } from 'electron';
import { getConfig } from './config-store';
import { registerIpcHandlers } from './ipc';
import { logInfo } from './logger';
import { applyAppMenu } from './menu';

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
let win: BrowserWindow | null = null;

function isChineseSystemLocale() {
  return app.getLocale().toLowerCase().startsWith('zh');
}

function createWindow() {
  const appPath = app.getAppPath();
  const preloadPath = path.join(appPath, 'dist-electron', 'preload', 'index.js');
  const rendererIndex = path.join(appPath, 'dist', 'index.html');
  const chinese = isChineseSystemLocale();

  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 720,
    title: chinese ? '码迹' : 'TapGit',
    backgroundColor: '#f4f8fb',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(rendererIndex);
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  const config = await getConfig().catch(() => null);
  applyAppMenu(config);
  createWindow();
  await logInfo('APP_READY', 'TapGit is ready');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});
