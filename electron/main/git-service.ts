import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { simpleGit } from 'simple-git';
import {
  ChangeItem,
  CloneProjectPayload,
  CloudConnectionTestResult,
  CloudSyncStatus,
  GitEnvironment,
  HistoryRecord,
  MergeConflict,
  MergeResult,
  PlanInfo,
  ProjectFileEntry,
  ProjectOverview,
  ProjectSummary,
  ResolveStrategy,
  SafetyBackup,
  SaveProgressPayload,
  SaveProgressResult
} from '../../src/shared/contracts';
import {
  applyPreferredAccountToRemoteUrl,
  isGitHubRemoteUrl,
  parseRemoteUrl
} from '../../src/shared/remote-url';
import { AppError } from './app-error';

const execFileAsync = promisify(execFile);
const SAFETY_PREFIX = 'safety/';
const REF_FIELD_DELIMITER = ':::';
const PROJECT_SIZE_SCAN_LIMIT = 3000;
const PROJECT_OVERVIEW_FILE_LIMIT = 6;
const IGNORED_SIZE_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'release',
  'dist',
  'dist-electron',
  '.next',
  'out',
  'build'
]);

function createGit(projectPath: string) {
  return simpleGit({
    baseDir: projectPath,
    binary: 'git',
    maxConcurrentProcesses: 6,
    trimmed: false
  });
}

function mapChangeType(index: string, workingDir: string): ChangeItem['changeType'] {
  if (index === '?' || workingDir === '?') {
    return 'added';
  }
  if (index === 'D' || workingDir === 'D') {
    return 'deleted';
  }
  if (index === 'R' || workingDir === 'R') {
    return 'renamed';
  }
  return 'modified';
}

function mapStatusLabel(changeType: ChangeItem['changeType']) {
  switch (changeType) {
    case 'added':
      return 'Added';
    case 'modified':
      return 'Modified';
    case 'deleted':
      return 'Deleted';
    case 'renamed':
      return 'Renamed';
    default:
      return 'Modified';
  }
}

function formatSnapshotName(source: SafetyBackup['source']) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  return `${SAFETY_PREFIX}${source}-${yyyy}${mm}${dd}-${hh}${min}${sec}`;
}

function isSafetyBackupRef(name: string) {
  return name.startsWith(SAFETY_PREFIX);
}

function parseSafetyBackupSource(name: string): SafetyBackup['source'] {
  const raw = name.slice(SAFETY_PREFIX.length);
  if (raw.startsWith('restore-')) return 'restore';
  if (raw.startsWith('merge-')) return 'merge';
  if (raw.startsWith('manual-')) return 'manual';
  if (raw.startsWith('discard-')) return 'discard';
  return 'unknown';
}

function parseSafetyBackupCreatedAt(name: string, fallbackTimestamp: number | null) {
  const raw = name.slice(SAFETY_PREFIX.length);
  const match = raw.match(/(?:restore-|merge-|manual-|discard-)?(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!match) {
    return fallbackTimestamp;
  }

  const [, year, month, day, hour, minute, second] = match;
  const createdAt = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  return Number.isNaN(createdAt) ? fallbackTimestamp : Math.floor(createdAt / 1000);
}

function toSafetyBackup(line: string): SafetyBackup | null {
  const parsed = splitFormattedRefLine(line);
  if (!parsed) {
    return null;
  }

  const { name, timestampRaw, subject } = parsed;
  if (!name || !isSafetyBackupRef(name)) {
    return null;
  }

  const fallbackTimestamp = Number.isNaN(Number(timestampRaw)) ? null : Number(timestampRaw);
  return {
    id: name,
    name,
    createdAt: parseSafetyBackupCreatedAt(name, fallbackTimestamp),
    lastMessage: subject,
    source: parseSafetyBackupSource(name)
  };
}

function countLines(text: string) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function parseNumstat(output: string) {
  let additions = 0;
  let deletions = 0;
  const lines = output.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const [addRaw, delRaw] = line.split('\t');
    const add = Number(addRaw);
    const del = Number(delRaw);
    if (!Number.isNaN(add)) additions += add;
    if (!Number.isNaN(del)) deletions += del;
  }
  return { additions, deletions };
}

function splitFormattedRefLine(line: string) {
  const firstDelimiter = line.indexOf(REF_FIELD_DELIMITER);
  const secondDelimiter =
    firstDelimiter >= 0 ? line.indexOf(REF_FIELD_DELIMITER, firstDelimiter + REF_FIELD_DELIMITER.length) : -1;

  if (firstDelimiter < 0 || secondDelimiter < 0) {
    return null;
  }

  return {
    name: line.slice(0, firstDelimiter),
    timestampRaw: line.slice(firstDelimiter + REF_FIELD_DELIMITER.length, secondDelimiter),
    subject: line.slice(secondDelimiter + REF_FIELD_DELIMITER.length)
  };
}

