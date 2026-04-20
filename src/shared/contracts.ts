export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: string } };

export interface ProjectSummary {
  path: string;
  name: string;
  isProtected: boolean;
  currentPlan: string;
  pendingChangeCount: number;
}

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

export interface ChangeItem {
  path: string;
  changeType: ChangeType;
  statusLabel: string;
  additions: number;
  deletions: number;
  diffText: string;
}

export interface SaveProgressPayload {
  projectPath: string;
  message: string;
  selectedFiles?: string[];
}

export interface CloneProjectPayload {
  remoteUrl: string;
  destinationDirectory: string;
  folderName?: string;
  preferredAccount?: string;
}

export interface SaveProgressResult {
  recordId: string;
  savedFiles: number;
  message: string;
}

export interface HistoryRecord {
  id: string;
  message: string;
  timestamp: number;
  changedFiles: number;
  files: string[];
}

export interface SafetyBackup {
  id: string;
  name: string;
  createdAt: number | null;
  lastMessage: string;
  source: 'restore' | 'merge' | 'unknown';
}

export interface PlanInfo {
  id: string;
  name: string;
  isCurrent: boolean;
  isMain: boolean;
  lastSavedAt: number | null;
  lastMessage: string;
}

export interface MergeConflict {
  filePath: string;
  currentContent: string;
  incomingContent: string;
}

export interface MergeResult {
  status: 'merged' | 'needs_decision';
  message: string;
  conflicts: MergeConflict[];
}

export type ResolveStrategy = 'keepCurrent' | 'keepIncoming' | 'manual';

export interface AppSettings {
  showAdvancedMode: boolean;
  showBeginnerGuide: boolean;
  autoSnapshotBeforeRestore: boolean;
  autoSnapshotBeforeMerge: boolean;
  defaultSaveMessageTemplate: string;
  language: AppLanguagePreference;
}

export interface AppConfig {
  recentProjects: string[];
  settings: AppSettings;
}

export interface GitEnvironment {
  available: boolean;
  version: string;
}

export interface GitHubAuthStatus {
  available: boolean;
  accounts: string[];
  activeAccount: string | null;
}

export interface CloudSyncStatus {
  connected: boolean;
  remoteLabel: string;
  remoteUrl: string;
  currentPlan: string;
  hasTracking: boolean;
  pendingUpload: number;
  pendingDownload: number;
  statusText: string;
  preferredAccount?: string | null;
}

export interface CloudConnectionTestResult {
  code: CloudConnectionCode;
  reachable: boolean;
  requiresAuth: boolean;
  message: string;
}

export type AppLocale = 'en-US' | 'zh-CN';
export type AppLanguagePreference = 'auto' | AppLocale;
export type CloudConnectionCode =
  | 'ok'
  | 'auth_required'
  | 'not_found'
  | 'network_error'
  | 'unknown_error';

