import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { resolvePrimaryTaskKey } from '../app/primary-task';
import { useProjectHistoryCount } from '../app/use-project-history-count';
import { toPlanLabel, useI18n } from '../i18n';
import { useAppStore } from '../stores/useAppStore';

type WorkspaceCardTone = 'ready' | 'attention' | 'locked';

interface FocusAction {
  title: string;
  detail: string;
  actionLabel: string;
  actionType: 'link' | 'button';
  actionTo?: string;
  onAction?: () => Promise<void>;
}

interface WorkspaceCard {
  key: 'changes' | 'timeline' | 'plans';
  title: string;
  metric?: string;
  detail: string;
  actionLabel?: string;
  actionTo?: string;
  tone: WorkspaceCardTone;
}

export function HomePage() {
  const { project, config } = useAppStore();
  const { openProjectFolder, openCloneProjectDialog, openProjectByPath, enableProtection } = useAppActions();
  const { locale, t } = useI18n();
  const { historyCount, historyLoading } = useProjectHistoryCount(
    project?.path,
    project?.isProtected,
    `${project?.pendingChangeCount ?? 0}:${project?.currentPlan ?? ''}`
  );
  const primaryTaskKey = resolvePrimaryTaskKey(project, historyCount);
  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);
  const projectStats = useMemo(() => {
    if (!project) {
      return [];
    }

    return [
      {
        key: 'plan',
        label: t('home_label_current_plan'),
        value: toPlanLabel(
          project.currentPlan,
          project.currentPlan === 'main' || project.currentPlan === 'master',
          t
        )
      },
      {
        key: 'changes',
        label: t('home_label_unsaved_changes'),
        value:
          project.pendingChangeCount > 0
            ? t('common_file_unit', { count: project.pendingChangeCount })
            : copy('当前很干净', 'Clean')
      },
      {
        key: 'history',
        label: t('home_label_saved_records'),
        value: historyLoading
          ? t('home_history_loading_short')
          : t('common_record_unit', { count: historyCount ?? 0 })
      }
    ];
  }, [historyCount, historyLoading, project, t]);

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

  const workspaceCards = useMemo<WorkspaceCard[]>(() => {
    if (!project) {
      return [];
    }

    const hasHistory = (historyCount ?? 0) > 0;
    const pendingCount = project.pendingChangeCount;

    return [
      {
        key: 'changes',
        title: copy('修改', 'Changes'),
        metric: t('common_file_unit', { count: pendingCount }),
        detail: !project.isProtected
          ? copy('先开启版本保护。', 'Turn on protection first.')
          : pendingCount > 0
            ? copy(`${pendingCount} 个文件正在等你处理。`, `${pendingCount} files are waiting for you.`)
            : copy('现在没有要保存的修改。', 'Nothing to save right now.'),
        actionLabel: project.isProtected ? copy('打开修改', 'Open Changes') : undefined,
        actionTo: project.isProtected ? '/changes' : undefined,
        tone: !project.isProtected ? 'locked' : pendingCount > 0 ? 'attention' : 'ready'
      },
      {
        key: 'timeline',
        title: copy('历史', 'History'),
        metric: historyLoading
          ? t('home_history_loading_short')
          : t('common_record_unit', { count: historyCount ?? 0 }),
        detail: historyLoading
          ? copy('正在检查保存记录。', 'Checking your saved points.')
          : hasHistory
            ? copy('你的保存记录都在这里。', 'Review or restore any saved point.')
            : copy('先保存一次，再来看历史。', 'Save once to unlock history.'),
        actionLabel: hasHistory ? copy('打开历史', 'Open History') : undefined,
        actionTo: hasHistory ? '/timeline' : undefined,
        tone: historyLoading ? 'locked' : hasHistory ? 'ready' : 'locked'
      },
      {
        key: 'plans',
        title: copy('试验区', 'Idea Lab'),
        metric: pendingCount > 0 ? t('common_file_unit', { count: pendingCount }) : undefined,
        detail: !hasHistory
          ? copy('先有一个稳定保存点，再开启试验区。', 'Save once before opening the idea lab.')
          : pendingCount > 0
            ? copy('先保存当前修改，再开始试验。', 'Save current changes before starting an idea copy.')
            : copy('在单独副本里安全试新想法。', 'Use a separate copy for risky edits.'),
        actionLabel: hasHistory && pendingCount === 0 ? copy('打开试验区', 'Open Idea Lab') : undefined,
        actionTo: hasHistory && pendingCount === 0 ? '/plans' : undefined,
        tone: !hasHistory ? 'locked' : pendingCount > 0 ? 'attention' : 'ready'
      }
    ];
  }, [copy, historyCount, historyLoading, project, t]);

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

  function recentProjectName(projectPath: string) {
    return projectPath.split(/[\\/]/).pop() || projectPath;
  }

  function renderWorkspaceCard(card: WorkspaceCard) {
    const content = (
      <>
        <div className="workspace-card-head">
          <h3>{card.title}</h3>
          {card.metric ? <span className={`workspace-card-metric ${card.tone}`}>{card.metric}</span> : null}
        </div>
        <p>{card.detail}</p>
        {card.actionLabel ? <span className="workspace-card-action">{card.actionLabel}</span> : null}
      </>
    );

    if (card.actionTo) {
      return (
        <Link key={card.key} className={`workspace-card ${card.tone}`} to={card.actionTo}>
          {content}
        </Link>
      );
    }

    return (
      <article key={card.key} className={`workspace-card ${card.tone} is-disabled`}>
        {content}
      </article>
    );
  }

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
    <div className="page project-home-page">
      <section className="panel project-overview-panel">
        <div className="project-overview-head">
          <div className="project-overview-copy">
            <h1 className="project-overview-title">{project.name}</h1>
            <p className="project-overview-path">{project.path}</p>
          </div>
          <div className="project-primary-card">
            <span className="project-primary-label">{t('home_now_title')}</span>
            <h2>{focusAction.title}</h2>
            <p>{focusAction.detail}</p>
            <div className="actions-row">{renderFocusAction()}</div>
          </div>
        </div>
        <div className="project-stats-row">
          {projectStats.map((item) => (
            <article key={item.key} className="project-stat-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="workspace-grid">
        {workspaceCards.map((card) => renderWorkspaceCard(card))}
      </section>
    </div>
  );
}
