import { describe, expect, it } from 'vitest';
import { resolvePrimaryTaskKey } from '../app/primary-task';

const baseProject = {
  path: 'E:/demo/project-a',
  name: 'project-a',
  isProtected: true,
  currentPlan: 'main',
  pendingChangeCount: 0
};

describe('resolvePrimaryTaskKey', () => {
  it('asks the user to open a project first', () => {
    expect(resolvePrimaryTaskKey(null, null)).toBe('open');
  });

  it('asks the user to turn on protection after opening a project', () => {
    expect(
      resolvePrimaryTaskKey(
        {
          ...baseProject,
          isProtected: false
        },
        null
      )
    ).toBe('protect');
  });

  it('keeps the focus on saving while there are unsaved files', () => {
    expect(
      resolvePrimaryTaskKey(
        {
          ...baseProject,
          pendingChangeCount: 3
        },
        4
      )
    ).toBe('save');
  });

  it('keeps the focus on the first save when history is still empty', () => {
    expect(resolvePrimaryTaskKey(baseProject, 0)).toBe('save');
  });

  it('moves the user to the timeline after the first stable save exists', () => {
    expect(resolvePrimaryTaskKey(baseProject, 2)).toBe('timeline');
  });
});
