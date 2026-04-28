import dayjs from 'dayjs';
import {
  Clock3,
  CloudDownload,
  CloudUpload,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  RefreshCw,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { resolvePrimaryTaskKey } from '../app/primary-task';
import { useProjectHistoryCount } from '../app/use-project-history-count';
import { toPlanLabel, useI18n } from '../i18n';
import { getBridge, unwrapResult } from '../services/bridge';
import { ProjectOverview } from '../shared/contracts';
import { useAppStore } from '../stores/useAppStore';

function formatTime(timestamp: number | null | undefined, locale: 'en-US' | 'zh-CN') {
  if (!timestamp) {
    return locale === 'zh-CN' ? '还没有保存' : 'Not saved yet';
  }

  const target = dayjs(timestamp * 1000);
  const minutes = dayjs().diff(target, 'minute');
  const hours = dayjs().diff(target, 'hour');
  const days = dayjs().diff(target, 'day');

  if (minutes < 1) return locale === 'zh-CN' ? '刚刚' : 'Just now';
  if (minutes < 60) return locale === 'zh-CN' ? `${minutes} 分钟前` : `${minutes}m ago`;
  if (hours < 24) return locale === 'zh-CN' ? `${hours} 小时前` : `${hours}h ago`;
  if (days < 7) return locale === 'zh-CN' ? `${days} 天前` : `${days}d ago`;
  return target.format('YYYY-MM-DD');
}

function recentProjectName(projectPath: string) {
  return projectPath.split(/[\\/]/).pop() || projectPath;
}

export function HomePage() {
  const { project, config } = useAppStore();
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
  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);
  const recentProjects = config?.recentProjects ?? [];
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const { historyCount } = useProjectHistoryCount(
    project?.path,
    project?.isProtected,
    `${project?.pendingChangeCount ?? 0}:${project?.currentPlan ?? ''}`
  );
  const primaryTaskKey = resolvePrimaryTaskKey(project, historyCount);

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

  const nextStep = useMemo(() => {
    switch (primaryTaskKey) {
      case 'open':
        return {
          title: copy('先获取或创建一个项目', 'Get or create a project first'),
          body: copy('从 GitHub 获取项目，或打开这台电脑上的项目文件夹。', 'Get a project from GitHub or open a local folder.'),
          action: copy('从 GitHub 获取', 'Get from GitHub'),
          secondaryAction: copy('打开本地项目', 'Open Local Project')
        };
      case 'protect':
        return {
          title: copy('先开启保护', 'Turn on protection first'),
          body: copy('开启后，码迹才能帮你保存节点、恢复旧版本、试新想法。', 'This lets TapGit save points, restore older versions, and try ideas safely.'),
          action: t('app_enable_protection')
        };
      case 'save':
        return {
          title: copy('有修改，先保存成节点', 'Changes found. Save a point next'),
          body: copy('先看清楚改了哪些文件，再把当前可用状态保存下来。', 'Review what changed, then keep the current working state.'),
          action: copy('查看修改', 'Review Changes')
        };
      default:
        return {
          title: copy('项目状态清楚，可以继续工作', 'Project is clear. Keep working'),
          body: copy('所有关键操作都围绕下面的保存时间线进行。', 'Every key action starts from the save timeline below.'),
          action: copy('查看时间线', 'Open Timeline')
        };
    }
  }, [copy, primaryTaskKey, t]);

  if (!project) {
    return (
      <div className="page home-start-simple">
        <section className="simple-start-card">
          <span className="simple-eyebrow">{copy('第一步', 'Step One')}</span>
          <h1>{nextStep.title}</h1>
          <p>{nextStep.body}</p>
          <div className="simple-start-actions">
            <button className="simple-action-card primary" onClick={() => void openCloneProjectDialog()}>
              <CloudDownload size={30} />
              <strong>{copy('从 GitHub 获取项目', 'Get from GitHub')}</strong>
              <span>{copy('适合已有云端仓库，粘贴地址后下载到本机。', 'Use this when the project already exists online.')}</span>
            </button>
            <button className="simple-action-card" onClick={() => void openProjectFolder()}>
              <FolderOpen size={30} />
              <strong>{copy('打开或创建本地项目', 'Open or Create Local Project')}</strong>
              <span>{copy('适合电脑上已有文件夹，或想从空文件夹开始。', 'Use this for an existing folder or an empty new folder.')}</span>
            </button>
          </div>
        </section>

        <section className="simple-recent-card">
          <h2>{copy('最近项目', 'Recent Projects')}</h2>
          {recentProjects.length === 0 ? (
            <p>{copy('还没有最近项目。先从上面选一个入口开始。', 'No recent projects yet. Start with one option above.')}</p>
          ) : (
            <div className="simple-recent-list">
              {recentProjects.map((item) => (
                <button key={item} onClick={() => void openProjectByPath(item)}>
                  <Folder size={20} />
                  <span>
                    <strong>{recentProjectName(item)}</strong>
                    <small>{item}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const isStable = project.currentPlan === 'main' || project.currentPlan === 'master';
  const planLabel = toPlanLabel(project.currentPlan, isStable, t);
  const latestRecords = overview?.recentRecords.slice(0, 5) ?? [];
  const savedPointCount = overview?.savedRecordCount ?? historyCount ?? 0;
  const hasChanges = project.pendingChangeCount > 0;
  const hasSavedPoint = savedPointCount > 0;

  return (
    <div className="page project-simple-page">
      <header className="simple-project-head">
        <div>
          <span className="simple-eyebrow">{copy('当前项目', 'Current Project')}</span>
          <h1>{project.name}</h1>
          <p>{project.path}</p>
        </div>
        <div className="simple-head-actions">
          <button className="btn btn-secondary" onClick={() => void showProjectInFolder()}>
            <FolderOpen size={18} />
            {copy('打开文件夹', 'Open Folder')}
          </button>
          <button className="icon-button-v2" onClick={() => void refreshProject()} aria-label={copy('刷新', 'Refresh')}>
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      <section className={`simple-status-card ${hasChanges ? 'attention' : 'ready'}`}>
        <div className="simple-status-icon">
          {hasChanges ? <FileText size={32} /> : <ShieldCheck size={34} />}
        </div>
        <div>
          <span>{copy('下一步', 'Next Step')}</span>
          <h2>{nextStep.title}</h2>
          <p>{nextStep.body}</p>
        </div>
        <div className="simple-status-actions">
          {!project.isProtected ? (
            <button className="btn btn-primary project-header-primary" onClick={() => void enableProtection()}>
              {nextStep.action}
            </button>
          ) : hasChanges || !hasSavedPoint ? (
            <Link className="btn btn-primary project-header-primary" to="/changes">
              {nextStep.action}
            </Link>
          ) : (
            <Link className="btn btn-primary project-header-primary" to="/timeline">
              {nextStep.action}
            </Link>
          )}
        </div>
      </section>

      <section className="simple-flow-card">
        <div className="simple-flow-head">
          <div>
            <h2>{copy('保存时间线', 'Save Timeline')}</h2>
            <p>{copy('不要想 Git 命令。只按节点操作：改了什么、保存到哪里、要不要回到过去。', 'Ignore Git commands. Work with points: what changed, where to save, and whether to return to an older point.')}</p>
          </div>
          <strong>{planLabel}</strong>
        </div>

        <div className="simple-node-rail">
          <Link className={`simple-node ${hasChanges ? 'active' : ''}`} to="/changes">
            <FileText size={22} />
            <strong>{copy('当前修改', 'Changes')}</strong>
            <span>{hasChanges ? copy(`${project.pendingChangeCount} 个文件`, `${project.pendingChangeCount} files`) : copy('没有待保存修改', 'No pending changes')}</span>
          </Link>
          <Link className={`simple-node ${hasSavedPoint ? 'done' : ''}`} to="/timeline">
            <Clock3 size={22} />
            <strong>{copy('保存节点', 'Save Points')}</strong>
            <span>{hasSavedPoint ? copy(`${overview?.savedRecordCount ?? historyCount} 个节点`, `${overview?.savedRecordCount ?? historyCount} points`) : copy('先保存一次', 'Save once first')}</span>
          </Link>
          <Link className="simple-node" to="/settings?tab=sync">
            <CloudUpload size={22} />
            <strong>{copy('云端同步', 'Cloud Sync')}</strong>
            <span>{copy('上传或获取最新', 'Upload or get latest')}</span>
          </Link>
          <button className="simple-node" onClick={() => openIdeaCopyDialog()}>
            <GitBranch size={22} />
            <strong>{copy('试新想法', 'Try Ideas')}</strong>
            <span>{copy('开一条安全路线', 'Create a safe path')}</span>
          </button>
          <Link className="simple-node" to="/timeline">
            <RotateCcw size={22} />
            <strong>{copy('回到旧节点', 'Restore')}</strong>
            <span>{copy('从时间线选择', 'Pick from timeline')}</span>
          </Link>
        </div>
      </section>

      <section className="simple-bottom-grid">
        <article className="simple-panel">
          <h2>{copy('最近保存节点', 'Recent Save Points')}</h2>
          {overviewLoading ? (
            <p>{copy('正在读取...', 'Loading...')}</p>
          ) : latestRecords.length === 0 ? (
            <p>{copy('还没有保存节点。先去“当前修改”保存一次。', 'No save points yet. Go to Changes and save once.')}</p>
          ) : (
            <div className="simple-save-list">
              {latestRecords.map((record, index) => (
                <Link key={record.id} to="/timeline">
                  <span>{Math.max(1, savedPointCount - index)}</span>
                  <strong>{record.message || copy('没有说明', 'No note')}</strong>
                  <small>{formatTime(record.timestamp, locale)}</small>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="simple-panel">
          <h2>{copy('常用动作', 'Common Actions')}</h2>
          <div className="simple-command-grid">
            <Link to="/changes">{copy('查看并保存修改', 'Review and Save')}</Link>
            <Link to="/timeline">{copy('回到某个保存点', 'Restore a Point')}</Link>
            <button onClick={() => void uploadCloud()}>{copy('上传到云端', 'Upload')}</button>
            <button onClick={() => void getLatestFromCloud()}>{copy('获取云端最新', 'Get Latest')}</button>
          </div>
        </article>
      </section>
    </div>
  );
}
