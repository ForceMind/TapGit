import { ProjectSummary } from '../shared/contracts';

export type PrimaryTaskKey = 'open' | 'protect' | 'save' | 'timeline';

export function resolvePrimaryTaskKey(
  project: ProjectSummary | null,
  historyCount: number | null
): PrimaryTaskKey {
  if (!project) {
    return 'open';
  }

  if (!project.isProtected) {
    return 'protect';
  }

  if (project.pendingChangeCount > 0 || (historyCount ?? 0) === 0) {
    return 'save';
  }

  return 'timeline';
}