export interface TapGitBridge {
  chooseProjectFolder(): Promise<Result<string | null>>;
  chooseCloneDestination(): Promise<Result<string | null>>;
  openProject(projectPath: string): Promise<Result<ProjectSummary>>;
  cloneProjectFromGitHub(payload: CloneProjectPayload): Promise<Result<ProjectSummary>>;
  openInFileManager(targetPath: string): Promise<Result<void>>;
  enableProtection(projectPath: string): Promise<Result<ProjectSummary>>;
  getCurrentChanges(projectPath: string): Promise<Result<ChangeItem[]>>;
  stopTrackingFile(projectPath: string, filePath: string): Promise<Result<void>>;
  saveProgress(payload: SaveProgressPayload): Promise<Result<SaveProgressResult>>;
  listHistory(projectPath: string): Promise<Result<HistoryRecord[]>>;
  listSafetyBackups(projectPath: string): Promise<Result<SafetyBackup[]>>;
  restoreToRecord(projectPath: string, recordId: string): Promise<Result<void>>;
  restoreToSafetyBackup(projectPath: string, backupId: string): Promise<Result<void>>;
  listPlans(projectPath: string): Promise<Result<PlanInfo[]>>;
  createPlan(
    projectPath: string,
    planName: string,
    fromPlan?: string
  ): Promise<Result<void>>;
  switchPlan(projectPath: string, planName: string): Promise<Result<void>>;
  mergePlan(projectPath: string, fromPlan: string, toPlan: string): Promise<Result<MergeResult>>;
  resolveCollision(
    projectPath: string,
    filePath: string,
    strategy: ResolveStrategy,
    manualContent?: string
  ): Promise<Result<MergeResult>>;
  completeMerge(projectPath: string, message?: string): Promise<Result<void>>;
  getConfig(): Promise<Result<AppConfig>>;
  updateSettings(settings: Partial<AppSettings>): Promise<Result<AppSettings>>;
  checkGitEnvironment(): Promise<Result<GitEnvironment>>;
  getGitHubAuthStatus(): Promise<Result<GitHubAuthStatus>>;
  loginGitHub(username?: string): Promise<Result<GitHubAuthStatus>>;
  logoutGitHub(account: string): Promise<Result<GitHubAuthStatus>>;
  getCloudSyncStatus(projectPath: string): Promise<Result<CloudSyncStatus>>;
  testCloudConnection(
    projectPath: string,
    remoteUrl: string,
    preferredAccount?: string
  ): Promise<Result<CloudConnectionTestResult>>;
  connectCloud(
    projectPath: string,
    remoteUrl: string,
    preferredAccount?: string
  ): Promise<Result<CloudSyncStatus>>;
  uploadToCloud(projectPath: string): Promise<Result<CloudSyncStatus>>;
  getCloudLatest(projectPath: string): Promise<Result<CloudSyncStatus>>;
  exportLogs(): Promise<Result<string>>;
  openExternalUrl(url: string): Promise<Result<void>>;
}

export const IPC_CHANNELS = {
  CHOOSE_PROJECT_FOLDER: 'tapgit:choose-project-folder',
  CHOOSE_CLONE_DESTINATION: 'tapgit:choose-clone-destination',
  OPEN_PROJECT: 'tapgit:open-project',
  CLONE_PROJECT_FROM_GITHUB: 'tapgit:clone-project-from-github',
  OPEN_IN_FILE_MANAGER: 'tapgit:open-in-file-manager',
  ENABLE_PROTECTION: 'tapgit:enable-protection',
  GET_CURRENT_CHANGES: 'tapgit:get-current-changes',
  STOP_TRACKING_FILE: 'tapgit:stop-tracking-file',
  SAVE_PROGRESS: 'tapgit:save-progress',
  LIST_HISTORY: 'tapgit:list-history',
  LIST_SAFETY_BACKUPS: 'tapgit:list-safety-backups',
  RESTORE_TO_RECORD: 'tapgit:restore-to-record',
  RESTORE_TO_SAFETY_BACKUP: 'tapgit:restore-to-safety-backup',
  LIST_PLANS: 'tapgit:list-plans',
  CREATE_PLAN: 'tapgit:create-plan',
  SWITCH_PLAN: 'tapgit:switch-plan',
  MERGE_PLAN: 'tapgit:merge-plan',
  RESOLVE_COLLISION: 'tapgit:resolve-collision',
  COMPLETE_MERGE: 'tapgit:complete-merge',
  GET_CONFIG: 'tapgit:get-config',
  UPDATE_SETTINGS: 'tapgit:update-settings',
  CHECK_GIT_ENVIRONMENT: 'tapgit:check-git-environment',
  GET_GITHUB_AUTH_STATUS: 'tapgit:get-github-auth-status',
  LOGIN_GITHUB: 'tapgit:login-github',
  LOGOUT_GITHUB: 'tapgit:logout-github',
  GET_CLOUD_SYNC_STATUS: 'tapgit:get-cloud-sync-status',
  TEST_CLOUD_CONNECTION: 'tapgit:test-cloud-connection',
  CONNECT_CLOUD: 'tapgit:connect-cloud',
  UPLOAD_TO_CLOUD: 'tapgit:upload-to-cloud',
  GET_CLOUD_LATEST: 'tapgit:get-cloud-latest',
  EXPORT_LOGS: 'tapgit:export-logs',
  OPEN_EXTERNAL_URL: 'tapgit:open-external-url'
} as const;

export const APP_EVENTS = {
  MENU_COMMAND: 'tapgit:menu-command'
} as const;
