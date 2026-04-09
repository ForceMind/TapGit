import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GitHubAuthStatus } from '../../src/shared/contracts';
import { AppError } from './app-error';

const execFileAsync = promisify(execFile);

function parseAccounts(stdout: string) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function runGitHubCredentialManager(args: string[]) {
  return execFileAsync('git', ['credential-manager', 'github', ...args], {
    windowsHide: true
  });
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

export async function loginGitHub(): Promise<GitHubAuthStatus> {
  try {
    await runGitHubCredentialManager(['login', '--web']);
    return getGitHubAuthStatus();
  } catch (error) {
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
