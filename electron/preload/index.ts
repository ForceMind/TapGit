import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, TapGitBridge } from '../../src/shared/contracts';

const bridge: TapGitBridge = {
  chooseProjectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.CHOOSE_PROJECT_FOLDER),
  openProject: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_PROJECT, projectPath),
  enableProtection: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.ENABLE_PROTECTION, projectPath),
  getCurrentChanges: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.GET_CURRENT_CHANGES, projectPath),
  saveProgress: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_PROGRESS, payload),
  listHistory: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.LIST_HISTORY, projectPath),
  restoreToRecord: (projectPath, recordId) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESTORE_TO_RECORD, projectPath, recordId),
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
  getCloudSyncStatus: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.GET_CLOUD_SYNC_STATUS, projectPath),
  testCloudConnection: (projectPath, remoteUrl) =>
    ipcRenderer.invoke(IPC_CHANNELS.TEST_CLOUD_CONNECTION, projectPath, remoteUrl),
  connectCloud: (projectPath, remoteUrl) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONNECT_CLOUD, projectPath, remoteUrl),
  uploadToCloud: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_TO_CLOUD, projectPath),
  getCloudLatest: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.GET_CLOUD_LATEST, projectPath),
  exportLogs: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_LOGS)
};

contextBridge.exposeInMainWorld('tapgit', bridge);
