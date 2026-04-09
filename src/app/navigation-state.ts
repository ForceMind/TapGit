import { ProjectSummary } from '../shared/contracts';
import { MessageKey } from '../i18n/messages';

export type SidebarNavKey = 'home' | 'changes' | 'timeline' | 'plans' | 'settings';
export type SidebarNavTone = 'ready' | 'next' | 'locked';

export interface SidebarNavState {
  enabled: boolean;
  tone: SidebarNavTone;
  hintKey: MessageKey;
  fallbackTo: string;
}

export function resolveSidebarNavState(
  key: SidebarNavKey,
  project: ProjectSummary | null,
  historyCount: number | null,
  historyLoading = false
): SidebarNavState {
  switch (key) {
    case 'home':
      return {
        enabled: true,
        tone: 'ready',
        hintKey: 'app_nav_hint_home',
        fallbackTo: '/'
      };
    case 'settings':
      return {
        enabled: true,
        tone: 'ready',
        hintKey: 'app_nav_hint_settings',
        fallbackTo: '/settings'
      };
    case 'changes':
      if (!project) {
        return {
          enabled: false,
          tone: 'locked',
          hintKey: 'app_nav_hint_open_project',
          fallbackTo: '/'
        };
      }

      if (!project.isProtected) {
        return {
          enabled: true,
          tone: 'next',
          hintKey: 'app_nav_hint_enable_protection',
          fallbackTo: '/changes'
        };
      }

      if ((historyCount ?? 0) === 0) {
        return {
          enabled: true,
          tone: 'next',
          hintKey: 'app_nav_hint_first_save',
          fallbackTo: '/changes'
        };
      }

      return {
        enabled: true,
        tone: 'ready',
        hintKey: 'app_nav_hint_changes',
        fallbackTo: '/changes'
      };
    case 'timeline':
      if (!project) {
        return {
          enabled: false,
          tone: 'locked',
          hintKey: 'app_nav_hint_open_project',
          fallbackTo: '/'
        };
      }

      if (!project.isProtected) {
        return {
          enabled: false,
          tone: 'locked',
          hintKey: 'app_nav_hint_enable_protection',
          fallbackTo: '/changes'
        };
      }

      if (historyLoading) {
        return {
          enabled: false,
          tone: 'locked',
          hintKey: 'app_nav_hint_checking_history',
          fallbackTo: '/'
        };
      }

      if ((historyCount ?? 0) === 0) {
        return {
          enabled: false,
          tone: 'locked',
          hintKey: 'app_nav_hint_first_save',
          fallbackTo: '/changes'
        };
      }

      return {
        enabled: true,
        tone: 'ready',
        hintKey: 'app_nav_hint_timeline',
        fallbackTo: '/timeline'
      };
    case 'plans':
      if (!project) {
        return {
          enabled: false,
          tone: 'locked',
          hintKey: 'app_nav_hint_open_project',
          fallbackTo: '/'
        };
      }

      if (!project.isProtected) {
        return {
          enabled: false,
          tone: 'locked',
          hintKey: 'app_nav_hint_enable_protection',
          fallbackTo: '/changes'
        };
      }

      if (historyLoading) {
        return {
          enabled: false,
          tone: 'locked',
          hintKey: 'app_nav_hint_checking_history',
          fallbackTo: '/'
        };
      }

      if ((historyCount ?? 0) === 0) {
        return {
          enabled: false,
          tone: 'locked',
          hintKey: 'app_nav_hint_first_save',
          fallbackTo: '/changes'
        };
      }

      return {
        enabled: true,
        tone: 'ready',
        hintKey: 'app_nav_hint_plans',
        fallbackTo: '/plans'
      };
  }
}
