import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { toCloudStatusText, toLocalizedErrorMessage, toPlanLabel, useI18n } from '../i18n';
import { getBridge, unwrapResult } from '../services/bridge';
import { CloudSyncStatus } from '../shared/contracts';
import { useAppStore } from '../stores/useAppStore';

type HomeCardTone = 'ready' | 'attention' | 'waiting';

interface HomeNextCard {
  key: string;
  title: string;
  detail: string;
  tone: HomeCardTone;
  actionLabel: string;
  actionType: 'link' | 'button';
  actionTo?: string;
  onAction?: () => Promise<void>;
}

export function HomePage() {
  const { project, config, setConfig, setNotice } = useAppStore();
  const { openProjectFolder, openProjectByPath, enableProtection } = useAppActions();
  const { t } = useI18n();
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

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
          setCloudStatus(null);
          setOverviewLoading(false);
        }
        return;
      }

      setOverviewLoading(true);

      const [historyResult, cloudResult] = await Promise.allSettled([
        unwrapResult(getBridge().listHistory(project.path)),
        unwrapResult(getBridge().getCloudSyncStatus(project.path))
      ]);

      if (cancelled) {
        return;
      }

      setHistoryCount(historyResult.status === 'fulfilled' ? historyResult.value.length : null);
      setCloudStatus(cloudResult.status === 'fulfilled' ? cloudResult.value : null);
      setOverviewLoading(false);
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [project?.path, project?.isProtected, project?.pendingChangeCount, project?.currentPlan]);

  const nextCards = useMemo<HomeNextCard[]>(() => {
    const cards: HomeNextCard[] = [];

    if (!project) {
      cards.push(
        {
          key: 'protection',
          title: t('home_next_protection_title'),
          detail: t('home_next_protection_no_project'),
          tone: 'waiting',
          actionLabel: t('home_next_open_project'),
          actionType: 'button',
          onAction: openProjectFolder
        },
        {
          key: 'save',
          title: t('home_next_save_title'),
          detail: t('home_next_save_no_project'),
          tone: 'waiting',
          actionLabel: t('home_next_open_project'),
          actionType: 'button',
          onAction: openProjectFolder
        },
        {
          key: 'history',
          title: t('home_next_history_title'),
          detail: t('home_next_history_no_project'),
          tone: 'waiting',
          actionLabel: t('home_next_open_project'),
          actionType: 'button',
          onAction: openProjectFolder
        },
        {
          key: 'cloud',
          title: t('home_next_cloud_title'),
          detail: t('home_next_cloud_no_project'),
          tone: 'waiting',
          actionLabel: t('home_next_open_project'),
          actionType: 'button',
          onAction: openProjectFolder
        }
      );

      return cards;
    }

    if (!project.isProtected) {
      cards.push(
        {
          key: 'protection',
          title: t('home_next_protection_title'),
          detail: t('home_next_protection_enable'),
          tone: 'attention',
          actionLabel: t('home_next_enable_protection'),
          actionType: 'button',
          onAction: enableProtection
        },
        {
          key: 'save',
          title: t('home_next_save_title'),
          detail: t('home_next_save_wait_protection'),
          tone: 'waiting',
          actionLabel: t('home_next_enable_protection'),
          actionType: 'button',
          onAction: enableProtection
        },
        {
          key: 'history',
          title: t('home_next_history_title'),
          detail: t('home_next_history_wait_protection'),
          tone: 'waiting',
          actionLabel: t('home_next_enable_protection'),
          actionType: 'button',
          onAction: enableProtection
        },
        {
          key: 'cloud',
          title: t('home_next_cloud_title'),
          detail: t('home_next_cloud_wait_protection'),
          tone: 'waiting',
          actionLabel: t('home_next_enable_protection'),
          actionType: 'button',
          onAction: enableProtection
        }
      );

      return cards;
    }

    cards.push({
      key: 'protection',
      title: t('home_next_protection_title'),
      detail: t('home_next_protection_ready'),
      tone: 'ready',
      actionLabel: t('home_next_open_changes'),
      actionType: 'link',
      actionTo: '/changes'
    });

    if (project.pendingChangeCount > 0) {
      cards.push({
        key: 'save',
        title: t('home_next_save_title'),
        detail: t('home_next_save_attention', { count: project.pendingChangeCount }),
        tone: 'attention',
        actionLabel: t('home_next_open_changes'),
        actionType: 'link',
        actionTo: '/changes'
      });
    } else if (historyCount === 0) {
      cards.push({
        key: 'save',
        title: t('home_next_save_title'),
        detail: t('home_next_save_first'),
        tone: 'attention',
        actionLabel: t('home_next_open_changes'),
        actionType: 'link',
        actionTo: '/changes'
      });
    } else {
      cards.push({
        key: 'save',
        title: t('home_next_save_title'),
        detail: t('home_next_save_ready'),
        tone: 'ready',
        actionLabel: t('home_next_open_timeline'),
        actionType: 'link',
        actionTo: '/timeline'
      });
    }

    if (overviewLoading && historyCount === null) {
      cards.push({
        key: 'history',
        title: t('home_next_history_title'),
        detail: t('home_next_history_loading'),
        tone: 'waiting',
        actionLabel: t('home_next_open_timeline'),
        actionType: 'link',
        actionTo: '/timeline'
      });
    } else if (historyCount === 0) {
      cards.push({
        key: 'history',
        title: t('home_next_history_title'),
        detail: t('home_next_history_empty'),
        tone: 'attention',
        actionLabel: t('home_next_open_changes'),
        actionType: 'link',
        actionTo: '/changes'
      });
    } else if (historyCount !== null) {
      cards.push({
        key: 'history',
        title: t('home_next_history_title'),
        detail: t('home_next_history_ready', { count: historyCount ?? 0 }),
        tone: 'ready',
        actionLabel: t('home_next_open_timeline'),
        actionType: 'link',
        actionTo: '/timeline'
      });
    } else {
      cards.push({
        key: 'history',
        title: t('home_next_history_title'),
        detail: t('home_next_history_loading'),
        tone: 'waiting',
        actionLabel: t('home_next_open_timeline'),
        actionType: 'link',
        actionTo: '/timeline'
      });
    }

    if (overviewLoading && !cloudStatus) {
      cards.push({
        key: 'cloud',
        title: t('home_next_cloud_title'),
        detail: t('home_next_cloud_loading'),
        tone: 'waiting',
        actionLabel: t('home_next_open_settings'),
        actionType: 'link',
        actionTo: '/settings'
      });
    } else if (!cloudStatus || !cloudStatus.connected) {
      cards.push({
        key: 'cloud',
        title: t('home_next_cloud_title'),
        detail: t('home_next_cloud_connect'),
        tone: 'attention',
        actionLabel: t('home_next_open_settings'),
        actionType: 'link',
        actionTo: '/settings'
      });
    } else if (!cloudStatus.hasTracking) {
      cards.push({
        key: 'cloud',
        title: t('home_next_cloud_title'),
        detail: t('home_next_cloud_upload_first'),
        tone: 'attention',
        actionLabel: t('home_next_open_settings'),
        actionType: 'link',
        actionTo: '/settings'
      });
    } else if (cloudStatus.pendingUpload > 0 || cloudStatus.pendingDownload > 0) {
      cards.push({
        key: 'cloud',
        title: t('home_next_cloud_title'),
        detail: toCloudStatusText(cloudStatus, t),
        tone: 'attention',
        actionLabel: t('home_next_open_settings'),
        actionType: 'link',
        actionTo: '/settings'
      });
    } else {
      cards.push({
        key: 'cloud',
        title: t('home_next_cloud_title'),
        detail: t('home_next_cloud_ready'),
        tone: 'ready',
        actionLabel: t('home_next_open_settings'),
        actionType: 'link',
        actionTo: '/settings'
      });
    }

    return cards;
  }, [
    cloudStatus,
    enableProtection,
    historyCount,
    openProjectFolder,
    overviewLoading,
    project,
    t
  ]);

  function renderCardAction(card: HomeNextCard) {
    if (card.actionType === 'button') {
      return (
        <button className="btn btn-secondary" onClick={() => void card.onAction?.()}>
          {card.actionLabel}
        </button>
      );
    }

    return (
      <Link className="btn btn-secondary" to={card.actionTo ?? '/'}>
        {card.actionLabel}
      </Link>
    );
  }

  function toStatusLabel(tone: HomeCardTone) {
    switch (tone) {
      case 'attention':
        return t('home_next_status_attention');
      case 'ready':
        return t('home_next_status_ready');
      default:
        return t('home_next_status_waiting');
    }
  }

  return (
    <div className="page">
      <div className="hero-card">
        <div>
          <h1>{t('home_title')}</h1>
          <p>{t('home_subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => void openProjectFolder()}>
          {t('home_open_folder')}
        </button>
      </div>

      {config?.settings.showBeginnerGuide ? (
        <section className="panel guide-card">
          <div className="section-head">
            <h2>{t('home_guide_title')}</h2>
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
        <div className="next-grid">
          {nextCards.map((card) => (
            <article key={card.key} className={`next-card ${card.tone}`}>
              <div className="section-head">
                <h3>{card.title}</h3>
                <span className={`tone-badge ${card.tone}`}>{toStatusLabel(card.tone)}</span>
              </div>
              <p className="next-card-copy">{card.detail}</p>
              {renderCardAction(card)}
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
                <li key={item} className="list-item">
                  <div>
                    <div className="item-title">{item.split(/[\\/]/).pop()}</div>
                    <div className="item-subtle">{item}</div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => void openProjectByPath(item)}>
                    {t('home_open')}
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
              <div className="quick-actions">
                <Link className="btn btn-secondary" to="/changes">
                  {t('home_action_view_changes')}
                </Link>
                <Link className="btn btn-secondary" to="/timeline">
                  {t('home_action_view_timeline')}
                </Link>
                <Link className="btn btn-secondary" to="/plans">
                  {t('home_action_manage_plans')}
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