async function getDiffText(projectPath: string, filePath: string, changeType: ChangeItem['changeType']) {
  const git = createGit(projectPath);

  if (changeType === 'added') {
    const absolutePath = path.join(projectPath, filePath);
    try {
      const text = await fs.readFile(absolutePath, 'utf8');
      const preview = text
        .split(/\r?\n/)
        .slice(0, 300)
        .map((line) => `+ ${line}`)
        .join('\n');
      return preview || '__TAPGIT_EMPTY_FILE__';
    } catch {
      // continue to git diff fallback
    }
  }

  const unstagedDiff = await git.diff(['--', filePath]);
  const stagedDiff = await git.diff(['--cached', '--', filePath]);

  if (unstagedDiff.trim() && stagedDiff.trim()) {
    return `${stagedDiff}\n\n# __TAPGIT_UNSTAGED_CHANGES__\n\n${unstagedDiff}`;
  }
  if (stagedDiff.trim()) {
    return stagedDiff;
  }
  if (unstagedDiff.trim()) {
    return unstagedDiff;
  }

  return '__TAPGIT_NO_DIFF_DETAIL__';
}

async function getFileStats(projectPath: string, filePath: string, changeType: ChangeItem['changeType']) {
  if (changeType === 'added') {
    const absolutePath = path.join(projectPath, filePath);
    try {
      const text = await fs.readFile(absolutePath, 'utf8');
      return { additions: countLines(text), deletions: 0 };
    } catch {
      return { additions: 1, deletions: 0 };
    }
  }

  const git = createGit(projectPath);
  const staged = parseNumstat(await git.raw(['diff', '--cached', '--numstat', '--', filePath]));
  const unstaged = parseNumstat(await git.raw(['diff', '--numstat', '--', filePath]));
  return {
    additions: staged.additions + unstaged.additions,
    deletions: staged.deletions + unstaged.deletions
  };
}

