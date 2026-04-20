export type RemoteProvider = 'github' | 'gitlab' | 'other';

export interface ParsedRemoteUrl {
  provider: RemoteProvider;
  originalUrl: string;
  sanitizedUrl: string;
  preferredAccount: string | null;
  owner: string | null;
  repo: string | null;
}

function tryParseHttpUrl(remoteUrl: string) {
  try {
    return new URL(remoteUrl);
  } catch {
    return null;
  }
}

function trimGitSuffix(value: string) {
  return value.replace(/\.git$/i, '');
}

export function parseRemoteUrl(remoteUrl: string): ParsedRemoteUrl {
  const parsed = tryParseHttpUrl(remoteUrl.trim());
  if (!parsed) {
    return {
      provider: 'other',
      originalUrl: remoteUrl,
      sanitizedUrl: remoteUrl.trim(),
      preferredAccount: null,
      owner: null,
      repo: null
    };
  }

  const host = parsed.hostname.toLowerCase();
  const preferredAccount = parsed.username ? decodeURIComponent(parsed.username) : null;
  parsed.username = '';
  parsed.password = '';

  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const owner = pathSegments[0] ?? null;
  const repo = pathSegments[1] ? trimGitSuffix(pathSegments[1]) : null;

  let provider: RemoteProvider = 'other';
  if (host === 'github.com') {
    provider = 'github';
  } else if (host === 'gitlab.com') {
    provider = 'gitlab';
  }

  return {
    provider,
    originalUrl: remoteUrl,
    sanitizedUrl: parsed.toString(),
    preferredAccount,
    owner,
    repo
  };
}

export function isGitHubRemoteUrl(remoteUrl: string) {
  return parseRemoteUrl(remoteUrl).provider === 'github';
}

export function applyPreferredAccountToRemoteUrl(remoteUrl: string, preferredAccount?: string | null) {
  const parsed = tryParseHttpUrl(remoteUrl.trim());
  if (!parsed) {
    return remoteUrl.trim();
  }

  if (preferredAccount?.trim()) {
    parsed.username = preferredAccount.trim();
  } else {
    parsed.username = '';
  }
  parsed.password = '';

  return parsed.toString();
}
