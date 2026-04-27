import fs from 'node:fs/promises';
import path from 'node:path';
import { app, dialog, ipcMain, shell } from 'electron';
import { IPC_CHANNELS, Result, TapGitBridge } from '../../src/shared/contracts';
import { normalizeUnknownError } from './app-error';
import { getGitHubAuthStatus, loginGitHub, logoutGitHub } from './auth-service';
import { addRecentProject, getConfig, updateSettings } from './config-store';
import {
  checkGitEnvironment,
  cloneProjectFromGitHub,
  connectCloud,
  completeMerge,
  createPlan,
  createSafetyBackup,
  discardAllChanges,
  enableProtection,
  getCloudLatest,
  getCloudSyncStatus,
  getCurrentChanges,
  getProjectOverview,
  listHistory,
  listSafetyBackups,
  listPlans,
  mergePlan,
  openProject,
  resolveCollision,
  restoreToSafetyBackup,
  restoreToRecord,
  saveProgress,
  stopTrackingFile,
  switchPlan,
  testCloudConnection,
  uploadToCloud
} from './git-service';
import { getCurrentLogFilePath, logError, logInfo } from './logger';
import { applyAppMenu } from './menu';

function success<T>(data: T): Result<T> {
  return { ok: true, data };
}

function failure(error: unknown): Result<never> {
  const normalized = normalizeUnknownError(error);
  return {
    ok: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details
    }
  };
}

function register<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (...args: TArgs) => Promise<TResult>
) {
  ipcMain.handle(channel, async (_, ...args: TArgs) => {
    try {
      const data = await handler(...args);
      return success(data);
    } catch (error) {
      const normalized = normalizeUnknownError(error);
      await logError(channel, `${normalized.code} ${normalized.message} ${normalized.details ?? ''}`);
      return failure(normalized);
    }
  });
}

function isChineseSystemLocale() {
  return app.getLocale().toLowerCase().startsWith('zh');
}

