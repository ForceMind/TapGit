import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { toLocalizedErrorMessage, toPlanLabel, useI18n } from '../i18n';
import { getBridge, unwrapResult } from '../services/bridge';
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
  const { project, config, setConfig, setNotice } = useAppStore();
  const { openProjectFolder, openProjectByPath, enableProtection } = useAppActions();
  const { t } = useI18n();
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function hideBeginnerGuide() {
    try {
      const settings = await unwrapResult(getBridge().updateSettings({ showBeginnerGuide: false }));
      if (config) {
        setConfig({ ...config, settings });
      }
      setNotice({ type: 'success', text: t('home_notice_hide_guide_success') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'home_notice_update_settings_failed')
      });
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (!project?.path || !project.isProtected) {
        if (!cancelled) {
          setHistoryCount(null);
          setHistoryLoading(false);
        }
        return;
      }

      setHistoryLoading(true);
      try {
        const history = await unwrapResult(getBridge().listHistory(project.path));
        if (!cancelled) {
          setHistoryCount(history.length);
        }
      } catch {
        if (!cancelled) {
          setHistoryCount(null);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [project?.path, project?.isProtected, project?.pendingChangeCount, project?.currentPlan]);

  const focusAction = useMemo<FocusAction>(() => {
    if (!project) {
      return {
        title: t('home_focus_open_title'),
        detail: t('home_focus_open_desc'),
        actionLabel: t('home_next_open_project'),
        actionType: 'button',
        onAction: openProjectFolder
      };
    }

    if (!project.isProtected) {
      return {
        title: t('home_focus_protect_title'),
        detail: t('home_focus_protect_desc'),
        actionLabel: t('home_next_enable_protection'),
        actionType: 'button',
        onAction: enableProtection
      };
    }

    if (project.pendingChangeCount > 0 || historyCount === 0) {
      return {
        title: t('home_focus_save_title'),
        detail:
          project.pendingChangeCount > 0
            ? t('home_next_save_attention', { count: project.pendingChangeCount })
            : t('home_focus_save_desc'),
        actionLabel: t('home_next_open_changes'),
        actionType: 'link',
        actionTo: '/changes'
      };
    }

    return {
      title: t('home_focus_timeline_title'),
      detail: t('home_focus_timeline_desc'),
      actionLabel: t('home_next_open_timeline'),
      actionType: 'link',
      actionTo: '/timeline'
    };
  }, [enableProtection, historyCount, openProjectFolder, project, t]);

  const journeySteps = useMemo<JourneyStep[]>(() => {
    const hasProject = Boolean(project);
    const isProtected = Boolean(project?.isProtected);
    const hasHistory = (historyCount ?? 0) > 0;
    const hasPending = (project?.pendingChangeCount ?? 0) > 0;

    return [
      {
        key: 'open',
        title: t('home_step_open_title'),
        detail: hasProject
          ? t('home_step_open_done', { name: project?.name ?? '' })
          : t('home_step_open_wait'),
        state: hasProject ? 'done' : 'current'
      },
      {
        key: 'protect',
        title: t('home_step_protect_title'),
        detail: !hasProject
          ? t('home_step_protect_wait')
          : isProtected
            ? t('home_step_protect_done')
            : t('home_step_protect_current'),
        state: !hasProject ? 'upcoming' : isProtected ? 'done' : 'current'
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
        state: !isProtected ? 'upcoming' : hasPending || !hasHistory ? 'current' : 'done'
      },
      {
        key: 'timeline',
        title: t('home_step_timeline_title'),
        detail: !hasHistory
          ? t('home_step_timeline_wait')
          : hasPending
            ? t('home_focus_timeline_later')
            : t('home_step_timeline_done', { count: historyCount ?? 0 }),
        state: !hasHistory ? 'upcoming' : hasPending ? 'upcoming' : 'done'
      },
      {
        key: 'ideas',
        title: t('home_step_ideas_title'),
        detail: hasHistory ? t('home_step_ideas_ready') : t('home_step_ideas_wait'),
        state: hasHistory ? 'done' : 'upcoming'
      }
    ];
  }, [historyCount, project, t]);

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

  return (
    <div className="page">
      <div className="hero-card">
        <div>
          <h1>{t('home_title')}</h1>
          <p>{t('home_subtitle')}</p>
        </div>
      </div>

      {config?.settings.showBeginnerGuide ? (
        <section className="panel guide-card">
          <div className="section-head">
            <div>
              <h2>{t('home_guide_title')}</h2>
              <p className="panel-subtitle">{t('home_guide_summary')}</p>
            </div>
            <button className="btn btn-secondary" onClick={() => void hideBeginnerGuide()}>
              {t('home_guide_close')}
            </button>
          </div>
          <div className="guide-grid">
            <div className="guide-step">
              <span className="guide-index">1</span>
              <div>
                <strong>{t('home_guide_step1_title')}</strong>
                <p>{t('home_guide_step1_desc')}</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-index">2</span>
              <div>
                <strong>{t('home_guide_step2_title')}</strong>
                <p>{t('home_guide_step2_desc')}</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-index">3</span>
              <div>
                <strong>{t('home_guide_step3_title')}</strong>
                <p>{t('home_guide_step3_desc')}</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-index">4</span>
              <div>
                <strong>{t('home_guide_step4_title')}</strong>
                <p>{t('home_guide_step4_desc')}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>{t('home_next_title')}</h2>
            <p className="panel-subtitle">{t('home_next_subtitle')}</p>
          </div>
        </div>

        <div className="current-step-card">
          <div className="section-head">
            <div>
              <h3>{t('home_now_title')}</h3>
              <p className="panel-subtitle">{focusAction.title}</p>
            </div>
            <span className="tone-badge attention">{t('home_step_state_current')}</span>
          </div>
          <p className="next-card-copy">{focusAction.detail}</p>
          <div className="actions-row">{renderFocusAction()}</div>
        </div>

        <div className="journey-list">
          {journeySteps.map((step, index) => (
            <article key={step.key} className={`journey-step ${step.state}`}>
              <div className="journey-step-index">{index + 1}</div>
              <div className="journey-step-copy">
                <div className="section-head">
                  <h3>{step.title}</h3>
                  <span className={`tone-badge ${step.state === 'done' ? 'ready' : step.state === 'current' ? 'attention' : 'waiting'}`}>
                    {toJourneyStateLabel(step.state)}
                  </span>
                </div>
                <p className="next-card-copy">{step.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid-two">
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

        <section className="panel">
          <h2>{t('home_project_status')}</h2>
          {!project ? (
            <p className="muted">{t('home_project_status_empty')}</p>
          ) : (
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
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
