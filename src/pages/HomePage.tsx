import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { resolveGettingStartedState } from '../app/getting-started';
import { resolveSidebarNavState } from '../app/navigation-state';
import { resolvePrimaryTaskKey } from '../app/primary-task';
import { useProjectHistoryCount } from '../app/use-project-history-count';
import { toPlanLabel, useI18n } from '../i18n';
import { useAppStore } from '../stores/useAppStore';

type JourneyState = 'done' | 'current' | 'upcoming';

interface FocusAction {
  title: string;
  detail: string;
  actionLabel: string;
  actionType: 'link' | 'button';
  actionTo?: string;
  onAction?: () => Promise<void>;
}

interface JourneyStep {
  key: string;
  title: string;
  detail: string;
  state: JourneyState;
}

export function HomePage() {
  const { project, config } = useAppStore();
  const { openProjectFolder, openCloneProjectDialog, openProjectByPath, enableProtection } = useAppActions();
  const { t } = useI18n();
  const { historyCount, historyLoading } = useProjectHistoryCount(
    project?.path,
    project?.isProtected,
    `${project?.pendingChangeCount ?? 0}:${project?.currentPlan ?? ''}`
  );
  const gettingStarted = resolveGettingStartedState(project, historyCount);
  const primaryTaskKey = resolvePrimaryTaskKey(project, historyCount);

  const focusAction = useMemo<FocusAction>(() => {
    switch (primaryTaskKey) {
      case 'open':
        return {
          title: t('home_focus_open_title'),
          detail: t('home_focus_open_desc'),
          actionLabel: t('home_next_open_project'),
          actionType: 'button',
          onAction: openProjectFolder
        };
      case 'protect':
        return {
          title: t('home_focus_protect_title'),
          detail: t('home_focus_protect_desc'),
          actionLabel: t('home_next_enable_protection'),
          actionType: 'button',
          onAction: enableProtection
        };
      case 'save':
        return {
          title: t('home_focus_save_title'),
          detail:
            (project?.pendingChangeCount ?? 0) > 0
              ? t('home_next_save_attention', { count: project?.pendingChangeCount ?? 0 })
              : t('home_focus_save_desc'),
          actionLabel: t('home_next_open_changes'),
          actionType: 'link',
          actionTo: '/changes'
        };
      default:
        return {
          title: t('home_focus_timeline_title'),
          detail: t('home_focus_timeline_desc'),
          actionLabel: t('home_next_open_timeline'),
          actionType: 'link',
          actionTo: '/timeline'
        };
    }
  }, [enableProtection, openProjectFolder, primaryTaskKey, project?.pendingChangeCount, t]);

  const journeySteps = useMemo<JourneyStep[]>(() => {
    const hasProject = Boolean(project);
    const isProtected = Boolean(project?.isProtected);
    const hasHistory = (historyCount ?? 0) > 0;
    const hasPending = (project?.pendingChangeCount ?? 0) > 0;

    return [
      {
        key: 'protect',
        title: t('home_step_protect_title'),
        detail: !hasProject
          ? t('home_step_protect_wait')
          : isProtected
            ? t('home_step_protect_done')
            : t('home_step_protect_current'),
        state:
          !hasProject ? 'upcoming' : isProtected ? 'done' : gettingStarted.key === 'protect' ? 'current' : 'upcoming'
      },
      {
        key: 'save',
        title: t('home_step_save_title'),
        detail: !isProtected
          ? t('home_step_save_wait')
          : hasPending
            ? t('home_next_save_attention', { count: project?.pendingChangeCount ?? 0 })
            : hasHistory
              ? t('home_step_save_done')
              : t('home_focus_save_desc'),
        state:
          !isProtected
            ? 'upcoming'
            : hasPending || !hasHistory
              ? gettingStarted.key === 'save'
                ? 'current'
                : 'upcoming'
              : 'done'
      },
      {
        key: 'ideas',
        title: t('home_step_ideas_title'),
        detail: hasHistory ? t('home_step_ideas_ready') : t('home_step_ideas_wait'),
        state: hasHistory ? 'done' : 'upcoming'
      }
    ];
  }, [gettingStarted.key, historyCount, project, t]);

  function renderFocusAction() {
    if (focusAction.actionType === 'button') {
      return (
        <button className="btn btn-primary" onClick={() => void focusAction.onAction?.()}>
          {focusAction.actionLabel}
        </button>
      );
    }

    return (
      <Link className="btn btn-primary" to={focusAction.actionTo ?? '/'}>
        {focusAction.actionLabel}
      </Link>
    );
  }

  function toJourneyStateLabel(state: JourneyState) {
    switch (state) {
      case 'done':
        return t('home_step_state_done');
      case 'current':
        return t('home_step_state_current');
      default:
        return t('home_step_state_upcoming');
    }
  }

  function recentProjectName(projectPath: string) {
    return projectPath.split(/[\\/]/).pop() || projectPath;
  }

  const availableAreas = project
    ? [
        {
          key: 'changes' as const,
          title: t('app_nav_changes'),
          actionLabel: t('home_action_view_changes'),
          actionTo: '/changes'
        },
        {
          key: 'timeline' as const,
          title: t('app_nav_timeline'),
          actionLabel: t('home_action_view_timeline'),
          actionTo: '/timeline'
        },
        {
          key: 'plans' as const,
          title: t('app_nav_plans'),
          actionLabel: t('home_action_manage_plans'),
          actionTo: '/plans'
        }
      ].map((item) => ({
        ...item,
        state: resolveSidebarNavState(item.key, project, historyCount, historyLoading)
      }))
    : [];

  if (!project) {
    return (
      <div className="page home-start-page">
        <section className="hero-card hero-card-compact">
          <div>
            <h1>{t('home_start_title')}</h1>
            <p>{t('home_start_subtitle')}</p>
          </div>
        </section>

        <section className="home-entry-grid">
          <article className="panel entry-card">
            <div className="entry-card-copy">
              <span className="pill">{t('home_entry_local_badge')}</span>
              <h2>{t('home_entry_local_title')}</h2>
              <p>{t('home_entry_local_desc')}</p>
            </div>
            <button className="btn btn-primary" onClick={() => void openProjectFolder()}>
              {t('home_entry_local_action')}
            </button>
          </article>

          <article className="panel entry-card entry-card-accent">
            <div className="entry-card-copy">
              <span className="pill">{t('home_entry_github_badge')}</span>
              <h2>{t('home_entry_github_title')}</h2>
              <p>{t('home_entry_github_desc')}</p>
            </div>
            <button className="btn btn-primary" onClick={() => void openCloneProjectDialog()}>
              {t('home_entry_github_action')}
            </button>
          </article>
        </section>

        <section className="panel">
          <h2>{t('home_recent_projects')}</h2>
          {!config || config.recentProjects.length === 0 ? (
            <p className="muted">{t('home_recent_projects_empty')}</p>
          ) : (
            <ul className="list">
              {config.recentProjects.map((item) => (
                <li key={item}>
                  <button className="list-button list-item" onClick={() => void openProjectByPath(item)}>
                    <div>
                      <div className="item-title">{recentProjectName(item)}</div>
                      <div className="item-subtle">{item}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="hero-card hero-card-compact">
        <div>
          <h1>{t('home_project_opened_title')}</h1>
          <p>{t('home_project_opened_subtitle', { name: project.name })}</p>
        </div>
        <div className="hero-summary">
          <div>
            <span className="status-label">{t('home_label_current_plan')}</span>
            <strong>
              {toPlanLabel(
                project.currentPlan,
                project.currentPlan === 'main' || project.currentPlan === 'master',
                t
              )}
            </strong>
          </div>
          <div>
            <span className="status-label">{t('home_label_unsaved_changes')}</span>
            <strong>{t('common_file_unit', { count: project.pendingChangeCount })}</strong>
          </div>
          <div>
            <span className="status-label">{t('home_label_saved_records')}</span>
            <strong>
              {historyLoading
                ? t('home_history_loading_short')
                : t('common_record_unit', { count: historyCount ?? 0 })}
            </strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>{t('home_next_title')}</h2>
            <p className="panel-subtitle">{t('home_next_subtitle')}</p>
          </div>
        </div>

        <div className="current-step-card current-step-card-compact">
          <div className="section-head">
            <div>
              <h3>{focusAction.title}</h3>
              <p className="panel-subtitle">{focusAction.detail}</p>
            </div>
            <span className="tone-badge attention">{t('home_step_state_current')}</span>
          </div>
          <div className="actions-row">{renderFocusAction()}</div>
        </div>

        <div className="journey-grid">
          {journeySteps.map((step, index) => (
            <article key={step.key} className={`journey-card ${step.state}`}>
              <div className="journey-card-head">
                <span className="journey-step-index">{index + 1}</span>
                <span className={`tone-badge ${step.state === 'done' ? 'ready' : step.state === 'current' ? 'attention' : 'waiting'}`}>
                  {toJourneyStateLabel(step.state)}
                </span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid-two">
        <section className="panel">
          <h2>{t('home_project_status')}</h2>
          <div className="status-stack">
            <div>
              <span className="status-label">{t('home_label_project')}</span>
              <strong>{project.name}</strong>
            </div>
            <div>
              <span className="status-label">{t('home_label_current_plan')}</span>
              <strong>
                {toPlanLabel(
                  project.currentPlan,
                  project.currentPlan === 'main' || project.currentPlan === 'master',
                  t
                )}
              </strong>
            </div>
            <div>
              <span className="status-label">{t('home_label_unsaved_changes')}</span>
              <strong>{t('common_file_unit', { count: project.pendingChangeCount })}</strong>
            </div>
            <div>
              <span className="status-label">{t('home_label_saved_records')}</span>
              <strong>
                {historyLoading
                  ? t('home_history_loading_short')
                  : t('common_record_unit', { count: historyCount ?? 0 })}
              </strong>
            </div>
            <div>
              <span className="status-label">{t('home_label_path')}</span>
              <strong className="project-path">{project.path}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>{t('home_available_title')}</h2>
          <p className="panel-subtitle">{t('home_available_subtitle')}</p>
          <div className="next-grid availability-grid">
            {availableAreas.map((item) => {
              const badgeState: JourneyState =
                item.state.tone === 'ready'
                  ? 'done'
                  : item.state.tone === 'next'
                    ? 'current'
                    : 'upcoming';
              const toneClass =
                badgeState === 'done' ? 'ready' : badgeState === 'current' ? 'attention' : 'waiting';

              return (
                <article key={item.key} className={`next-card ${toneClass}`}>
                  <div className="section-head">
                    <h3>{item.title}</h3>
                    <span className={`tone-badge ${toneClass}`}>{toJourneyStateLabel(badgeState)}</span>
                  </div>
                  <p className="next-card-copy">{t(item.state.hintKey)}</p>
                  {item.state.enabled ? (
                    <div className="actions-row">
                      <Link className="btn btn-secondary" to={item.actionTo}>
                        {item.actionLabel}
                      </Link>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
