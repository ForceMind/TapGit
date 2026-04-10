import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { resolvePrimaryTaskKey } from '../app/primary-task';
import { useProjectHistoryCount } from '../app/use-project-history-count';
import { toPlanLabel, useI18n } from '../i18n';
import { useAppStore } from '../stores/useAppStore';

type WorkspaceTone = 'ready' | 'attention' | 'locked';

interface FocusAction {
  title: string;
  detail: string;
  actionLabel: string;
  actionType: 'link' | 'button';
  actionTo?: string;
  onAction?: () => Promise<void>;
}

interface WorkspaceTile {
  key: 'changes' | 'timeline' | 'plans';
  title: string;
  metric: string;
  summary: string;
  actionTo?: string;
  tone: WorkspaceTone;
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
        label: copy('\u5f53\u524d\u526f\u672c', 'Current copy'),
        value: toPlanLabel(
          project.currentPlan,
          project.currentPlan === 'main' || project.currentPlan === 'master',
          t
        )
      },
      {
        key: 'changes',
        label: copy('\u672a\u4fdd\u5b58\u4fee\u6539', 'Unsaved'),
        value:
          project.pendingChangeCount > 0
            ? t('common_file_unit', { count: project.pendingChangeCount })
            : copy('\u5f88\u5e72\u51c0', 'Clean')
      },
      {
        key: 'history',
        label: copy('\u5df2\u4fdd\u5b58\u7248\u672c', 'Saved points'),
        value: historyLoading
          ? copy('\u6b63\u5728\u8bfb\u53d6', 'Loading')
          : t('common_record_unit', { count: historyCount ?? 0 })
      }
    ];
  }, [copy, historyCount, historyLoading, project, t]);

  const focusAction = useMemo<FocusAction>(() => {
    switch (primaryTaskKey) {
      case 'open':
        return {
          title: copy('\u6253\u5f00\u4e00\u4e2a\u9879\u76ee', 'Open a project'),
          detail: copy(
            '\u5148\u9009\u62e9\u4e00\u4e2a\u9879\u76ee\u6587\u4ef6\u5939\uff0c\u6211\u4eec\u518d\u5e2e\u4f60\u7ee7\u7eed\u3002',
            'Choose a project folder first, then continue from there.'
          ),
          actionLabel: t('home_next_open_project'),
          actionType: 'button',
          onAction: openProjectFolder
        };
      case 'protect':
        return {
          title: copy('\u5148\u6253\u5f00\u7248\u672c\u4fdd\u62a4', 'Turn on protection first'),
          detail: copy(
            '\u6709\u4e86\u7248\u672c\u4fdd\u62a4\uff0c\u8fd9\u4e2a\u9879\u76ee\u624d\u80fd\u5b89\u5168\u4fdd\u5b58\u3001\u6062\u590d\u548c\u540c\u6b65\u3002',
            'Protection is what makes saving, restoring, and syncing safe.'
          ),
          actionLabel: t('home_next_enable_protection'),
          actionType: 'button',
          onAction: enableProtection
        };
      case 'save':
        return {
          title: copy('\u5148\u4fdd\u5b58\u8fd9\u6b21\u5de5\u4f5c', 'Save this work first'),
          detail:
            (project?.pendingChangeCount ?? 0) > 0
              ? copy(
                  `\u8fd9\u4e2a\u9879\u76ee\u8fd8\u6709 ${project?.pendingChangeCount ?? 0} \u4e2a\u6587\u4ef6\u6ca1\u6709\u4fdd\u5b58\u3002`,
                  `${project?.pendingChangeCount ?? 0} files are waiting to be saved.`
                )
              : copy(
                  '\u5148\u7559\u4e0b\u7b2c\u4e00\u4e2a\u53ef\u56de\u5230\u7684\u4fdd\u5b58\u70b9\u3002',
                  'Create the first safe point before you keep going.'
                ),
          actionLabel: copy('\u53bb\u770b\u4fee\u6539', 'Review Changes'),
          actionType: 'link',
          actionTo: '/changes'
        };
      default:
        return {
          title: copy('\u73b0\u5728\u53ef\u4ee5\u5f80\u540e\u8d70\u4e86', 'You can move forward now'),
          detail: copy(
            '\u8fd9\u4e2a\u9879\u76ee\u5df2\u7ecf\u6709\u53ef\u56de\u5230\u7684\u4fdd\u5b58\u70b9\u3002',
            'This project already has saved points you can return to.'
          ),
          actionLabel: copy('\u6253\u5f00\u5386\u53f2', 'Open History'),
          actionType: 'link',
          actionTo: '/timeline'
        };
    }
  }, [copy, enableProtection, openProjectFolder, primaryTaskKey, project?.pendingChangeCount, t]);

  const workspaceTiles = useMemo<WorkspaceTile[]>(() => {
    if (!project) {
      return [];
    }

    const hasHistory = (historyCount ?? 0) > 0;
    const pendingCount = project.pendingChangeCount;

    return [
      {
        key: 'changes',
        title: copy('\u4fee\u6539', 'Changes'),
        metric: project.isProtected
          ? pendingCount > 0
            ? t('common_file_unit', { count: pendingCount })
            : copy('\u5df2\u7ecf\u5e72\u51c0', 'Clean')
          : copy('\u672a\u5f00\u542f', 'Locked'),
        summary: !project.isProtected
          ? copy('\u5148\u5f00\u542f\u7248\u672c\u4fdd\u62a4\u3002', 'Turn on protection first.')
          : pendingCount > 0
            ? copy('\u8fd9\u91cc\u662f\u4f60\u8fd9\u6b21\u7684\u5de5\u4f5c\u533a\u3002', 'This is where the current work waits.')
            : copy('\u6682\u65f6\u6ca1\u6709\u9700\u8981\u4fdd\u5b58\u7684\u4fee\u6539\u3002', 'Nothing is waiting right now.'),
        actionTo: project.isProtected ? '/changes' : undefined,
        tone: !project.isProtected ? 'locked' : pendingCount > 0 ? 'attention' : 'ready'
      },
      {
        key: 'timeline',
        title: copy('\u5386\u53f2', 'History'),
        metric: historyLoading
          ? copy('\u6b63\u5728\u8bfb\u53d6', 'Loading')
          : t('common_record_unit', { count: historyCount ?? 0 }),
        summary: historyLoading
          ? copy('\u6b63\u5728\u6574\u7406\u4f60\u7684\u4fdd\u5b58\u70b9\u3002', 'Checking your saved points.')
          : hasHistory
            ? copy('\u4ece\u8fd9\u91cc\u56de\u770b\u6216\u6062\u590d\u4efb\u4f55\u4e00\u6b21\u4fdd\u5b58\u3002', 'Review or restore any saved point here.')
            : copy('\u5148\u4fdd\u5b58\u4e00\u6b21\uff0c\u8fd9\u91cc\u624d\u4f1a\u6253\u5f00\u3002', 'Save once to unlock this area.'),
        actionTo: hasHistory ? '/timeline' : undefined,
        tone: historyLoading ? 'locked' : hasHistory ? 'ready' : 'locked'
      },
      {
        key: 'plans',
        title: copy('\u8bd5\u9a8c\u533a', 'Idea Lab'),
        metric: !hasHistory
          ? copy('\u9700\u8981\u7b2c\u4e00\u6b21\u4fdd\u5b58', 'Need first save')
          : pendingCount > 0
            ? copy('\u5148\u4fdd\u5b58\u5f53\u524d\u5de5\u4f5c', 'Save work first')
            : copy('\u53ef\u4ee5\u5f00\u59cb', 'Ready'),
        summary: !hasHistory
          ? copy('\u6709\u4e86\u7a33\u5b9a\u7248\u672c\u540e\uff0c\u518d\u6765\u8fd9\u91cc\u5b89\u5168\u8bd5\u65b0\u60f3\u6cd5\u3002', 'Come here after the first stable save.')
          : pendingCount > 0
            ? copy('\u5148\u628a\u624b\u4e0a\u8fd9\u6279\u6539\u52a8\u6536\u597d\uff0c\u518d\u5f00\u8bd5\u9a8c\u526f\u672c\u3002', 'Save current work before starting an experiment.')
            : copy('\u5728\u5355\u72ec\u526f\u672c\u91cc\u6162\u6162\u8bd5\uff0c\u4e0d\u6253\u4e71\u7a33\u5b9a\u7248\u672c\u3002', 'Try ideas in a separate copy without disturbing the stable version.'),
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

  function renderWorkspaceTile(tile: WorkspaceTile) {
    const content = (
      <>
        <div className="workspace-card-head">
          <h3>{tile.title}</h3>
          <span className={`workspace-card-metric ${tile.tone}`}>{tile.metric}</span>
        </div>
        <p>{tile.summary}</p>
        <span className="workspace-card-action">
          {tile.actionTo ? copy('\u6253\u5f00', 'Open') : copy('\u7a0d\u540e', 'Later')}
        </span>
      </>
    );

    if (tile.actionTo) {
      return (
        <Link key={tile.key} className={`workspace-card ${tile.tone}`} to={tile.actionTo}>
          {content}
        </Link>
      );
    }

    return (
      <article key={tile.key} className={`workspace-card ${tile.tone} is-disabled`}>
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
      <section className="panel project-dashboard">
        <div className="project-dashboard-main">
          <span className="pill">{copy('\u5f53\u524d\u9879\u76ee', 'Current Project')}</span>
          <h1 className="project-overview-title">{project.name}</h1>
          <p className="project-overview-path">{project.path}</p>
          <div className="project-dashboard-summary">
            {projectStats.map((item) => (
              <article key={item.key} className="project-stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="project-task-panel">
          <span className="project-primary-label">{copy('\u73b0\u5728\u5148\u505a\u8fd9\u4ef6\u4e8b', 'Do This Now')}</span>
          <h2>{focusAction.title}</h2>
          <p>{focusAction.detail}</p>
          <div className="actions-row">{renderFocusAction()}</div>
        </div>
      </section>

      <section className="project-workbench">
        {workspaceTiles.map((tile) => renderWorkspaceTile(tile))}
      </section>
    </div>
  );
}
