import { describe, expect, it } from 'vitest';
import { applyPreferredAccountToRemoteUrl, parseRemoteUrl } from '../shared/remote-url';

describe('remote URL helpers', () => {
  it('extracts the preferred GitHub account from a URL and hides it for display', () => {
    const parsed = parseRemoteUrl('https://force-mind@github.com/ForceMind/TapGit.git');

    expect(parsed.provider).toBe('github');
    expect(parsed.preferredAccount).toBe('force-mind');
    expect(parsed.owner).toBe('ForceMind');
    expect(parsed.repo).toBe('TapGit');
    expect(parsed.sanitizedUrl).toBe('https://github.com/ForceMind/TapGit.git');
  });

  it('injects the preferred account into the remote URL when needed', () => {
    expect(
      applyPreferredAccountToRemoteUrl('https://github.com/ForceMind/TapGit.git', 'force-mind')
    ).toBe('https://force-mind@github.com/ForceMind/TapGit.git');
  });
});
