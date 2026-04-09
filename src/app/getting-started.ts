import { ProjectSummary } from '../shared/contracts';

export type GettingStartedStepKey = 'open' | 'protect' | 'save' | 'done';

export interface GettingStartedState {
  key: GettingStartedStepKey;
  isActive: boolean;
  stepNumber: number;
  totalSteps: number;
}

export function resolveGettingStartedState(
  project: ProjectSummary | null,
  historyCount: number | null
): GettingStartedState {
  if (!project) {
    return {
      key: 'open',
      isActive: true,
      stepNumber: 1,
      totalSteps: 3
    };
  }

  if (!project.isProtected) {
    return {
      key: 'protect',
      isActive: true,
      stepNumber: 2,
      totalSteps: 3
    };
  }

  if ((historyCount ?? 0) === 0) {
    return {
      key: 'save',
      isActive: true,
      stepNumber: 3,
      totalSteps: 3
    };
  }

  return {
    key: 'done',
    isActive: false,
    stepNumber: 3,
    totalSteps: 3
  };
}