export function registerIpcHandlers() {
  register<[], string | null>(IPC_CHANNELS.CHOOSE_PROJECT_FOLDER, async () => {
    const chinese = isChineseSystemLocale();
    const result = await dialog.showOpenDialog({
      title: chinese ? '选择项目文件夹' : 'Choose Project Folder',
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  register<[], string | null>(IPC_CHANNELS.CHOOSE_CLONE_DESTINATION, async () => {
    const chinese = isChineseSystemLocale();
    const result = await dialog.showOpenDialog({
      title: chinese ? '选择项目保存位置' : 'Choose Where to Save the Project',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  register<[string], Awaited<ReturnType<typeof openProject>>>(IPC_CHANNELS.OPEN_PROJECT, async (projectPath) => {
    const summary = await openProject(projectPath);
    const nextConfig = await addRecentProject(projectPath);
    applyAppMenu(nextConfig);
    await logInfo('OPEN_PROJECT', projectPath);
    return summary;
  });

  register<[string], Awaited<ReturnType<typeof getProjectOverview>>>(
    IPC_CHANNELS.GET_PROJECT_OVERVIEW,
    getProjectOverview
  );

  register<[Parameters<TapGitBridge['cloneProjectFromGitHub']>[0]], Awaited<ReturnType<typeof cloneProjectFromGitHub>>>(
    IPC_CHANNELS.CLONE_PROJECT_FROM_GITHUB,
    async (payload) => {
      const summary = await cloneProjectFromGitHub(payload);
      const nextConfig = await addRecentProject(summary.path);
      applyAppMenu(nextConfig);
      await logInfo('CLONE_PROJECT_FROM_GITHUB', summary.path);
      return summary;
    }
  );

  register<[string], void>(IPC_CHANNELS.OPEN_IN_FILE_MANAGER, async (targetPath) => {
    const stat = await fs.stat(targetPath).catch(() => null);
    if (stat?.isFile()) {
      shell.showItemInFolder(targetPath);
      return;
    }

    const directory = stat?.isDirectory() ? targetPath : path.dirname(targetPath);
    const result = await shell.openPath(directory);
    if (result) {
      throw new Error(result);
    }
  });

  register<[string], Awaited<ReturnType<typeof enableProtection>>>(
    IPC_CHANNELS.ENABLE_PROTECTION,
    async (projectPath) => {
      const summary = await enableProtection(projectPath);
      await addRecentProject(projectPath);
      await logInfo('ENABLE_PROTECTION', projectPath);
      return summary;
    }
  );

  register<[string], Awaited<ReturnType<typeof getCurrentChanges>>>(
    IPC_CHANNELS.GET_CURRENT_CHANGES,
    getCurrentChanges
  );
  register<[string, string], void>(IPC_CHANNELS.STOP_TRACKING_FILE, stopTrackingFile);
  register<[string], void>(IPC_CHANNELS.DISCARD_ALL_CHANGES, discardAllChanges);
  register<[Parameters<TapGitBridge['saveProgress']>[0]], Awaited<ReturnType<typeof saveProgress>>>(
    IPC_CHANNELS.SAVE_PROGRESS,
    saveProgress
  );
  register<[string], Awaited<ReturnType<typeof listHistory>>>(IPC_CHANNELS.LIST_HISTORY, listHistory);
  register<[string], Awaited<ReturnType<typeof listSafetyBackups>>>(
    IPC_CHANNELS.LIST_SAFETY_BACKUPS,
    listSafetyBackups
  );
  register<[string], Awaited<ReturnType<typeof createSafetyBackup>>>(
    IPC_CHANNELS.CREATE_SAFETY_BACKUP,
    createSafetyBackup
  );

  register<[string, string], void>(IPC_CHANNELS.RESTORE_TO_RECORD, async (projectPath, recordId) => {
    const config = await getConfig();
    await restoreToRecord(projectPath, recordId, config.settings.autoSnapshotBeforeRestore);
  });
  register<[string, string], void>(IPC_CHANNELS.RESTORE_TO_SAFETY_BACKUP, async (projectPath, backupId) => {
    const config = await getConfig();
    await restoreToSafetyBackup(projectPath, backupId, config.settings.autoSnapshotBeforeRestore);
  });

  register<[string], Awaited<ReturnType<typeof listPlans>>>(IPC_CHANNELS.LIST_PLANS, listPlans);
  register<[string, string, string | undefined], void>(IPC_CHANNELS.CREATE_PLAN, createPlan);
  register<[string, string], void>(IPC_CHANNELS.SWITCH_PLAN, switchPlan);

  register<[string, string, string], Awaited<ReturnType<typeof mergePlan>>>(
    IPC_CHANNELS.MERGE_PLAN,
    async (projectPath, fromPlan, toPlan) => {
      const config = await getConfig();
      return mergePlan(projectPath, fromPlan, toPlan, config.settings.autoSnapshotBeforeMerge);
    }
  );

  register<[string, string, Parameters<TapGitBridge['resolveCollision']>[2], string | undefined], Awaited<ReturnType<typeof resolveCollision>>>(
    IPC_CHANNELS.RESOLVE_COLLISION,
    resolveCollision
  );

  register<[string, string | undefined], void>(IPC_CHANNELS.COMPLETE_MERGE, completeMerge);
  register<[], Awaited<ReturnType<typeof getConfig>>>(IPC_CHANNELS.GET_CONFIG, getConfig);
  register<[Parameters<TapGitBridge['updateSettings']>[0]], Awaited<ReturnType<typeof updateSettings>>>(
    IPC_CHANNELS.UPDATE_SETTINGS,
    async (partial) => {
      const settings = await updateSettings(partial);
      const config = await getConfig();
      applyAppMenu(config);
      return settings;
    }
  );
  register<[], Awaited<ReturnType<typeof checkGitEnvironment>>>(
    IPC_CHANNELS.CHECK_GIT_ENVIRONMENT,
    checkGitEnvironment
  );
  register<[], Awaited<ReturnType<typeof getGitHubAuthStatus>>>(
    IPC_CHANNELS.GET_GITHUB_AUTH_STATUS,
    getGitHubAuthStatus
  );
  register<[string | undefined], Awaited<ReturnType<typeof loginGitHub>>>(IPC_CHANNELS.LOGIN_GITHUB, loginGitHub);
  register<[string], Awaited<ReturnType<typeof logoutGitHub>>>(
    IPC_CHANNELS.LOGOUT_GITHUB,
    logoutGitHub
  );
  register<[string], Awaited<ReturnType<typeof getCloudSyncStatus>>>(
    IPC_CHANNELS.GET_CLOUD_SYNC_STATUS,
    getCloudSyncStatus
  );
  register<[string, string, string | undefined], Awaited<ReturnType<typeof testCloudConnection>>>(
    IPC_CHANNELS.TEST_CLOUD_CONNECTION,
    testCloudConnection
  );
  register<[string, string, string | undefined], Awaited<ReturnType<typeof connectCloud>>>(
    IPC_CHANNELS.CONNECT_CLOUD,
    connectCloud
  );
  register<[string], Awaited<ReturnType<typeof uploadToCloud>>>(
    IPC_CHANNELS.UPLOAD_TO_CLOUD,
    uploadToCloud
  );
  register<[string], Awaited<ReturnType<typeof getCloudLatest>>>(
    IPC_CHANNELS.GET_CLOUD_LATEST,
    getCloudLatest
  );

  register<[], string>(IPC_CHANNELS.EXPORT_LOGS, async () => {
    const chinese = isChineseSystemLocale();
    const logFilePath = getCurrentLogFilePath();
    const fileName = `tapgit-log-${Date.now()}.log`;
    const defaultPath = path.join(app.getPath('downloads'), fileName);
    const saveResult = await dialog.showSaveDialog({
      title: chinese ? '导出日志' : 'Export Logs',
      defaultPath,
      filters: [{ name: chinese ? '日志文件' : 'Log Files', extensions: ['log'] }]
    });
    if (saveResult.canceled || !saveResult.filePath) {
      return '';
    }
    await fs.copyFile(logFilePath, saveResult.filePath);
    return saveResult.filePath;
  });

  register<[string], void>(IPC_CHANNELS.OPEN_EXTERNAL_URL, async (url) => {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Only http(s) URLs are allowed.');
    }
    await shell.openExternal(url);
  });
}
