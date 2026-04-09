import { useEffect, useState } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppActionsContext } from './app/app-context';
import { resolveGettingStartedState } from './app/getting-started';
import { resolveSidebarNavState } from './app/navigation-state';
import { useProjectHistoryCount } from './app/use-project-history-count';
import {
  I18nProvider,
  resolveLocale,
  toCloudStatusText,
  toLocalizedErrorMessage,
  toPlanLabel,
  useI18n
} from './i18n';
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [cloudQuickStatus, setCloudQuickStatus] = useState(t('app_cloud_quick_no_project'));
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneRemoteUrl, setCloneRemoteUrl] = useState('');
  const [cloneDestinationDirectory, setCloneDestinationDirectory] = useState('');
  const [cloneFolderName, setCloneFolderName] = useState('');
  const [cloneFolderNameTouched, setCloneFolderNameTouched] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [githubAuthStatus, setGitHubAuthStatus] = useState<GitHubAuthStatus | null>(null);
  const [githubAuthLoading, setGitHubAuthLoading] = useState(false);
  const { historyCount, historyLoading } = useProjectHistoryCount(
    project?.path,
    project?.isProtected,
    `${project?.pendingChangeCount ?? 0}:${project?.currentPlan ?? ''}`
  );
  const gettingStarted = resolveGettingStartedState(project, historyCount);

  const navItems = [
    { key: 'home' as const, to: '/', label: t('app_nav_home') },
    { key: 'changes' as const, to: '/changes', label: t('app_nav_changes') },
    { key: 'timeline' as const, to: '/timeline', label: t('app_nav_timeline') },
    { key: 'plans' as const, to: '/plans', label: t('app_nav_plans') },
    { key: 'settings' as const, to: '/settings', label: t('app_nav_settings') }
  ];

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

  async function refreshCloudQuickStatus() {
    if (!project?.path) {
      setCloudQuickStatus(t('app_cloud_quick_no_project'));
      return;
    }
    if (!project.isProtected) {
      setCloudQuickStatus(t('app_cloud_quick_need_protection'));
      return;
    }
    try {
      const status = await unwrapResult(getBridge().getCloudSyncStatus(project.path));
      setCloudQuickStatus(toCloudStatusText(status, t));
    } catch {
      setCloudQuickStatus(t('app_cloud_quick_unavailable'));
    }
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
    void refreshCloudQuickStatus();
  }, [project?.path, project?.isProtected, project?.currentPlan, project?.pendingChangeCount, t]);

  useEffect(() => {
    function handleMenuCommand(event: Event) {
      const detail = (event as CustomEvent<string>).detail;

      switch (detail) {
        case 'open-project':
          void openProjectFolder();
          return;
        case 'clone-project':
          void openCloneProjectDialog();
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
        case 'switch-to-stable':
          void switchToStableVersion();
          return;
        case 'export-logs':
          void handleExportLogs();
          return;
        default:
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

  function toSidebarToneLabel(tone: 'ready' | 'next' | 'locked') {
    switch (tone) {
      case 'next':
        return t('app_nav_status_next');
      case 'locked':
        return t('app_nav_status_locked');
      default:
        return t('app_nav_status_ready');
    }
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
          <span className="nav-link-copy">
            <span className="nav-link-title">{item.label}</span>
            <span className="nav-link-sub">{hint}</span>
          </span>
          {item.key !== 'home' && item.key !== 'settings' ? (
            <span className={`sidebar-pill ${state.tone}`}>{toSidebarToneLabel(state.tone)}</span>
          ) : null}
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
        <span className="nav-link-copy">
          <span className="nav-link-title">{item.label}</span>
          <span className="nav-link-sub">{hint}</span>
        </span>
        <span className={`sidebar-pill ${state.tone}`}>{toSidebarToneLabel(state.tone)}</span>
      </button>
    );
  }

  function handleCloneRemoteUrlChange(value: string) {
    setCloneRemoteUrl(value);
    if (!cloneFolderNameTouched || !cloneFolderName.trim()) {
      setCloneFolderName(toSuggestedFolderName(value));
    }
  }

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
              <div className="project-title">{project?.name ?? t('app_project_not_opened')}</div>
              <div className="project-meta">
                {project
                  ? t('app_project_meta', {
                      plan: toPlanLabel(
                        project.currentPlan,
                        project.currentPlan === 'main' || project.currentPlan === 'master',
                        t
                      ),
                      count: project.pendingChangeCount
                    })
                  : t('app_project_meta_empty')}
              </div>
              <div className="project-meta">{t('app_cloud_status_label', { status: cloudQuickStatus })}</div>
            </div>
            <div className="top-actions">
              <button className="btn btn-secondary" onClick={() => void openProjectFolder()}>
                {project ? t('app_switch_project') : t('app_open_project')}
              </button>
              <button className="btn btn-secondary" onClick={() => void openCloneProjectDialog()}>
                {t('app_get_from_github')}
              </button>
              {project && !project.isProtected ? (
                <button className="btn btn-primary" onClick={() => void enableProtection()}>
                  {t('app_enable_protection')}
                </button>
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