async function hasCommits(projectPath: string) {
  const git = createGit(projectPath);
  try {
    await git.revparse(['--verify', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

async function getCurrentPlan(projectPath: string) {
  const git = createGit(projectPath);
  const raw = await git.raw(['branch', '--show-current']);
  const branch = raw.trim();
  return branch || 'main';
}

async function getConflicts(projectPath: string): Promise<MergeConflict[]> {
  const git = createGit(projectPath);
  const raw = await git.raw(['diff', '--name-only', '--diff-filter=U']);
  const conflictFiles = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const conflicts: MergeConflict[] = [];
  for (const filePath of conflictFiles) {
    const currentContent = await git
      .raw(['show', `:2:${filePath}`])
      .catch(() => '__TAPGIT_UNREADABLE_CURRENT__');
    const incomingContent = await git
      .raw(['show', `:3:${filePath}`])
      .catch(() => '__TAPGIT_UNREADABLE_INCOMING__');
    conflicts.push({
      filePath,
      currentContent,
      incomingContent
    });
  }
  return conflicts;
}

async function ensureIdentity(projectPath: string) {
  const git = createGit(projectPath);
  const name = (await git.raw(['config', '--get', 'user.name'])).trim();
  const email = (await git.raw(['config', '--get', 'user.email'])).trim();
  if (!name) {
    await git.raw(['config', 'user.name', 'TapGit User']);
  }
  if (!email) {
    await git.raw(['config', 'user.email', 'tapgit@local.dev']);
  }
}

function parseLogOutput(raw: string): HistoryRecord[] {
  const lines = raw.split(/\r?\n/);
  const records: HistoryRecord[] = [];
  let current: { id: string; message: string; timestamp: number; files: string[] } | null = null;

  for (const line of lines) {
    if (/^[0-9a-f]{40}\t\d+\t/.test(line)) {
      if (current) {
        const uniqueFiles = Array.from(new Set(current.files));
        records.push({
          id: current.id,
          message: current.message,
          timestamp: current.timestamp,
          changedFiles: uniqueFiles.length,
          files: uniqueFiles
        });
      }
      const [id, ts, ...messageParts] = line.split('\t');
      current = {
        id,
        timestamp: Number(ts),
        message: messageParts.join('\t'),
        files: []
      };
      continue;
    }

    const file = line.trim();
    if (file && current) {
      current.files.push(file);
    }
  }

  if (current) {
    const uniqueFiles = Array.from(new Set(current.files));
    records.push({
      id: current.id,
      message: current.message,
      timestamp: current.timestamp,
      changedFiles: uniqueFiles.length,
      files: uniqueFiles
    });
  }
  return records;
}

function toProjectName(projectPath: string) {
  return path.basename(projectPath);
}

function sanitizeFolderName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim();
}

function suggestFolderNameFromRemote(remoteUrl: string) {
  const trimmed = remoteUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.endsWith('.git') ? trimmed.slice(0, -4) : trimmed;
  const segments = normalized.split(/[/:]/).filter(Boolean);
  const rawName = segments[segments.length - 1] ?? '';
  return sanitizeFolderName(rawName);
}

function parseCountPair(raw: string) {
  const parts = raw
    .trim()
    .split(/\s+/)
    .map((item) => Number(item));
  if (parts.length < 2 || parts.some((item) => Number.isNaN(item))) {
    return { pendingDownload: 0, pendingUpload: 0 };
  }
  return {
    pendingDownload: parts[0],
    pendingUpload: parts[1]
  };
}

function toUnixTimestamp(ms: number | undefined) {
  if (!ms) {
    return null;
  }
  return Math.floor(ms / 1000);
}

async function getDirectorySize(projectPath: string) {
  let scannedEntries = 0;

  async function walk(currentPath: string): Promise<number> {
    if (scannedEntries >= PROJECT_SIZE_SCAN_LIMIT) {
      return 0;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return 0;
    }

    let total = 0;
    for (const entry of entries) {
      if (scannedEntries >= PROJECT_SIZE_SCAN_LIMIT) {
        break;
      }
      if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.gitignore') {
        continue;
      }
      if (entry.isDirectory() && IGNORED_SIZE_DIRECTORIES.has(entry.name)) {
        continue;
      }

      scannedEntries += 1;
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        total += await walk(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        const stat = await fs.stat(absolutePath).catch(() => null);
        total += stat?.size ?? 0;
      }
    }

    return total;
  }

  return walk(projectPath);
}

async function listProjectTopLevelFiles(projectPath: string): Promise<ProjectFileEntry[]> {
  const entries = await fs.readdir(projectPath, { withFileTypes: true }).catch(() => []);
  const files: ProjectFileEntry[] = [];

  for (const entry of entries) {
    if (entry.name === '.git') {
      continue;
    }

    const absolutePath = path.join(projectPath, entry.name);
    const stat = await fs.stat(absolutePath).catch(() => null);
    files.push({
      name: entry.name,
      path: entry.name,
      type: entry.isDirectory() ? 'folder' : 'file',
      size: entry.isDirectory() ? null : stat?.size ?? null,
      modifiedAt: toUnixTimestamp(stat?.mtimeMs)
    });
  }

  return files
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, PROJECT_OVERVIEW_FILE_LIMIT);
}

async function ensureProtectedProject(projectPath: string) {
  const git = createGit(projectPath);
  const isProtected = await git.checkIsRepo();
  if (!isProtected) {
    throw new AppError('PROTECTION_NOT_ENABLED', '当前项目还未开启版本保护');
  }
}

async function ensureNoPendingChanges(projectPath: string, actionText: string) {
  const git = createGit(projectPath);
  const status = await git.status();
  if (status.files.length > 0) {
    throw new AppError(
      'PENDING_CHANGES',
      `你还有未保存修改，请先完成“保存进度”再${actionText}`
    );
  }
}

function buildCloudStatusText(params: {
  connected: boolean;
  hasTracking: boolean;
  pendingUpload: number;
  pendingDownload: number;
}) {
  const { connected, hasTracking, pendingUpload, pendingDownload } = params;
  if (!connected) {
    return 'Not connected to cloud';
  }
  if (!hasTracking) {
    return 'Cloud connected, upload once to establish tracking';
  }
  if (pendingUpload === 0 && pendingDownload === 0) {
    return 'Local and cloud are in sync';
  }
  if (pendingUpload > 0 && pendingDownload > 0) {
    return `${pendingUpload} pending upload, ${pendingDownload} pending download`;
  }
  if (pendingUpload > 0) {
    return `${pendingUpload} pending upload`;
  }
  return `${pendingDownload} pending download`;
}

async function getTrackingStatus(projectPath: string) {
  const git = createGit(projectPath);
  try {
    const tracking = (await git.raw(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])).trim();
    return tracking;
  } catch {
    return '';
  }
}

async function resolveRemote(projectPath: string) {
  const git = createGit(projectPath);
  const remotes = await git.getRemotes(true);
  if (remotes.length === 0) {
    return { remoteLabel: '', remoteUrl: '', preferredAccount: null };
  }
  const preferred = remotes.find((item) => item.name === 'origin') ?? remotes[0];
  const parsed = parseRemoteUrl(preferred.refs.fetch || preferred.refs.push || '');
  return {
    remoteLabel: preferred.name,
    remoteUrl: parsed.sanitizedUrl,
    preferredAccount: parsed.provider === 'github' ? parsed.preferredAccount : null
  };
}

