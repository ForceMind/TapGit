import dayjs from 'dayjs';
import {
  ArrowLeft,
  Clock3,
  CloudDownload,
  CloudUpload,
  Copy,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  HardDrive,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Upload
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { resolvePrimaryTaskKey } from '../app/primary-task';
import { useProjectHistoryCount } from '../app/use-project-history-count';
import { toPlanLabel, useI18n } from '../i18n';
import { getBridge, unwrapResult } from '../services/bridge';
import { ProjectFileEntry, ProjectOverview } from '../shared/contracts';
import { useAppStore } from '../stores/useAppStore';

function formatBytes(value: number | null | undefined) {
  if (!value || value <= 0) {
    return '-';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatTime(timestamp: number | null | undefined, locale: 'en-US' | 'zh-CN') {
  if (!timestamp) {
    return locale === 'zh-CN' ? '还没有保存' : 'Not saved yet';
  }

  const now = dayjs();
  const target = dayjs(timestamp * 1000);
  const minutes = now.diff(target, 'minute');
  const hours = now.diff(target, 'hour');
  const days = now.diff(target, 'day');

  if (minutes < 1) return locale === 'zh-CN' ? '刚刚' : 'Just now';
  if (minutes < 60) return locale === 'zh-CN' ? `${minutes} 分钟前` : `${minutes}m ago`;
  if (hours < 24) return locale === 'zh-CN' ? `${hours} 小时前` : `${hours}h ago`;
  if (days < 7) return locale === 'zh-CN' ? `${days} 天前` : `${days}d ago`;
  return target.format('YYYY-MM-DD');
}

function shortHash(id: string) {
  return id.slice(0, 7);
}

function fileIcon(entry: ProjectFileEntry) {
  return entry.type === 'folder' ? <Folder size={20} /> : <FileText size={19} />;
}

export function HomePage() {
  const { project, config, setNotice } = useAppStore();
  const {
    openProjectFolder,
    openCloneProjectDialog,
    openProjectByPath,
    enableProtection,
    showProjectInFolder,
    refreshProject,
    uploadCloud,
    getLatestFromCloud,
    openIdeaCopyDialog
  } = useAppActions();
  const { locale, t } = useI18n();
  const recentProjects = config?.recentProjects ?? [];
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const { historyCount } = useProjectHistoryCount(
    project?.path,
    project?.isProtected,
    `${project?.pendingChangeCount ?? 0}:${project?.currentPlan ?? ''}`
  );
  const primaryTaskKey = resolvePrimaryTaskKey(project, historyCount);
  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (!project?.path) {
        setOverview(null);
        return;
      }

      setOverviewLoading(true);
      try {
        const data = await unwrapResult(getBridge().getProjectOverview(project.path));
        if (!cancelled) {
          setOverview(data);
        }
      } catch {
        if (!cancelled) {
          setOverview(null);
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    }

    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, [project?.path, project?.pendingChangeCount, project?.currentPlan]);

  const focusAction = useMemo(() => {
    switch (primaryTaskKey) {
      case 'open':
        return {
          title: copy('打开一个项目', 'Open a project'),
          detail: copy('选择本地文件夹，或从 GitHub 获取。', 'Choose a local folder or get one from GitHub.'),
          label: copy('打开项目', 'Open Project'),
          onClick: openProjectFolder,
          to: ''
        };
      case 'protect':
        return {
          title: copy('开启版本保护', 'Turn on protection'),
          detail: copy('开启后才能保存、恢复和试新想法。', 'This unlocks saving, restore, and experiments.'),
          label: copy('开启保护', 'Turn On'),
          onClick: enableProtection,
          to: ''
        };
      case 'save':
        return {
          title: copy('先保存这次修改', 'Save these changes'),
          detail: copy('把当前可用状态留下来。', 'Keep the current working state.'),
          label: copy('去保存', 'Review Changes'),
          to: '/changes'
        };
      default:
        return {
          title: copy('项目已就绪', 'Project ready'),
          detail: copy('可以查看历史、试新想法或同步云端。', 'Review history, try ideas, or sync.'),
          label: copy('查看历史', 'Open History'),
          to: '/timeline'
        };
    }
  }, [copy, enableProtection, openProjectFolder, primaryTaskKey]);

  const projectStats = useMemo(() => {
    if (!project) return [];
    return [
      {
        key: 'plan',
        icon: GitBranch,
        label: copy('当前分支', 'Current copy'),
        value: toPlanLabel(project.currentPlan, project.currentPlan === 'main' || project.currentPlan === 'master', t),
        note: project.currentPlan === 'main' || project.currentPlan === 'master'
          ? copy('默认分支', 'Default copy')
          : copy('试验副本', 'Idea copy')
      },
      {
        key: 'records',
        icon: FileText,
        label: copy('提交', 'Saved points'),
        value: String(overview?.savedRecordCount ?? historyCount ?? 0),
        note: copy('总计保存', 'Total saves')
      },
      {
        key: 'last',
        icon: Clock3,
        label: copy('最后提交', 'Last save'),
        value: formatTime(overview?.lastSavedAt, locale),
        note: overview?.lastSavedMessage || copy('还没有说明', 'No note yet')
      },
      {
        key: 'size',
        icon: HardDrive,
        label: copy('项目大小', 'Project size'),
        value: overviewLoading ? copy('读取中', 'Loading') : formatBytes(overview?.projectSizeBytes),
        note: copy('本地存储', 'Local storage')
      }
    ];
  }, [copy, historyCount, locale, overview, overviewLoading, project, t]);

  function recentProjectName(projectPath: string) {
    return projectPath.split(/[\\/]/).pop() || projectPath;
  }

  function renderFocusButton() {
    if (focusAction.to) {
      return (
        <Link className="btn btn-primary project-header-primary" to={focusAction.to}>
          {focusAction.label}
        </Link>
      );
    }

    return (
      <button className="btn btn-primary project-header-primary" onClick={() => void focusAction.onClick?.()}>
        {focusAction.label}
      </button>
    );
  }

  async function copyRecordId(id: string) {
    await navigator.clipboard?.writeText(id).catch(() => undefined);
    setNotice({ type: 'success', text: copy('已复制编号', 'ID copied') });
  }

  if (!project) {
    return (
      <div className="page home-start-page home-v2-start">
        <section className="start-hero-v2">
          <div>
            <span className="eyebrow">{copy('开始', 'Start')}</span>
            <h1>{copy('先获取或创建一个项目', 'Get or create a project first')}</h1>
            <p>{copy('从 GitHub 获取项目，或选择一个本地文件夹作为新项目。打开后，码迹才会进入这个项目的工作台。', 'Get a project from GitHub, or choose a local folder for a new project. TapGit enters the project workspace after that.')}</p>
          </div>
          <div className="start-actions-v2">
            <button
              type="button"
              className="start-tile-v2 primary"
              aria-label={copy('\u4ece GitHub \u83b7\u53d6', 'Get from GitHub')}
              onClick={() => void openCloneProjectDialog()}
            >
              <CloudDownload size={28} />
              <strong>{copy('从 GitHub 获取项目', 'Get from GitHub')}</strong>
              <span>{copy('输入仓库地址后下载到本机', 'Paste a repository URL and download it')}</span>
            </button>
            <button
              type="button"
              className="start-tile-v2"
              aria-label={copy('\u6253\u5f00\u6216\u521b\u5efa\u672c\u5730\u9879\u76ee', 'Open or Create Local Project')}
              onClick={() => void openProjectFolder()}
            >
              <FolderOpen size={28} />
              <strong>{copy('打开或创建本地项目', 'Open or Create Local Project')}</strong>
              <span>{copy('选择已有文件夹，或新建一个空文件夹', 'Choose an existing folder or create an empty one')}</span>
            </button>
          </div>
        </section>

        <section className="panel recent-panel-v2">
          <div className="panel-title-row">
            <h2>{copy('最近项目', 'Recent Projects')}</h2>
          </div>
          {recentProjects.length === 0 ? (
            <p className="muted">{copy('还没有最近项目。', 'No recent projects yet.')}</p>
          ) : (
            <ul className="recent-list-v2">
              {recentProjects.map((item) => (
                <li key={item}>
                  <button className="recent-row-v2" onClick={() => void openProjectByPath(item)}>
                    <Folder size={20} />
                    <span>
                      <strong>{recentProjectName(item)}</strong>
                      <small>{item}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  const recentRecords = overview?.recentRecords ?? [];
  const files = overview?.files ?? [];
  const isClean = project.pendingChangeCount === 0;

  return (
    <div className="page project-v2-page">
      <button type="button" className="back-link-v2" onClick={() => window.history.back()}>
        <ArrowLeft size={18} />
        {copy('返回', 'Back')}
      </button>

      <section className="project-header-v2">
        <div className="project-header-left">
          <div className="project-avatar-v2">
            <Folder size={38} />
          </div>
          <div className="project-heading-v2">
            <div className="project-title-line-v2">
              <h1>{project.name}</h1>
              <span className="local-badge-v2">{copy('本地项目', 'Local project')}</span>
            </div>
            <p>{project.path}</p>
            <div className="project-meta-row-v2">
              <span>
                <CloudUpload size={16} />
                {overview?.lastSavedMessage || copy('还没有提交', 'No saved note yet')}
              </span>
              <span>
                <Clock3 size={16} />
                {formatTime(overview?.lastSavedAt, locale)}
              </span>
              <span>
                <GitBranch size={16} />
                {project.currentPlan}
              </span>
            </div>
          </div>
        </div>

        <div className="project-header-actions-v2">
          {renderFocusButton()}
          <button className="btn btn-secondary" onClick={() => void showProjectInFolder()}>
            <FolderOpen size={17} />
            {copy('在文件夹中查看', 'Show in Folder')}
          </button>
          <button className="icon-button-v2" onClick={() => void refreshProject()} aria-label={copy('刷新', 'Refresh')}>
            <RefreshCw size={20} />
          </button>
        </div>
      </section>

      <section className="stats-grid-v2">
        {projectStats.map((item) => {
          const Icon = item.icon;
          return (
            <article className="stat-card-v2" key={item.key}>
              <span className={`stat-icon-v2 ${item.key}`}>
                <Icon size={22} />
              </span>
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="project-content-grid-v2">
        <div className="project-main-column-v2">
          <section className="panel file-panel-v2">
            <div className="panel-title-row">
              <h2>{copy('文件', 'Files')}</h2>
              <div className="panel-actions-v2">
                <button className="btn btn-secondary" onClick={() => void showProjectInFolder()}>
                  <FolderOpen size={16} />
                  {copy('打开文件夹', 'Open Folder')}
                </button>
                <button className="btn btn-secondary" onClick={() => void refreshProject()}>
                  <RefreshCw size={16} />
                  {copy('刷新', 'Refresh')}
                </button>
              </div>
            </div>

            <div className="file-table-v2">
              <div className="file-table-head-v2">
                <span>{copy('名称', 'Name')}</span>
                <span>{copy('最后修改', 'Modified')}</span>
                <span>{copy('大小', 'Size')}</span>
              </div>
              {files.length === 0 ? (
                <div className="file-empty-v2">{overviewLoading ? copy('正在读取文件...', 'Loading files...') : copy('还没有可显示的文件。', 'No files to show yet.')}</div>
              ) : (
                files.map((entry) => (
                  <div className="file-row-v2" key={entry.path}>
                    <span className="file-name-v2">
                      {fileIcon(entry)}
                      {entry.name}
                    </span>
                    <span>{formatTime(entry.modifiedAt, locale)}</span>
                    <span>{entry.type === 'folder' ? '-' : formatBytes(entry.size)}</span>
                  </div>
                ))
              )}
            </div>
            <button className="file-more-v2" onClick={() => void showProjectInFolder()}>
              {copy('查看全部文件', 'View all files')}
              <ArrowLeft size={16} className="file-more-arrow-v2" />
            </button>
          </section>
        </div>

        <aside className="project-side-column-v2">
          <section className="panel recent-commits-v2">
            <div className="panel-title-row">
              <h2>{copy('最近提交', 'Recent Saves')}</h2>
              <Link to="/timeline">{copy('查看全部', 'View all')}</Link>
            </div>
            {recentRecords.length === 0 ? (
              <p className="muted">{copy('还没有提交。', 'No saved records yet.')}</p>
            ) : (
              <ul className="commit-list-v2">
                {recentRecords.map((record) => (
                  <li key={record.id}>
                    <span className="commit-icon-v2">
                      <SparklesMarker />
                    </span>
                    <div>
                      <strong>{record.message || copy('没有说明', 'No note')}</strong>
                      <small>{formatTime(record.timestamp, locale)}</small>
                    </div>
                    <button className="copy-hash-v2" onClick={() => void copyRecordId(record.id)}>
                      {shortHash(record.id)}
                      <Copy size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel quick-actions-v2">
            <h2>{copy('快速操作', 'Quick Actions')}</h2>
            <div className="quick-grid-v2">
              <Link to="/changes" className="quick-button-v2">
                <RefreshCw size={22} />
                {copy('提交变更', 'Save Changes')}
              </Link>
              <Link to="/plans" className="quick-button-v2">
                <GitBranch size={22} />
                {copy('切换分支', 'Switch Copy')}
              </Link>
              <button className="quick-button-v2" onClick={() => void getLatestFromCloud()}>
                <CloudDownload size={22} />
                {copy('拉取更新', 'Get Latest')}
              </button>
              <button className="quick-button-v2" onClick={() => void uploadCloud()}>
                <Upload size={22} />
                {copy('推送到远端', 'Upload')}
              </button>
              <button className="quick-button-v2" onClick={() => openIdeaCopyDialog()}>
                <Plus size={22} />
                {copy('新建分支', 'New Idea')}
              </button>
              <Link to="/settings" className="quick-button-v2">
                <MoreHorizontal size={22} />
                {copy('更多操作', 'More')}
              </Link>
            </div>
          </section>
        </aside>
      </section>

      <footer className="project-footer-v2">
        <span>{copy('本地仓库：', 'Local repo: ')}{project.path}\\.git</span>
        <span className="footer-status-v2 ok">{copy('已是最新', 'Up to date')}</span>
        <span className={`footer-status-v2 ${isClean ? 'ok' : 'attention'}`}>
          {isClean ? copy('工作区干净', 'Clean workspace') : copy(`${project.pendingChangeCount} 个文件待保存`, `${project.pendingChangeCount} files pending`)}
        </span>
      </footer>
    </div>
  );
}

function SparklesMarker() {
  return <Plus size={16} />;
}
