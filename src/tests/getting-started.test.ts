import { describe, expect, it } from 'vitest';
import { resolveGettingStartedState } from '../app/getting-started';

describe('resolveGettingStartedState', () => {
  it('starts at opening a project when nothing is open', () => {
    expect(resolveGettingStartedState(null, null)).toEqual({
      key: 'open',
      isActive: true,
      stepNumber: 1,
      totalSteps: 3
    });
  });

  it('moves to protection after a project is opened', () => {
    expect(
      resolveGettingStartedState(
        {
          path: 'E:/demo/project-a',
          name: 'project-a',
          isProtected: false,
          currentPlan: 'main',
          pendingChangeCount: 0
        },
        null
      )
    ).toEqual({
      key: 'protect',
      isActive: true,
      stepNumber: 2,
      totalSteps: 3
    });
  });

  it('moves to the first save after protection is on', () => {
    expect(
      resolveGettingStartedState(
        {
          path: 'E:/demo/project-a',
          name: 'project-a',
          isProtected: true,
          currentPlan: 'main',
          pendingChangeCount: 0
        },
        0
      )
    ).toEqual({
      key: 'save',
      isActive: true,
      stepNumber: 3,
      totalSteps: 3
    });
  });

  it('finishes once the first saved record exists', () => {
    expect(
      resolveGettingStartedState(
        {
          path: 'E:/demo/project-a',
          name: 'project-a',
          isProtected: true,
          currentPlan: 'main',
          pendingChangeCount: 2
        },
        1
      )
    ).toEqual({
      key: 'done',
      isActive: false,
      stepNumber: 3,
      totalSteps: 3
    });
  });
});