async function configurePreferredAccount(projectPath: string, remoteUrl: string, preferredAccount?: string) {
  const git = createGit(projectPath);
  const parsed = parseRemoteUrl(remoteUrl);

  if (parsed.provider !== 'github') {
    await git.raw(['config', '--unset-all', 'credential.username']).catch(() => undefined);
    return remoteUrl.trim();
  }

  const nextRemoteUrl = applyPreferredAccountToRemoteUrl(remoteUrl, preferredAccount);
  await git.raw(['config', 'credential.useHttpPath', 'true']).catch(() => undefined);
  if (preferredAccount?.trim()) {
    await git.raw(['config', 'credential.username', preferredAccount.trim()]).catch(() => undefined);
  } else {
    await git.raw(['config', '--unset-all', 'credential.username']).catch(() => undefined);
  }
  return nextRemoteUrl;
}

async function appendExcludeRule(projectPath: string, filePath: string) {
  const excludePath = path.join(projectPath, '.git', 'info', 'exclude');
  const normalizedPath = filePath.replace(/\\/g, '/');
  const currentContent = await fs.readFile(excludePath, 'utf8').catch(() => '');
  const existingRules = currentContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (existingRules.includes(normalizedPath)) {
    return;
  }

  const nextContent = currentContent.endsWith('\n') || currentContent.length === 0 ? currentContent : `${currentContent}\n`;
  await fs.writeFile(excludePath, `${nextContent}${normalizedPath}\n`, 'utf8');
}

function parseCloudConnectionError(detail: string): CloudConnectionTestResult {
  const lower = detail.toLowerCase();
  if (
    lower.includes('authentication failed') ||
    lower.includes('could not read username') ||
    lower.includes('permission denied') ||
    lower.includes('access denied') ||
    lower.includes('terminal prompts disabled')
  ) {
    return {
      code: 'auth_required',
      reachable: false,
      requiresAuth: true,
      message: 'Credentials are required for this cloud URL.'
    };
  }

  if (lower.includes('repository not found') || lower.includes('not found')) {
    return {
      code: 'not_found',
      reachable: false,
      requiresAuth: false,
      message: 'Repository not found.'
    };
  }

  if (
    lower.includes('could not resolve host') ||
    lower.includes('failed to connect') ||
    lower.includes('timed out')
  ) {
    return {
      code: 'network_error',
      reachable: false,
      requiresAuth: false,
      message: 'Cannot reach the cloud URL.'
    };
  }

  return {
    code: 'unknown_error',
    reachable: false,
    requiresAuth: false,
    message: 'Cloud connection test failed.'
  };
}

export async function checkGitEnvironment(): Promise<GitEnvironment> {
  try {
    const { stdout } = await execFileAsync('git', ['--version']);
    return {
      available: true,
      version: stdout.trim()
    };
  } catch {
    return {
      available: false,
      version: ''
    };
  }
}

