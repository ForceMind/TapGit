import { contextBridge, ipcRenderer } from 'electron';
import { APP_EVENTS, IPC_CHANNELS, TapGitBridge } from '../../src/shared/contracts';

const bridge: TapGitBridge = {
  chooseProjectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.CHOOSE_PROJECT_FOLDER),
  chooseCloneDestination: () => ipcRenderer.invoke(IPC_CHANNELS.CHOOSE_CLONE_DESTINATION),
  openProject: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_PROJECT, projectPath),
  cloneProjectFromGitHub: (payload) => ipcRenderer.invoke(IPC_CHANNELS.CLONE_PROJECT_FROM_GITHUB, payload),
  openInFileManager: (targetPath) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_IN_FILE_MANAGER, targetPath),
  enableProtection: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.ENABLE_PROTECTION, projectPath),
  getCurrentChanges: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.GET_CURRENT_CHANGES, projectPath),
  stopTrackingFile: (projectPath, filePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.STOP_TRACKING_FILE, projectPath, filePath),
  saveProgress: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_PROGRESS, payload),
  listHistory: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.LIST_HISTORY, projectPath),
  listSafetyBackups: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.LIST_SAFETY_BACKUPS, projectPath),
  restoreToRecord: (projectPath, recordId) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESTORE_TO_RECORD, projectPath, recordId),
  restoreToSafetyBackup: (projectPath, backupId) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESTORE_TO_SAFETY_BACKUP, projectPath, backupId),
  listPlans: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.LIST_PLANS, projectPath),
  createPlan: (projectPath, planName, fromPlan) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_PLAN, projectPath, planName, fromPlan),
  switchPlan: (projectPath, planName) => ipcRenderer.invoke(IPC_CHANNELS.SWITCH_PLAN, projectPath, planName),
  mergePlan: (projectPath, fromPlan, toPlan) =>
    ipcRenderer.invoke(IPC_CHANNELS.MERGE_PLAN, projectPath, fromPlan, toPlan),
  resolveCollision: (projectPath, filePath, strategy, manualContent) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESOLVE_COLLISION, projectPath, filePath, strategy, manualContent),
  completeMerge: (projectPath, message) => ipcRenderer.invoke(IPC_CHANNELS.COMPLETE_MERGE, projectPath, message),
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  updateSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, settings),
  checkGitEnvironment: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_GIT_ENVIRONMENT),
  getGitHubAuthStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_GITHUB_AUTH_STATUS),
  loginGitHub: (username) => ipcRenderer.invoke(IPC_CHANNELS.LOGIN_GITHUB, username),
  logoutGitHub: (account) => ipcRenderer.invoke(IPC_CHANNELS.LOGOUT_GITHUB, account),
  getCloudSyncStatus: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.GET_CLOUD_SYNC_STATUS, projectPath),
  testCloudConnection: (projectPath, remoteUrl, preferredAccount) =>
    ipcRenderer.invoke(IPC_CHANNELS.TEST_CLOUD_CONNECTION, projectPath, remoteUrl, preferredAccount),
  connectCloud: (projectPath, remoteUrl, preferredAccount) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONNECT_CLOUD, projectPath, remoteUrl, preferredAccount),
  uploadToCloud: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_TO_CLOUD, projectPath),
  getCloudLatest: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.GET_CLOUD_LATEST, projectPath),
  exportLogs: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_LOGS),
  openExternalUrl: (url) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL_URL, url)
};

contextBridge.exposeInMainWorld('tapgit', bridge);

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.on(APP_EVENTS.MENU_COMMAND, (_, command: string) => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.MENU_COMMAND, { detail: command }));
  });
});
