import { describe, expect, it } from 'vitest';
import { resolveSidebarNavState } from '../app/navigation-state';

const protectedProject = {
  path: 'E:/demo/project-a',
  name: 'project-a',
  isProtected: true,
  currentPlan: 'main',
  pendingChangeCount: 0
};

describe('resolveSidebarNavState', () => {
  it('locks current changes until a project is open', () => {
    expect(resolveSidebarNavState('changes', null, null)).toEqual({
      enabled: false,
      tone: 'locked',
      hintKey: 'app_nav_hint_open_project',
      fallbackTo: '/'
    });
  });

  it('nudges current changes toward protection before the project is protected', () => {
    expect(
      resolveSidebarNavState(
        'changes',
        {
          ...protectedProject,
          isProtected: false
        },
        null
      )
    ).toEqual({
      enabled: true,
      tone: 'next',
      hintKey: 'app_nav_hint_enable_protection',
      fallbackTo: '/changes'
    });
  });

  it('keeps timeline locked until the first save exists', () => {
    expect(resolveSidebarNavState('timeline', protectedProject, 0)).toEqual({
      enabled: false,
      tone: 'locked',
      hintKey: 'app_nav_hint_first_save',
      fallbackTo: '/changes'
    });
  });

  it('unlocks try ideas after the first saved record exists', () => {
    expect(resolveSidebarNavState('plans', protectedProject, 2)).toEqual({
      enabled: true,
      tone: 'ready',
      hintKey: 'app_nav_hint_plans',
      fallbackTo: '/plans'
    });
  });

  it('shows a checking state while saved history is still loading', () => {
    expect(resolveSidebarNavState('timeline', protectedProject, null, true)).toEqual({
      enabled: false,
      tone: 'locked',
      hintKey: 'app_nav_hint_checking_history',
      fallbackTo: '/'
    });
  });
});
