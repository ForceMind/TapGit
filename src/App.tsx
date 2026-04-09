import { useEffect, useMemo, useState } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppActionsContext } from './app/app-context';
import { resolveGettingStartedState } from './app/getting-started';
import { useProjectHistoryCount } from './app/use-project-history-count';
import {
  I18nProvider,
  resolveLocale,
  toCloudStatusText,
  toLocalizedErrorMessage,
  toPlanLabel,
  useI18n
} from './i18n';
import { ChangesPage } from './pages/ChangesPage';
import { HomePage } from './pages/HomePage';
import { PlansPage } from './pages/PlansPage';
import { SettingsPage } from './pages/SettingsPage';
import { TimelinePage } from './pages/TimelinePage';
import { getBridge, unwrapResult } from './services/bridge';
import { APP_EVENTS } from './shared/contracts';
import { useAppStore } from './stores/useAppStore';

function AppContent() {
  const { project, config, notice, setNotice, setProject, setConfig } = useAppStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [cloudQuickStatus, setCloudQuickStatus] = useState(t('app_cloud_quick_no_project'));
  const { historyCount, historyLoading } = useProjectHistoryCount(
    project?.path,
    project?.isProtected,
    `${project?.pendingChangeCount ?? 0}:${project?.currentPlan ?? ''}`
  );
  const gettingStarted = resolveGettingStartedState(project, historyCount);

  const navItems = useMemo(
    () => [
      { to: '/', label: t('app_nav_home') },
      { to: '/changes', label: t('app_nav_changes') },
      { to: '/timeline', label: t('app_nav_timeline') },
      { to: '/plans', label: t('app_nav_plans') },
      { to: '/settings', label: t('app_nav_settings') }
    ],
    [t]
  );

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
      if (detail === 'open-project') {
        void openProjectFolder();
      }
    }

    window.addEventListener(APP_EVENTS.MENU_COMMAND, handleMenuCommand as EventListener);
    return () => window.removeEventListener(APP_EVENTS.MENU_COMMAND, handleMenuCommand as EventListener);
  }, [openProjectFolder]);

  const actions = useMemo(
    () => ({
      openProjectFolder,
      openProjectByPath,
      enableProtection,
      refreshProject,
      refreshConfig
    }),
    [project?.path, t]
  );

  const gettingStartedBanner = useMemo(() => {
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
  }, [enableProtection, historyLoading, navigate, openProjectFolder, project, t, gettingStarted]);

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

  return (
    <AppActionsContext.Provider value={actions}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-title">{t('app_brand_title')}</div>
            <div className="brand-sub">{t('app_brand_sub')}</div>
          </div>
          <nav className="nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
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
              {project ? (
                <button className="btn btn-secondary" onClick={() => void openProjectFolder()}>
                  {t('app_switch_project')}
                </button>
              ) : null}
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
