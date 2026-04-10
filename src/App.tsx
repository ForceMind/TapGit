import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppActionsContext } from './app/app-context';
import { resolveGettingStartedState } from './app/getting-started';
import { resolveSidebarNavState } from './app/navigation-state';
import { resolvePrimaryTaskKey } from './app/primary-task';
import { useProjectHistoryCount } from './app/use-project-history-count';
import {
  I18nProvider,
  resolveLocale,
  toLocalizedErrorMessage,
  toPlanLabel,
  useI18n
} from './i18n';
import { IdeaCopyDialog } from './components/IdeaCopyDialog';
import { ProjectImportDialog } from './components/ProjectImportDialog';
import { ChangesPage } from './pages/ChangesPage';
import { HomePage } from './pages/HomePage';
import { PlansPage } from './pages/PlansPage';
import { SettingsPage } from './pages/SettingsPage';
import { TimelinePage } from './pages/TimelinePage';
import { getBridge, unwrapResult } from './services/bridge';
import { APP_EVENTS, GitHubAuthStatus } from './shared/contracts';
import { useAppStore } from './stores/useAppStore';

function toParentDirectory(projectPath: string) {
  return projectPath.replace(/[\\/][^\\/]+$/, '');
}

function toSuggestedFolderName(remoteUrl: string) {
  const trimmed = remoteUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.endsWith('.git') ? trimmed.slice(0, -4) : trimmed;
  const segments = normalized.split(/[/:]/).filter(Boolean);
  return (segments[segments.length - 1] ?? '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
}

function AppContent() {
  const { project, config, notice, setNotice, setProject, setConfig } = useAppStore();
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneRemoteUrl, setCloneRemoteUrl] = useState('');
  const [cloneDestinationDirectory, setCloneDestinationDirectory] = useState('');
  const [cloneFolderName, setCloneFolderName] = useState('');
  const [cloneFolderNameTouched, setCloneFolderNameTouched] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [githubAuthStatus, setGitHubAuthStatus] = useState<GitHubAuthStatus | null>(null);
  const [githubAuthLoading, setGitHubAuthLoading] = useState(false);
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [ideaCopyName, setIdeaCopyName] = useState('');
  const [ideaBusy, setIdeaBusy] = useState(false);
  const { historyCount, historyLoading } = useProjectHistoryCount(
    project?.path,
    project?.isProtected,
    `${project?.pendingChangeCount ?? 0}:${project?.currentPlan ?? ''}`
  );
  const gettingStarted = resolveGettingStartedState(project, historyCount);
  const primaryTaskKey = resolvePrimaryTaskKey(project, historyCount);
  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);

  const navItems = [
    { key: 'home' as const, to: '/', label: copy('项目', 'Project') },
    { key: 'changes' as const, to: '/changes', label: copy('修改', 'Changes') },
    { key: 'timeline' as const, to: '/timeline', label: copy('历史', 'History') },
    { key: 'plans' as const, to: '/plans', label: copy('试验区', 'Idea Lab') },
    { key: 'settings' as const, to: '/settings', label: t('app_nav_settings') }
  ];

  const sourcePlanLabel = useMemo(() => {
    if (!project?.currentPlan) {
      return t('common_main_plan');
    }
    return toPlanLabel(
      project.currentPlan,
      project.currentPlan === 'main' || project.currentPlan === 'master',
      t
    );
  }, [project?.currentPlan, t]);

  const projectMetaSummary = useMemo(() => {
    if (!project) {
      return t('app_project_meta_empty');
    }

    const historyText = historyLoading
      ? copy('\u6b63\u5728\u6574\u7406\u5386\u53f2', 'Loading history')
      : copy(`${historyCount ?? 0} \u4e2a\u4fdd\u5b58\u70b9`, `${historyCount ?? 0} saved points`);

    const changesText =
      project.pendingChangeCount > 0
        ? copy(
            `${project.pendingChangeCount} \u4e2a\u672a\u4fdd\u5b58\u6587\u4ef6`,
            `${project.pendingChangeCount} unsaved files`
          )
        : copy('\u6ca1\u6709\u672a\u4fdd\u5b58\u4fee\u6539', 'No unsaved changes');

    return [
      toPlanLabel(
        project.currentPlan,
        project.currentPlan === 'main' || project.currentPlan === 'master',
        t
      ),
      changesText,
      historyText
    ].join(' · ');
  }, [copy, historyCount, historyLoading, project, t]);

  async function refreshConfig() {
    const nextConfig = await unwrapResult(getBridge().getConfig());
    setConfig(nextConfig);
  }

  async function openProjectByPath(projectPath: string) {
    const summary = await unwrapResult(getBridge().openProject(projectPath));
    setProject(summary);
    await refreshConfig();
    navigate('/');
  }

  async function openProjectFolder() {
    try {
      const selectedPath = await unwrapResult(getBridge().chooseProjectFolder());
      if (!selectedPath) return;
      await openProjectByPath(selectedPath);
      setNotice({ type: 'success', text: t('app_notice_open_project_success', { path: selectedPath }) });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'app_notice_open_project_failed')
      });
    }
  }

  async function refreshGitHubAuthStatus() {
    setGitHubAuthLoading(true);
    try {
      const status = await unwrapResult(getBridge().getGitHubAuthStatus());
      setGitHubAuthStatus(status);
    } catch {
      setGitHubAuthStatus(null);
    } finally {
      setGitHubAuthLoading(false);
    }
  }

  async function openCloneProjectDialog() {
    setCloneRemoteUrl('');
    setCloneFolderName('');
    setCloneFolderNameTouched(false);
    setCloneDestinationDirectory(project?.path ? toParentDirectory(project.path) : '');
    setCloneDialogOpen(true);
    await refreshGitHubAuthStatus();
  }

  async function chooseCloneDestination() {
    try {
      const selectedPath = await unwrapResult(getBridge().chooseCloneDestination());
      if (!selectedPath) return;
      setCloneDestinationDirectory(selectedPath);
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'home_import_notice_destination_failed')
      });
    }
  }

  async function loginGitHubForImport() {
    try {
      const status = await unwrapResult(getBridge().loginGitHub());
      setGitHubAuthStatus(status);
      setNotice({ type: 'success', text: t('settings_notice_github_login_success') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_github_login_failed')
      });
    }
  }

  async function cloneProjectFromGitHub() {
    setCloneBusy(true);
    try {
      const summary = await unwrapResult(
        getBridge().cloneProjectFromGitHub({
          remoteUrl: cloneRemoteUrl,
          destinationDirectory: cloneDestinationDirectory,
          folderName: cloneFolderName
        })
      );
      setProject(summary);
      await refreshConfig();
      setCloneDialogOpen(false);
      navigate('/');
      setNotice({ type: 'success', text: t('home_import_notice_success', { name: summary.name }) });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'home_import_notice_failed')
      });
    } finally {
      setCloneBusy(false);
    }
  }

  async function enableProtection() {
    if (!project?.path) return;
    try {
      const summary = await unwrapResult(getBridge().enableProtection(project.path));
      setProject(summary);
      setNotice({ type: 'success', text: t('app_notice_enable_protection_success') });
      navigate('/changes');
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'app_notice_enable_protection_failed')
      });
    }
  }

  async function refreshProject() {
    if (!project?.path) return;
    const summary = await unwrapResult(getBridge().openProject(project.path));
    setProject(summary);
  }

  async function handleExportLogs() {
    try {
      const output = await unwrapResult(getBridge().exportLogs());
      if (output) {
        setNotice({ type: 'success', text: t('settings_notice_log_exported', { path: output }) });
      }
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_log_export_failed')
      });
    }
  }

  async function switchToStableVersion() {
    if (!project?.path || !project.isProtected) {
      setNotice({ type: 'info', text: t('app_menu_need_project_first') });
      navigate('/');
      return;
    }

    try {
      const plans = await unwrapResult(getBridge().listPlans(project.path));
      const stablePlan = plans.find((item) => item.isMain) ?? plans.find((item) => item.name === 'main' || item.name === 'master');
      if (!stablePlan) {
        setNotice({ type: 'info', text: t('app_menu_no_stable_version') });
        navigate('/plans');
        return;
      }

      await unwrapResult(getBridge().switchPlan(project.path, stablePlan.name));
      await refreshProject();
      navigate('/plans');
      setNotice({
        type: 'success',
        text: t('plans_notice_switched', {
          name: toPlanLabel(stablePlan.name, true, t)
        })
      });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'plans_notice_switch_failed')
      });
    }
  }

  async function handleShowProjectInFolder() {
    if (!project?.path) {
      setNotice({ type: 'info', text: t('app_menu_need_project_first') });
      navigate('/');
      return;
    }

    try {
      await unwrapResult(getBridge().openInFileManager(project.path));
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'app_notice_open_project_failed')
      });
    }
  }

  async function handleSaveAllProgress() {
    if (!project?.path) {
      setNotice({ type: 'info', text: t('app_menu_need_project_first') });
      navigate('/');
      return;
    }

    if (!project.isProtected) {
      setNotice({ type: 'info', text: t('app_menu_need_protection_first') });
      navigate('/changes');
      return;
    }

    try {
      const message =
        config?.settings.defaultSaveMessageTemplate.trim() ||
        t('changes_auto_message', {
          datetime: dayjs().format('YYYY-MM-DD HH:mm')
        });

      await unwrapResult(
        getBridge().saveProgress({
          projectPath: project.path,
          message
        })
      );
      await refreshProject();
      setNotice({ type: 'success', text: t('changes_notice_saved') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'changes_notice_save_failed')
      });
    }
  }

  function openIdeaCopyDialog() {
    if (!project?.path) {
      setNotice({ type: 'info', text: t('app_menu_need_project_first') });
      navigate('/');
      return;
    }

    if (!project.isProtected) {
      setNotice({ type: 'info', text: t('app_menu_need_protection_first') });
      navigate('/changes');
      return;
    }

    if ((historyCount ?? 0) === 0) {
      setNotice({ type: 'info', text: t('app_menu_need_first_save') });
      navigate('/changes');
      return;
    }

    if ((project.pendingChangeCount ?? 0) > 0) {
      setNotice({ type: 'info', text: t('app_menu_need_clean_changes') });
      navigate('/changes');
      return;
    }

    setIdeaCopyName('');
    setIdeaDialogOpen(true);
  }

  async function handleCreateIdeaCopy() {
    if (!project?.path || !ideaCopyName.trim()) return;

    setIdeaBusy(true);
    try {
      await unwrapResult(getBridge().createPlan(project.path, ideaCopyName.trim(), project.currentPlan));
      await refreshProject();
      setIdeaDialogOpen(false);
      navigate('/plans');
      setNotice({ type: 'success', text: t('plans_notice_created', { name: ideaCopyName.trim() }) });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'plans_notice_create_failed')
      });
    } finally {
      setIdeaBusy(false);
    }
  }

  async function handleUploadCloud() {
    if (!project?.path) {
      setNotice({ type: 'info', text: t('app_menu_need_project_first') });
      navigate('/');
      return;
    }

    if (!project.isProtected) {
      setNotice({ type: 'info', text: t('app_menu_need_protection_first') });
      navigate('/changes');
      return;
    }

    try {
      await unwrapResult(getBridge().uploadToCloud(project.path));
      setNotice({ type: 'success', text: t('settings_notice_upload_success') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_upload_failed')
      });
      navigate('/settings');
    }
  }

  async function handleGetLatestFromCloud() {
    if (!project?.path) {
      setNotice({ type: 'info', text: t('app_menu_need_project_first') });
      navigate('/');
      return;
    }

    if (!project.isProtected) {
      setNotice({ type: 'info', text: t('app_menu_need_protection_first') });
      navigate('/changes');
      return;
    }

    try {
      await unwrapResult(getBridge().getCloudLatest(project.path));
      await refreshProject();
      setNotice({ type: 'success', text: t('settings_notice_get_latest_success') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_get_latest_failed')
      });
      navigate('/settings');
    }
  }

  function openPageOrRedirect(
    target: '/' | '/changes' | '/timeline' | '/plans' | '/settings',
    needProject: boolean
  ) {
    if (needProject && !project) {
      setNotice({ type: 'info', text: t('app_menu_need_project_first') });
      navigate('/');
      return;
    }
    navigate(target);
  }

  useEffect(() => {
    void refreshConfig().catch((error) => {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'app_notice_read_config_failed')
      });
    });
  }, [setNotice, t]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  useEffect(() => {
    function handleMenuCommand(event: Event) {
      const detail = (event as CustomEvent<string>).detail;

      switch (detail) {
        case 'save-all':
          void handleSaveAllProgress();
          return;
        case 'open-project':
          void openProjectFolder();
          return;
        case 'clone-project':
          void openCloneProjectDialog();
          return;
        case 'show-project-in-folder':
          void handleShowProjectInFolder();
          return;
        case 'show-home':
          navigate('/');
          return;
        case 'show-changes':
          openPageOrRedirect('/changes', true);
          return;
        case 'show-timeline':
          openPageOrRedirect('/timeline', true);
          return;
        case 'show-plans':
          openPageOrRedirect('/plans', true);
          return;
        case 'show-settings':
        case 'show-cloud':
          navigate('/settings');
          return;
        case 'create-idea-copy':
          openIdeaCopyDialog();
          return;
        case 'switch-to-stable':
          void switchToStableVersion();
          return;
        case 'upload-cloud':
          void handleUploadCloud();
          return;
        case 'download-cloud':
          void handleGetLatestFromCloud();
          return;
        case 'export-logs':
          void handleExportLogs();
          return;
        default:
          if (detail.startsWith('open-recent:')) {
            const projectPath = detail.slice('open-recent:'.length);
            void openProjectByPath(projectPath);
          }
          return;
      }
    }

    window.addEventListener(APP_EVENTS.MENU_COMMAND, handleMenuCommand as EventListener);
    return () => window.removeEventListener(APP_EVENTS.MENU_COMMAND, handleMenuCommand as EventListener);
  }, [navigate, project, setNotice, t]);

  const actions = {
    openProjectFolder,
    openCloneProjectDialog,
    openProjectByPath,
    enableProtection,
    refreshProject,
    refreshConfig
  };

  const gettingStartedBanner = (() => {
    if (!gettingStarted.isActive) {
      return null;
    }

    switch (gettingStarted.key) {
      case 'open':
        return {
          title: t('app_getting_started_open_title'),
          detail: t('app_getting_started_open_desc'),
          actionLabel: t('app_getting_started_open_action'),
          actionType: 'button' as const,
          actionTo: '/',
          onAction: openProjectFolder
        };
      case 'protect':
        return {
          title: t('app_getting_started_protect_title'),
          detail: t('app_getting_started_protect_desc', { name: project?.name ?? '' }),
          actionLabel: t('app_getting_started_protect_action'),
          actionType: 'button' as const,
          actionTo: '/changes',
          onAction: enableProtection
        };
      case 'save':
        return {
          title: t('app_getting_started_save_title'),
          detail: historyLoading
            ? t('app_getting_started_save_loading')
            : (project?.pendingChangeCount ?? 0) > 0
              ? t('app_getting_started_save_desc_pending', {
                  count: project?.pendingChangeCount ?? 0
                })
              : t('app_getting_started_save_desc_empty'),
          actionLabel: t('app_getting_started_save_action'),
          actionType: 'link' as const,
          actionTo: '/changes'
        };
      default:
        return null;
    }
  })();

  function renderGettingStartedAction() {
    if (!gettingStartedBanner) {
      return null;
    }

    const alreadyHere = gettingStartedBanner.actionTo === location.pathname;
    if (alreadyHere) {
      return <span className="getting-started-here">{t('app_getting_started_here')}</span>;
    }

    if (gettingStartedBanner.actionType === 'button') {
      return (
        <button className="btn btn-primary" onClick={() => void gettingStartedBanner.onAction?.()}>
          {gettingStartedBanner.actionLabel}
        </button>
      );
    }

    return (
      <Link className="btn btn-primary" to={gettingStartedBanner.actionTo ?? '/'}>
        {gettingStartedBanner.actionLabel}
      </Link>
    );
  }

  function renderNavItem(item: (typeof navItems)[number]) {
    const state = resolveSidebarNavState(item.key, project, historyCount, historyLoading);
    const hint = t(state.hintKey as never);

    if (state.enabled) {
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="nav-link-title">{item.label}</span>
        </NavLink>
      );
    }

    return (
      <button
        key={item.to}
        type="button"
        className="nav-link nav-link-locked"
        aria-disabled="true"
        onClick={() => {
          setNotice({ type: 'info', text: hint });
          if (state.fallbackTo !== location.pathname) {
            navigate(state.fallbackTo);
          }
        }}
      >
        <span className="nav-link-title">{item.label}</span>
      </button>
    );
  }

  function handleCloneRemoteUrlChange(value: string) {
    setCloneRemoteUrl(value);
    if (!cloneFolderNameTouched || !cloneFolderName.trim()) {
      setCloneFolderName(toSuggestedFolderName(value));
    }
  }

  const topbarPrimaryAction = useMemo(() => {
    if (!project) {
      return null;
    }

    switch (primaryTaskKey) {
      case 'protect':
        return {
          label: t('app_enable_protection'),
          onClick: () => void enableProtection()
        };
      case 'save':
        return {
          label: t('home_next_open_changes'),
          onClick: () => navigate('/changes')
        };
      case 'timeline':
        return {
          label: t('home_next_open_timeline'),
          onClick: () => navigate('/timeline')
        };
      default:
        return null;
    }
  }, [enableProtection, navigate, primaryTaskKey, project, t]);

  return (
    <AppActionsContext.Provider value={actions}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-title">{t('app_brand_title')}</div>
            <div className="brand-sub">{t('app_brand_sub')}</div>
          </div>
          <nav className="nav">
            {navItems.map((item) => renderNavItem(item))}
          </nav>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="project-info">
              <div className="project-title-row">
                <div className="project-title">{project?.name ?? t('app_project_not_opened')}</div>
                {project ? (
                  <div className="project-links">
                    <button className="link-quiet" onClick={() => void handleShowProjectInFolder()}>
                      {t('app_show_in_folder')}
                    </button>
                    <button className="link-quiet" onClick={() => void openProjectFolder()}>
                      {t('app_switch_project')}
                    </button>
                  </div>
                ) : null}
              </div>
              {project ? <div className="project-meta">{projectMetaSummary}</div> : null}
              {project ? (
                <div className="project-pills">
                  <span className="project-pill">
                    {toPlanLabel(
                      project.currentPlan,
                      project.currentPlan === 'main' || project.currentPlan === 'master',
                      t
                    )}
                  </span>
                  {project.pendingChangeCount > 0 ? (
                    <span className="project-pill attention">
                      {copy(`${project.pendingChangeCount} 个未保存`, `${project.pendingChangeCount} unsaved`)}
                    </span>
                  ) : null}
                  <span className="project-pill">
                    {historyLoading
                      ? t('home_history_loading_short')
                      : t('common_record_unit', { count: historyCount ?? 0 })}
                  </span>
                </div>
              ) : (
                <div className="project-meta">{t('app_project_meta_empty')}</div>
              )}
            </div>
            <div className="top-actions">
              {project ? (
                topbarPrimaryAction ? (
                  <button className="btn btn-primary" onClick={topbarPrimaryAction.onClick}>
                    {topbarPrimaryAction.label}
                  </button>
                ) : null
              ) : location.pathname !== '/' ? (
                <>
                  <button className="btn btn-primary" onClick={() => void openProjectFolder()}>
                    {t('app_open_project')}
                  </button>
                  <button className="btn btn-secondary" onClick={() => void openCloneProjectDialog()}>
                    {t('app_get_from_github')}
                  </button>
                </>
              ) : null}
            </div>
          </header>

          {project && !project.isProtected ? (
            <div className="warning-banner">{t('app_protection_warning')}</div>
          ) : null}

          {gettingStartedBanner && location.pathname !== '/' ? (
            <div className="getting-started-strip">
              <div className="getting-started-copy">
                <div className="getting-started-step">
                  {t('app_getting_started_step', {
                    current: gettingStarted.stepNumber,
                    total: gettingStarted.totalSteps
                  })}
                </div>
                <strong>{gettingStartedBanner.title}</strong>
                <span>{gettingStartedBanner.detail}</span>
              </div>
              <div className="getting-started-actions">{renderGettingStartedAction()}</div>
            </div>
          ) : null}

          {notice ? <div className={`toast ${notice.type}`}>{notice.text}</div> : null}

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/changes" element={<ChangesPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>

          <footer className="statusbar">
            <span>
              {t('app_beginner_mode', {
                status: config?.settings.showAdvancedMode
                  ? t('app_beginner_mode_off')
                  : t('app_beginner_mode_on')
              })}
            </span>
            <span>
              {t('app_restore_guard', {
                status: config?.settings.autoSnapshotBeforeRestore
                  ? t('app_enabled')
                  : t('app_disabled')
              })}
            </span>
          </footer>
        </main>
      </div>

      {cloneDialogOpen ? (
        <ProjectImportDialog
          remoteUrl={cloneRemoteUrl}
          folderName={cloneFolderName}
          destinationDirectory={cloneDestinationDirectory}
          authStatus={githubAuthStatus}
          authLoading={githubAuthLoading}
          busy={cloneBusy}
          onRemoteUrlChange={handleCloneRemoteUrlChange}
          onFolderNameChange={(value) => {
            setCloneFolderNameTouched(true);
            setCloneFolderName(value);
          }}
          onPickDestination={() => void chooseCloneDestination()}
          onLoginGitHub={() => void loginGitHubForImport()}
          onCancel={() => {
            if (!cloneBusy) {
              setCloneDialogOpen(false);
            }
          }}
          onConfirm={() => void cloneProjectFromGitHub()}
        />
      ) : null}

      {ideaDialogOpen ? (
        <IdeaCopyDialog
          value={ideaCopyName}
          sourceLabel={sourcePlanLabel}
          busy={ideaBusy}
          onChange={setIdeaCopyName}
          onCancel={() => {
            if (!ideaBusy) {
              setIdeaDialogOpen(false);
            }
          }}
          onConfirm={() => void handleCreateIdeaCopy()}
        />
      ) : null}
    </AppActionsContext.Provider>
  );
}

export function App() {
  const language = useAppStore((state) => state.config?.settings.language);
  const locale = resolveLocale(language);

  return (
    <HashRouter>
      <I18nProvider locale={locale}>
        <AppContent />
      </I18nProvider>
    </HashRouter>
  );
}
