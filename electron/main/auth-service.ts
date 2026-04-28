import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { shell } from 'electron';
import { GitHubAuthStatus } from '../../src/shared/contracts';
import { AppError } from './app-error';

const execFileAsync = promisify(execFile);
const GITHUB_LOGIN_URL = 'https://github.com/login';
const MAC_TOOL_PATHS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];

function parseAccounts(stdout: string) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function createToolEnv() {
  const inheritedPath = process.env.PATH || process.env.Path || '';
  const toolPath =
    process.platform === 'darwin'
      ? [...MAC_TOOL_PATHS, inheritedPath].filter(Boolean).join(path.delimiter)
      : inheritedPath;

  return {
    ...process.env,
    PATH: toolPath,
    Path: toolPath,
    GCM_INTERACTIVE: 'always'
  };
}

async function runGitHubCredentialManager(args: string[]) {
  return execFileAsync('git', ['credential-manager', 'github', ...args], {
    windowsHide: true,
    env: createToolEnv()
  });
}

function shouldOpenBrowserFallback(error: unknown) {
  const details = String(error);
  return (
    process.platform === 'darwin' ||
    details.includes('not a git command') ||
    details.includes('ENOENT') ||
    details.includes('not found') ||
    details.includes('Unknown option') ||
    details.includes('unknown option')
  );
}

async function runGitHubLogin(username?: string) {
  const baseArgs = username?.trim() ? ['--username', username.trim()] : [];
  const attempts = [
    ['login', '--browser', '--force', ...baseArgs],
    ['login', '--browser', ...baseArgs],
    ['login', ...baseArgs]
  ];
  let lastError: unknown = null;

  for (const args of attempts) {
    try {
      await runGitHubCredentialManager(args);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function openGitHubLoginFallback(): Promise<GitHubAuthStatus> {
  let browserLoginOpened = false;

  try {
    await shell.openExternal(GITHUB_LOGIN_URL);
    browserLoginOpened = true;
  } catch {
    browserLoginOpened = false;
  }

  const status = await getGitHubAuthStatus();
  return {
    ...status,
    browserLoginOpened,
    manualLoginRequired: !browserLoginOpened,
    helpUrl: GITHUB_LOGIN_URL
  };
}

export async function getGitHubAuthStatus(): Promise<GitHubAuthStatus> {
  try {
    const { stdout } = await runGitHubCredentialManager(['list']);
    const accounts = parseAccounts(stdout);
    return {
      available: true,
      accounts,
      activeAccount: accounts[0] ?? null
    };
  } catch {
    return {
      available: false,
      accounts: [],
      activeAccount: null
    };
  }
}

export async function loginGitHub(username?: string): Promise<GitHubAuthStatus> {
  try {
    await runGitHubLogin(username);
    return getGitHubAuthStatus();
  } catch (error) {
    if (shouldOpenBrowserFallback(error)) {
      return openGitHubLoginFallback();
    }
    throw new AppError('GITHUB_LOGIN_FAILED', 'GitHub sign-in failed.', String(error));
  }
}

export async function logoutGitHub(account: string): Promise<GitHubAuthStatus> {
  try {
    await runGitHubCredentialManager(['logout', account]);
    return getGitHubAuthStatus();
  } catch (error) {
    throw new AppError('GITHUB_LOGOUT_FAILED', 'GitHub sign-out failed.', String(error));
  }
}