export async function getCloudSyncStatus(projectPath: string): Promise<CloudSyncStatus> {
  await ensureProtectedProject(projectPath);
  const git = createGit(projectPath);
  const currentPlan = await getCurrentPlan(projectPath);
  const remote = await resolveRemote(projectPath);

  if (!remote.remoteLabel) {
    return {
      connected: false,
      remoteLabel: '',
      remoteUrl: '',
      currentPlan,
      hasTracking: false,
      pendingUpload: 0,
      pendingDownload: 0,
      preferredAccount: null,
      statusText: buildCloudStatusText({
        connected: false,
        hasTracking: false,
        pendingUpload: 0,
        pendingDownload: 0
      })
    };
  }

  const tracking = await getTrackingStatus(projectPath);
  let pendingUpload = 0;
  let pendingDownload = 0;

  if (tracking) {
    const countRaw = await git
      .raw(['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])
      .catch(() => '0\t0');
    const parsed = parseCountPair(countRaw);
    pendingUpload = parsed.pendingUpload;
    pendingDownload = parsed.pendingDownload;
  }

  const hasTracking = Boolean(tracking);
  return {
    connected: true,
    remoteLabel: remote.remoteLabel,
    remoteUrl: remote.remoteUrl,
    currentPlan,
    hasTracking,
    pendingUpload,
    pendingDownload,
    preferredAccount: remote.preferredAccount,
    statusText: buildCloudStatusText({
      connected: true,
      hasTracking,
      pendingUpload,
      pendingDownload
    })
  };
}

export async function testCloudConnection(
  projectPath: string,
  remoteUrl: string,
  preferredAccount?: string
): Promise<CloudConnectionTestResult> {
  await ensureProtectedProject(projectPath);
  const url = (await configurePreferredAccount(projectPath, remoteUrl.trim(), preferredAccount)).trim();
  if (!url) {
    throw new AppError('EMPTY_REMOTE_URL', '请先填写云端地址');
  }

  const git = createGit(projectPath);
  try {
    await git.raw(['ls-remote', '--heads', url]);
    return {
      code: 'ok',
      reachable: true,
      requiresAuth: false,
      message: 'Connection test passed.'
    };
  } catch (error) {
    return parseCloudConnectionError(String(error));
  }
}

export async function connectCloud(
  projectPath: string,
  remoteUrl: string,
  preferredAccount?: string
): Promise<CloudSyncStatus> {
  await ensureProtectedProject(projectPath);
  const url = (await configurePreferredAccount(projectPath, remoteUrl.trim(), preferredAccount)).trim();
  if (!url) {
    throw new AppError('EMPTY_REMOTE_URL', '请先填写云端地址');
  }

  const git = createGit(projectPath);
  const remote = await resolveRemote(projectPath);
  if (remote.remoteLabel) {
    await git.raw(['remote', 'set-url', remote.remoteLabel, url]).catch((error) => {
      throw new AppError('CONNECT_CLOUD_FAILED', '连接云端失败，请检查地址是否正确', String(error));
    });
  } else {
    await git.raw(['remote', 'add', 'origin', url]).catch((error) => {
      throw new AppError('CONNECT_CLOUD_FAILED', '连接云端失败，请检查地址是否正确', String(error));
    });
  }

  return getCloudSyncStatus(projectPath);
}

export async function uploadToCloud(projectPath: string): Promise<CloudSyncStatus> {
  await ensureProtectedProject(projectPath);
  if (!(await hasCommits(projectPath))) {
    throw new AppError('NO_HISTORY', '还没有可上传的保存记录，请先保存进度');
  }

  const before = await getCloudSyncStatus(projectPath);
  if (!before.connected || !before.remoteLabel) {
    throw new AppError('CLOUD_NOT_CONNECTED', '请先连接云端地址');
  }

  const git = createGit(projectPath);
  const currentPlan = await getCurrentPlan(projectPath);
  const pushArgs = before.hasTracking
    ? ['push', before.remoteLabel, currentPlan]
    : ['push', '-u', before.remoteLabel, currentPlan];

  await git.raw(pushArgs).catch((error) => {
    throw new AppError('UPLOAD_FAILED', '上传到云端失败，请检查网络和权限', String(error));
  });

  return getCloudSyncStatus(projectPath);
}

export async function getCloudLatest(projectPath: string): Promise<CloudSyncStatus> {
  await ensureProtectedProject(projectPath);
  await ensureNoPendingChanges(projectPath, '获取云端最新内容');
  const before = await getCloudSyncStatus(projectPath);
  if (!before.connected || !before.remoteLabel) {
    throw new AppError('CLOUD_NOT_CONNECTED', '请先连接云端地址');
  }

  const git = createGit(projectPath);
  const currentPlan = await getCurrentPlan(projectPath);

  if (!before.hasTracking) {
    await git.raw(['fetch', before.remoteLabel, currentPlan]).catch((error) => {
      const details = String(error);
      if (details.includes("couldn't find remote ref")) {
        throw new AppError('NO_REMOTE_RECORD', '云端还没有这个方案的记录，请先上传一次');
      }
      throw new AppError('GET_LATEST_FAILED', '获取云端最新内容失败', details);
    });

    await git
      .raw(['branch', '--set-upstream-to', `${before.remoteLabel}/${currentPlan}`, currentPlan])
      .catch(() => undefined);
  }

  await git.raw(['pull', '--ff-only', before.remoteLabel, currentPlan]).catch((error) => {
    throw new AppError('GET_LATEST_FAILED', '获取云端最新内容失败，请先处理本地修改后重试', String(error));
  });

  return getCloudSyncStatus(projectPath);
}

export async function openProject(projectPath: string): Promise<ProjectSummary> {
  const git = createGit(projectPath);
  const isProtected = await git.checkIsRepo();
  if (!isProtected) {
    return {
      path: projectPath,
      name: toProjectName(projectPath),
      isProtected: false,
      currentPlan: 'main',
      pendingChangeCount: 0
    };
  }

  const status = await git.status();
  const currentPlan = await getCurrentPlan(projectPath);
  return {
    path: projectPath,
    name: toProjectName(projectPath),
    isProtected: true,
    currentPlan,
    pendingChangeCount: status.files.length
  };
}

export async function getProjectOverview(projectPath: string): Promise<ProjectOverview> {
  const [files, projectSizeBytes, history] = await Promise.all([
    listProjectTopLevelFiles(projectPath),
    getDirectorySize(projectPath),
    listHistory(projectPath)
  ]);
  const latestRecord = history[0] ?? null;

  return {
    files,
    projectSizeBytes,
    savedRecordCount: history.length,
    recentRecords: history.slice(0, 4),
    lastSavedAt: latestRecord?.timestamp ?? null,
    lastSavedMessage: latestRecord?.message ?? ''
  };
}

export async function cloneProjectFromGitHub(
  payload: CloneProjectPayload
): Promise<ProjectSummary> {
  const remoteUrl = applyPreferredAccountToRemoteUrl(payload.remoteUrl.trim(), payload.preferredAccount);
  const destinationDirectory = payload.destinationDirectory.trim();
  const folderName = sanitizeFolderName(
    (payload.folderName && payload.folderName.trim()) || suggestFolderNameFromRemote(remoteUrl)
  );

  if (!remoteUrl) {
    throw new AppError('EMPTY_REMOTE_URL', '请先填写 GitHub 仓库地址');
  }
  if (!destinationDirectory) {
    throw new AppError('EMPTY_DESTINATION', '请先选择项目保存位置');
  }
  if (!folderName) {
    throw new AppError('INVALID_FOLDER_NAME', '请填写本地文件夹名称');
  }

  const targetPath = path.join(destinationDirectory, folderName);
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(targetPath);
      if (entries.length > 0) {
        throw new AppError(
          'TARGET_ALREADY_EXISTS',
          '这个位置已经有同名文件夹了，请换一个位置或名称'
        );
      }
    } else {
      throw new AppError(
        'TARGET_ALREADY_EXISTS',
        '这个位置已经有同名文件夹了，请换一个位置或名称'
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
  }

  await fs.mkdir(destinationDirectory, { recursive: true });

  try {
    await execFileAsync('git', ['clone', remoteUrl, targetPath]);
    await configurePreferredAccount(targetPath, remoteUrl, payload.preferredAccount);
  } catch (error) {
    throw new AppError(
      'CLONE_PROJECT_FAILED',
      '获取项目失败，请检查地址、网络或登录状态',
      String(error)
    );
  }

  return openProject(targetPath);
}

export async function enableProtection(projectPath: string): Promise<ProjectSummary> {
  const git = createGit(projectPath);
  const isProtected = await git.checkIsRepo();
  if (!isProtected) {
    await git.init();
  }
  return openProject(projectPath);
}

export async function getCurrentChanges(projectPath: string): Promise<ChangeItem[]> {
  const git = createGit(projectPath);
  const isProtected = await git.checkIsRepo();
  if (!isProtected) {
    throw new AppError('PROTECTION_NOT_ENABLED', '当前项目还未开启版本保护');
  }

  const status = await git.status();
  const items: ChangeItem[] = [];

  for (const file of status.files) {
    const changeType = mapChangeType(file.index, file.working_dir);
    const stats = await getFileStats(projectPath, file.path, changeType);
    const diffText = await getDiffText(projectPath, file.path, changeType);
    items.push({
      path: file.path,
      changeType,
      area: file.index && file.index !== ' ' && file.index !== '?' ? 'ready' : 'worktree',
      statusLabel: mapStatusLabel(changeType),
      additions: stats.additions,
      deletions: stats.deletions,
      diffText
    });
  }

  return items.sort((a, b) => a.path.localeCompare(b.path));
}

export async function stopTrackingFile(projectPath: string, filePath: string) {
  await ensureProtectedProject(projectPath);
  const git = createGit(projectPath);
  const absolutePath = path.join(projectPath, filePath);
  const fileExists = await fs
    .access(absolutePath)
    .then(() => true)
    .catch(() => false);

  if (fileExists) {
    await git.raw(['rm', '--cached', '--ignore-unmatch', '--', filePath]).catch((error) => {
      throw new AppError('STOP_TRACKING_FAILED', '停止追踪失败，请稍后重试', String(error));
    });
  }

  await appendExcludeRule(projectPath, filePath).catch((error) => {
    throw new AppError('STOP_TRACKING_FAILED', '停止追踪失败，请稍后重试', String(error));
  });
}

export async function discardAllChanges(projectPath: string) {
  await ensureProtectedProject(projectPath);

  if (!(await hasCommits(projectPath))) {
    throw new AppError('NO_HISTORY', '请先保存一次进度，再丢弃当前变更');
  }

  const changes = await getCurrentChanges(projectPath);
  if (changes.length === 0) {
    return;
  }

  const git = createGit(projectPath);
  const current = await getCurrentPlan(projectPath);
  const snapshotBranch = formatSnapshotName('discard');

  await ensureIdentity(projectPath);

  try {
    await git.raw(['switch', '-c', snapshotBranch]);
    await git.add(['-A']);
    await git.commit(`Safety backup before discarding changes at ${new Date().toISOString()}`);
    await git.raw(['switch', current]);
    await git.raw(['reset', '--hard', 'HEAD']);
    await git.raw(['clean', '-fd']);
  } catch (error) {
    await git.raw(['switch', current]).catch(() => undefined);
    throw new AppError(
      'DISCARD_CHANGES_FAILED',
      '这次清理没有成功，当前内容没有被继续处理。请稍后再试。',
      String(error)
    );
  }
}

export async function saveProgress(payload: SaveProgressPayload): Promise<SaveProgressResult> {
  const { projectPath, message, selectedFiles } = payload;
  const git = createGit(projectPath);
  const isProtected = await git.checkIsRepo();
  if (!isProtected) {
    throw new AppError('PROTECTION_NOT_ENABLED', '当前项目还未开启版本保护');
  }

  if (!message.trim()) {
    throw new AppError('EMPTY_MESSAGE', '请填写这次保存的说明');
  }

  await ensureIdentity(projectPath);

  if (selectedFiles && selectedFiles.length > 0) {
    await git.add(selectedFiles);
  } else {
    await git.add(['-A']);
  }

  try {
    const commitResult = await git.commit(message.trim());
    if (!commitResult.commit) {
      throw new AppError('NOTHING_TO_SAVE', '当前没有可保存的修改');
    }
    return {
      recordId: commitResult.commit,
      savedFiles: commitResult.summary.changes || selectedFiles?.length || 0,
      message: 'Saved'
    };
  } catch (error) {
    const text = String(error);
    if (text.includes('nothing to commit')) {
      throw new AppError('NOTHING_TO_SAVE', '当前没有可保存的修改');
    }
    throw new AppError('SAVE_FAILED', '这次保存没有成功，请稍后重试', text);
  }
}

export async function listHistory(projectPath: string): Promise<HistoryRecord[]> {
  if (!(await hasCommits(projectPath))) {
    return [];
  }

  const git = createGit(projectPath);
  const raw = await git.raw([
    'log',
    '--date=unix',
    '--pretty=format:%H%x09%ct%x09%s',
    '--name-only',
    '-n',
    '120'
  ]);
  return parseLogOutput(raw);
}

export async function listSafetyBackups(projectPath: string): Promise<SafetyBackup[]> {
  await ensureProtectedProject(projectPath);

  const git = createGit(projectPath);
  const raw = await git.raw([
    'for-each-ref',
    'refs/heads/safety',
    `--format=%(refname:short)${REF_FIELD_DELIMITER}%(committerdate:unix)${REF_FIELD_DELIMITER}%(subject)`
  ]);

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => toSafetyBackup(line))
    .filter((item): item is SafetyBackup => Boolean(item))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function createSafetyBackup(projectPath: string): Promise<SafetyBackup> {
  await ensureProtectedProject(projectPath);

  if (!(await hasCommits(projectPath))) {
    throw new AppError('NO_HISTORY', '请先保存一次进度，再创建安全备份');
  }

  const git = createGit(projectPath);
  const snapshotBranch = formatSnapshotName('manual');
  await git.raw(['branch', snapshotBranch]).catch((error) => {
    throw new AppError('CREATE_BACKUP_FAILED', '这次备份没有成功，请稍后再试', String(error));
  });

  const timestamp = Math.floor(Date.now() / 1000);
  return {
    id: snapshotBranch,
    name: snapshotBranch,
    createdAt: timestamp,
    lastMessage: 'Manual safety backup',
    source: 'manual'
  };
}

async function restoreToRef(
  projectPath: string,
  ref: string,
  autoSnapshotBeforeRestore: boolean,
  snapshotSource: SafetyBackup['source']
) {
  const git = createGit(projectPath);
  if (!(await hasCommits(projectPath))) {
    throw new AppError('NO_HISTORY', '还没有历史记录，暂时无法恢复');
  }

  if (autoSnapshotBeforeRestore) {
    const snapshotBranch = formatSnapshotName(snapshotSource);
    await git.raw(['branch', snapshotBranch]).catch(() => undefined);
  }

  await git.raw(['reset', '--hard', ref]).catch((error) => {
    throw new AppError('RESTORE_FAILED', '恢复失败，请稍后重试', String(error));
  });
}

export async function restoreToRecord(
  projectPath: string,
  recordId: string,
  autoSnapshotBeforeRestore: boolean
) {
  await restoreToRef(projectPath, recordId, autoSnapshotBeforeRestore, 'restore');
}

export async function restoreToSafetyBackup(
  projectPath: string,
  backupId: string,
  autoSnapshotBeforeRestore: boolean
) {
  if (!isSafetyBackupRef(backupId)) {
    throw new AppError('RESTORE_FAILED', '恢复失败，请稍后重试');
  }

  await restoreToRef(projectPath, backupId, autoSnapshotBeforeRestore, 'restore');
}

export async function listPlans(projectPath: string): Promise<PlanInfo[]> {
  const git = createGit(projectPath);
  const isProtected = await git.checkIsRepo();
  if (!isProtected) {
    return [];
  }

  const current = await getCurrentPlan(projectPath);
  const raw = await git.raw([
    'for-each-ref',
    'refs/heads',
    `--format=%(refname:short)${REF_FIELD_DELIMITER}%(committerdate:unix)${REF_FIELD_DELIMITER}%(subject)`
  ]);

  const list = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parsed = splitFormattedRefLine(line);
      if (!parsed) {
        return null;
      }
      const timestamp = Number(parsed.timestampRaw);
      return {
        id: parsed.name,
        name: parsed.name,
        isCurrent: parsed.name === current,
        isMain: parsed.name === 'main' || parsed.name === 'master',
        lastSavedAt: Number.isNaN(timestamp) ? null : timestamp,
        lastMessage: parsed.subject
      } satisfies PlanInfo;
    })
    .filter((plan): plan is PlanInfo => Boolean(plan))
    .filter((plan) => !isSafetyBackupRef(plan.name));

  if (list.length === 0 && current) {
    return [
      {
        id: current,
        name: current,
        isCurrent: true,
        isMain: true,
        lastSavedAt: null,
        lastMessage: ''
      }
    ];
  }

  return list.sort((a, b) => {
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function createPlan(projectPath: string, planName: string, fromPlan?: string) {
  const git = createGit(projectPath);
  const name = planName.trim();
  if (!name) {
    throw new AppError('INVALID_PLAN_NAME', '方案名称不能为空');
  }
  await git
    .raw(['switch', '-c', name, ...(fromPlan ? [fromPlan] : [])])
    .catch((error) => {
      throw new AppError('CREATE_PLAN_FAILED', '创建新方案失败', String(error));
    });
}

export async function switchPlan(projectPath: string, planName: string) {
  const git = createGit(projectPath);
  await git.raw(['switch', planName]).catch((error) => {
    throw new AppError('SWITCH_PLAN_FAILED', '切换方案失败，请先保存当前修改', String(error));
  });
}

export async function mergePlan(
  projectPath: string,
  fromPlan: string,
  toPlan: string,
  autoSnapshotBeforeMerge: boolean
): Promise<MergeResult> {
  const git = createGit(projectPath);
  const current = await getCurrentPlan(projectPath);
  if (current !== toPlan) {
    await git.raw(['switch', toPlan]);
  }

  if (autoSnapshotBeforeMerge) {
    const snapshotBranch = formatSnapshotName('merge');
    await git.raw(['branch', snapshotBranch]).catch(() => undefined);
  }

  try {
    await git.raw(['merge', '--no-ff', '--no-edit', fromPlan]);
    return {
      status: 'merged',
      message: 'Merge completed',
      conflicts: []
    };
  } catch (error) {
    const conflicts = await getConflicts(projectPath);
    if (conflicts.length > 0) {
      return {
        status: 'needs_decision',
        message: 'Both sides changed the same section. Decide which version to keep.',
        conflicts
      };
    }
    throw new AppError('MERGE_FAILED', '合并失败，请稍后重试', String(error));
  }
}

export async function resolveCollision(
  projectPath: string,
  filePath: string,
  strategy: ResolveStrategy,
  manualContent?: string
): Promise<MergeResult> {
  const git = createGit(projectPath);
  if (strategy === 'keepCurrent') {
    await git.raw(['checkout', '--ours', '--', filePath]);
  } else if (strategy === 'keepIncoming') {
    await git.raw(['checkout', '--theirs', '--', filePath]);
  } else {
    if (typeof manualContent !== 'string') {
      throw new AppError('MANUAL_CONTENT_REQUIRED', '请填写手动处理后的内容');
    }
    await fs.writeFile(path.join(projectPath, filePath), manualContent, 'utf8');
  }
  await git.add(filePath);

  const conflicts = await getConflicts(projectPath);
  if (conflicts.length > 0) {
    return {
      status: 'needs_decision',
      message: `${conflicts.length} files still need decisions`,
      conflicts
    };
  }
  return {
    status: 'merged',
    message: 'All overlaps resolved. Click "Finish Merge" to save.',
    conflicts: []
  };
}

export async function completeMerge(projectPath: string, message?: string) {
  const git = createGit(projectPath);
  const commitMessage = message?.trim() || '合并方案';
  try {
    await ensureIdentity(projectPath);
    await git.commit(commitMessage);
  } catch (error) {
    const text = String(error);
    if (text.includes('nothing to commit')) {
      return;
    }
    throw new AppError('COMPLETE_MERGE_FAILED', '完成合并失败，请稍后重试', text);
  }
}
