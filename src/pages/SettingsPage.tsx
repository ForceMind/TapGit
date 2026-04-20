import { useEffect, useMemo, useState } from 'react';
import {
  toCloudAdvice,
  toCloudStatusText,
  toCloudTestMessage,
  toLocalizedErrorMessage,
  toPlanLabel,
  useI18n
} from '../i18n';
import { useAppActions } from '../app/app-context';
import { BridgeError, getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';
import {
  AppLanguagePreference,
  CloudConnectionTestResult,
  CloudSyncStatus,
  GitEnvironment,
  GitHubAuthStatus
} from '../shared/contracts';
import { parseRemoteUrl } from '../shared/remote-url';

type CloudPlatform = 'github' | 'gitlab' | 'custom';

interface CloudProviderLinks {
  signInUrl?: string;
  createRepoUrl?: string;
  repoPageUrl?: string;
}

export function SettingsPage() {
  const { project, config, setConfig, setNotice } = useAppStore();
  const { locale, t } = useI18n();
  const { openProjectFolder, enableProtection } = useAppActions();
  const [gitEnv, setGitEnv] = useState<GitEnvironment | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus | null>(null);
  const [remoteUrlInput, setRemoteUrlInput] = useState('');
  const [cloudPlatform, setCloudPlatform] = useState<CloudPlatform>('github');
  const [cloudOwner, setCloudOwner] = useState('');
  const [cloudRepo, setCloudRepo] = useState('');
  const [connectionTest, setConnectionTest] = useState<CloudConnectionTestResult | null>(null);
  const [cloudAdvice, setCloudAdvice] = useState('');
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [authWorking, setAuthWorking] = useState(false);
  const [githubAuthStatus, setGitHubAuthStatus] = useState<GitHubAuthStatus | null>(null);
  const [selectedGitHubAccount, setSelectedGitHubAccount] = useState('');

  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);
  const projectReadyForCloud = Boolean(project?.isProtected);

  const providerLinks: CloudProviderLinks = (() => {
    const repoName = cloudRepo.trim().replace(/\.git$/i, '');

    if (cloudPlatform === 'github') {
      return {
        signInUrl: 'https://github.com/login',
        createRepoUrl: repoName
          ? `https://github.com/new?name=${encodeURIComponent(repoName)}`
          : 'https://github.com/new',
        repoPageUrl:
          cloudOwner.trim() && repoName
            ? `https://github.com/${cloudOwner.trim()}/${repoName}`
            : undefined
      };
    }

    if (cloudPlatform === 'gitlab') {
      return {
        signInUrl: 'https://gitlab.com/users/sign_in',
        createRepoUrl: repoName
          ? `https://gitlab.com/projects/new?name=${encodeURIComponent(repoName)}`
          : 'https://gitlab.com/projects/new',
        repoPageUrl:
          cloudOwner.trim() && repoName
            ? `https://gitlab.com/${cloudOwner.trim()}/${repoName}`
            : undefined
      };
    }

    return {};
  })();

  const heroTitle = project
    ? copy(`${project.name} \u7684\u540c\u6b65`, `${project.name} Sync`)
    : copy('\u4e91\u7aef\u4e0e\u5e94\u7528', 'Cloud & App');

  const heroDescription = !project
    ? copy(
        '\u5148\u6253\u5f00\u4e00\u4e2a\u9879\u76ee\u3002',
        'Open a project first.'
      )
    : !project.isProtected
      ? copy(
          '\u5148\u5f00\u542f\u7248\u672c\u4fdd\u62a4\u3002',
          'Turn on protection first.'
        )
      : copy(
          '\u5148\u8fde\u63a5\uff0c\u6216\u8005\u73b0\u5728\u540c\u6b65\u3002',
          'Connect this project or sync now.'
        );

  const connectionStateLabel = !project
    ? copy('\u5148\u6253\u5f00\u9879\u76ee', 'Open a project first')
    : !project.isProtected
      ? copy('\u5148\u5f00\u542f\u7248\u672c\u4fdd\u62a4', 'Turn on protection first')
      : !cloudStatus
        ? copy('\u6b63\u5728\u68c0\u67e5', 'Checking')
        : cloudStatus.connected
          ? copy('\u5df2\u8fde\u63a5', 'Connected')
          : copy('\u8fd8\u6ca1\u8fde\u4e0a', 'Not connected yet');

  const syncStateLabel = !projectReadyForCloud
    ? copy('\u6682\u672a\u5c31\u7eea', 'Not ready yet')
    : !cloudStatus?.connected
      ? copy('\u9700\u8981\u5148\u8fde\u63a5', 'Connect first')
      : cloudStatus.pendingUpload > 0
        ? copy('\u6709\u65b0\u8fdb\u5ea6\u53ef\u4e0a\u4f20', 'Ready to upload')
        : cloudStatus.pendingDownload > 0
          ? copy('\u4e91\u7aef\u6709\u66f4\u65b0', 'Updates are waiting')
          : copy('\u5df2\u7ecf\u540c\u6b65', 'Already in sync');

  const syncSummary = !projectReadyForCloud
    ? copy('\u5148\u628a\u9879\u76ee\u51c6\u5907\u597d\uff0c\u4e91\u7aef\u529f\u80fd\u624d\u4f1a\u6253\u5f00\u3002', 'Prepare the project first to unlock cloud sync.')
    : !cloudStatus?.connected
      ? copy('\u8fde\u4e0a\u4e91\u7aef\u540e\uff0c\u5c31\u80fd\u628a\u672c\u5730\u8fdb\u5ea6\u4f20\u4e0a\u53bb\uff0c\u6216\u62ff\u5230\u4e91\u7aef\u7684\u6700\u65b0\u7248\u672c\u3002', 'Once connected, you can upload local progress or get the latest version from the cloud.')
      : toCloudStatusText(cloudStatus, t);

  const activeGitHubAccount =
    selectedGitHubAccount || githubAuthStatus?.activeAccount || githubAuthStatus?.accounts[0] || null;

  const providerLabel = useMemo(() => {
    if (cloudPlatform === 'github') return 'GitHub';
    if (cloudPlatform === 'gitlab') return 'GitLab';
    return copy('\u5176\u4ed6\u4ed3\u5e93', 'Other Remote');
  }, [cloudPlatform, locale]);

  async function loadGitEnvironment() {
    setChecking(true);
    try {
      const result = await unwrapResult(getBridge().checkGitEnvironment());
      setGitEnv(result);
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_env_failed')
      });
    } finally {
      setChecking(false);
    }
  }

  async function loadCloudStatus() {
    if (!project?.path || !project.isProtected) {
      setCloudStatus(null);
      return;
    }

    try {
      const status = await unwrapResult(getBridge().getCloudSyncStatus(project.path));
      setCloudStatus(status);
      if (status.remoteUrl) {
        setRemoteUrlInput(status.remoteUrl);
        const parsed = parseRemoteUrl(status.remoteUrl);
        if (parsed.provider === 'github') {
          setCloudPlatform('github');
          setCloudOwner(parsed.owner ?? '');
          setCloudRepo(parsed.repo ?? '');
          setSelectedGitHubAccount(status.preferredAccount ?? '');
        } else if (parsed.provider === 'gitlab') {
          setCloudPlatform('gitlab');
          setCloudOwner(parsed.owner ?? '');
          setCloudRepo(parsed.repo ?? '');
        }
      }
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_cloud_status_failed')
      });
    }
  }

  async function loadGitHubAuthStatus() {
    if (cloudPlatform !== 'github') {
      setGitHubAuthStatus(null);
      return;
    }

    try {
      const status = await unwrapResult(getBridge().getGitHubAuthStatus());
      setGitHubAuthStatus(status);
      setSelectedGitHubAccount((current) => current || status.activeAccount || status.accounts[0] || '');
    } catch {
      setGitHubAuthStatus({
        available: false,
        accounts: [],
        activeAccount: null
      });
    }
  }

  useEffect(() => {
    void loadGitEnvironment();
  }, []);

  useEffect(() => {
    void loadCloudStatus();
  }, [project?.path, project?.isProtected]);

  useEffect(() => {
    void loadGitHubAuthStatus();
  }, [cloudPlatform]);

  function buildCloudUrl(platform: CloudPlatform, owner: string, repo: string) {
    const o = owner.trim();
    const r = repo.trim().replace(/\.git$/i, '');
    if (!o || !r) {
      return '';
    }

    if (platform === 'github') {
      return `https://github.com/${o}/${r}.git`;
    }

    if (platform === 'gitlab') {
      return `https://gitlab.com/${o}/${r}.git`;
    }

    return '';
  }

  async function openExternalUrl(url?: string) {
    if (!url) {
      return;
    }

    try {
      await unwrapResult(getBridge().openExternalUrl(url));
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_cloud_connect_failed')
      });
    }
  }

  function applyWizardUrl() {
    const generated = buildCloudUrl(cloudPlatform, cloudOwner, cloudRepo);
    if (!generated && cloudPlatform !== 'custom') {
      setNotice({ type: 'info', text: t('settings_notice_need_owner_repo') });
      return;
    }

    if (generated) {
      setRemoteUrlInput(generated);
      setNotice({ type: 'success', text: t('settings_notice_url_filled') });
    }
  }

  async function patchSettings(
    patch: Partial<{
      showAdvancedMode: boolean;
      showBeginnerGuide: boolean;
      autoSnapshotBeforeRestore: boolean;
      autoSnapshotBeforeMerge: boolean;
      defaultSaveMessageTemplate: string;
      language: AppLanguagePreference;
    }>
  ) {
    try {
      const settings = await unwrapResult(getBridge().updateSettings(patch));
      const latestConfig = config ? { ...config, settings } : await unwrapResult(getBridge().getConfig());
      setConfig(latestConfig);
      setNotice({ type: 'success', text: t('settings_notice_saved') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_save_failed')
      });
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

  async function handleConnectCloud() {
    if (!project?.path) {
      return;
    }

    setSyncing(true);
    try {
      const status = await unwrapResult(
        getBridge().connectCloud(
          project.path,
          remoteUrlInput.trim(),
          cloudPlatform === 'github' ? selectedGitHubAccount || undefined : undefined
        )
      );
      setCloudStatus(status);
      setRemoteUrlInput(status.remoteUrl);
      setSelectedGitHubAccount(status.preferredAccount ?? selectedGitHubAccount);
      setConnectionTest(null);
      setCloudAdvice('');
      setNotice({ type: 'success', text: t('settings_notice_cloud_connected') });
    } catch (error) {
      setCloudAdvice(toCloudAdvice(error, t));
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_cloud_connect_failed')
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleUploadToCloud() {
    if (!project?.path) {
      return;
    }

    setSyncing(true);
    try {
      const status = await unwrapResult(getBridge().uploadToCloud(project.path));
      setCloudStatus(status);
      setCloudAdvice('');
      setNotice({ type: 'success', text: t('settings_notice_upload_success') });
    } catch (error) {
      setCloudAdvice(toCloudAdvice(error, t));
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_upload_failed')
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleGetCloudLatest() {
    if (!project?.path) {
      return;
    }

    setSyncing(true);
    try {
      const status = await unwrapResult(getBridge().getCloudLatest(project.path));
      setCloudStatus(status);
      setCloudAdvice('');
      setNotice({ type: 'success', text: t('settings_notice_get_latest_success') });
    } catch (error) {
      setCloudAdvice(toCloudAdvice(error, t));
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_get_latest_failed')
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleTestCloudConnection() {
    if (!project?.path) {
      return;
    }

    setSyncing(true);
    try {
      const result = await unwrapResult(
        getBridge().testCloudConnection(
          project.path,
          remoteUrlInput.trim(),
          cloudPlatform === 'github' ? selectedGitHubAccount || undefined : undefined
        )
      );
      setConnectionTest(result);
      setCloudAdvice(result.reachable ? '' : toCloudTestMessage(result, t));
      setNotice({
        type: result.reachable ? 'success' : 'info',
        text: toCloudTestMessage(result, t)
      });
    } catch (error) {
      if (error instanceof BridgeError) {
        setCloudAdvice(toCloudAdvice(error, t));
      }
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_test_failed')
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleGitHubLogin() {
    setAuthWorking(true);
    try {
      const status = await unwrapResult(getBridge().loginGitHub(selectedGitHubAccount || undefined));
      setGitHubAuthStatus(status);
      setSelectedGitHubAccount((current) => current || status.activeAccount || status.accounts[0] || '');
      setNotice({ type: 'success', text: t('settings_notice_github_login_success') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_github_login_failed')
      });
    } finally {
      setAuthWorking(false);
    }
  }

  async function handleGitHubLogout(account: string) {
    setAuthWorking(true);
    try {
      const status = await unwrapResult(getBridge().logoutGitHub(account));
      setGitHubAuthStatus(status);
      setSelectedGitHubAccount(status.activeAccount ?? status.accounts[0] ?? '');
      setNotice({ type: 'success', text: t('settings_notice_github_logout_success') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_github_logout_failed')
      });
    } finally {
      setAuthWorking(false);
    }
  }

  return (
    <div className="page">
      <section className="panel settings-hero">
        <div className="settings-hero-copy">
          <span className="pill">{copy('\u9879\u76ee\u4e91\u7aef', 'Project Cloud')}</span>
          <h1>{heroTitle}</h1>
          <p>{heroDescription}</p>
        </div>
        <div className="settings-hero-metrics">
          <article className="settings-metric-card">
            <span>{copy('\u8fde\u63a5\u72b6\u6001', 'Connection')}</span>
            <strong>{connectionStateLabel}</strong>
          </article>
          <article className="settings-metric-card">
            <span>{copy('\u7b49\u5f85\u4e0a\u4f20', 'Waiting to upload')}</span>
            <strong>{cloudStatus?.connected ? cloudStatus.pendingUpload : '-'}</strong>
          </article>
          <article className="settings-metric-card">
            <span>{copy('\u7b49\u5f85\u83b7\u53d6', 'Waiting to get')}</span>
            <strong>{cloudStatus?.connected ? cloudStatus.pendingDownload : gitEnv?.available ? copy('\u73af\u5883\u5df2\u5c31\u7eea', 'Git ready') : copy('\u9700\u8981 Git', 'Need Git')}</strong>
          </article>
        </div>
      </section>

      {!project ? (
        <section className="panel">
          <div className="empty-action-panel">
            <h3>{copy('\u5148\u6253\u5f00\u4e00\u4e2a\u9879\u76ee', 'Open a project first')}</h3>
            <p>{copy('\u53ea\u6709\u6253\u5f00\u4e86\u9879\u76ee\uff0c\u6211\u4eec\u624d\u80fd\u5e2e\u4f60\u914d\u7f6e\u8fd9\u4e2a\u9879\u76ee\u7684\u4e91\u7aef\u540c\u6b65\u3002', 'We can only set up cloud sync after a project is open.')}</p>
            <div className="actions-row">
              <button className="btn btn-primary" onClick={() => void openProjectFolder()}>
                {t('app_open_project')}
              </button>
            </div>
          </div>
        </section>
      ) : !project.isProtected ? (
        <section className="panel">
          <div className="empty-action-panel">
            <h3>{copy('\u5148\u5f00\u542f\u7248\u672c\u4fdd\u62a4', 'Turn on protection first')}</h3>
            <p>{copy('\u8fd9\u4e2a\u9879\u76ee\u8fd8\u6ca1\u6709\u5f00\u542f\u7248\u672c\u4fdd\u62a4\uff0c\u6240\u4ee5\u4e91\u7aef\u4e0a\u4f20\u548c\u83b7\u53d6\u8fd8\u4e0d\u5b89\u5168\u3002', 'This project is not protected yet, so cloud upload and download are not ready.')}</p>
            <div className="actions-row">
              <button className="btn btn-primary" onClick={() => void enableProtection()}>
                {t('app_enable_protection')}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {projectReadyForCloud ? (
        <div className="settings-grid">
          <section className="panel settings-card">
            <div className="section-head">
              <div>
                <h2>{copy('\u8fde\u63a5\u8fd9\u4e2a\u9879\u76ee', 'Connect This Project')}</h2>
                <p className="panel-subtitle">
                  {copy('\u9009\u62e9\u540c\u6b65\u5730\u65b9\u3002', 'Choose the sync destination.')}
                </p>
              </div>
              <span className="pill">{providerLabel}</span>
            </div>

            <div className="settings-stack-tight">
              <label className="switch-row stacked">
                <span>{copy('\u4e91\u7aef\u5e73\u53f0', 'Cloud provider')}</span>
                <select
                  className="input-select"
                  value={cloudPlatform}
                  onChange={(event) => setCloudPlatform(event.target.value as CloudPlatform)}
                >
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="custom">{t('settings_cloud_platform_custom')}</option>
                </select>
              </label>

              {cloudPlatform === 'github' ? (
                <div className="settings-status-card">
                  <span>{copy('GitHub \u8d26\u53f7', 'GitHub account')}</span>
                  <strong>
                    {githubAuthStatus?.available
                      ? activeGitHubAccount ?? copy('\u8fd8\u6ca1\u767b\u5f55', 'Not signed in yet')
                      : copy('\u8fd9\u53f0\u7535\u8111\u8fd8\u6ca1\u51c6\u5907\u597d', 'Not available on this device')}
                  </strong>
                  <div className="actions-row">
                    <button className="btn btn-secondary" disabled={authWorking} onClick={() => void loadGitHubAuthStatus()}>
                      {copy('\u5237\u65b0\u72b6\u6001', 'Refresh')}
                    </button>
                    {activeGitHubAccount ? (
                      <button
                        className="btn btn-secondary"
                        disabled={authWorking}
                        onClick={() => void handleGitHubLogout(activeGitHubAccount)}
                      >
                        {copy('\u9000\u51fa\u8fd9\u4e2a\u8d26\u53f7', 'Sign Out')}
                      </button>
                    ) : (
                      <button className="btn btn-primary" disabled={authWorking} onClick={() => void handleGitHubLogin()}>
                        {copy('\u767b\u5f55 GitHub', 'Sign In to GitHub')}
                      </button>
                    )}
                  </div>
                  {githubAuthStatus?.accounts.length ? (
                    <label className="switch-row stacked">
                      <span>{t('settings_cloud_account_use_for_project')}</span>
                      <select
                        className="input-select"
                        value={selectedGitHubAccount}
                        onChange={(event) => setSelectedGitHubAccount(event.target.value)}
                      >
                        {githubAuthStatus.accounts.map((account) => (
                          <option key={account} value={account}>
                            {account}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              ) : null}

              {cloudPlatform === 'custom' ? (
                <div className="settings-note">
                  <strong>{copy('\u81ea\u5b9a\u4e49\u4ed3\u5e93\u5730\u5740', 'Custom remote address')}</strong>
                  <p>{t('settings_cloud_helper_custom_desc')}</p>
                </div>
              ) : (
                <div className="settings-inline-grid">
                  <input
                    className="input-text"
                    value={cloudOwner}
                    onChange={(event) => setCloudOwner(event.target.value)}
                    placeholder={t('settings_cloud_owner_placeholder')}
                  />
                  <input
                    className="input-text"
                    value={cloudRepo}
                    onChange={(event) => setCloudRepo(event.target.value)}
                    placeholder={t('settings_cloud_repo_placeholder')}
                  />
                  <button className="btn btn-secondary" disabled={syncing} onClick={() => applyWizardUrl()}>
                    {copy('\u751f\u6210\u4ed3\u5e93\u5730\u5740', 'Fill Address')}
                  </button>
                </div>
              )}

              <label className="switch-row stacked">
                <span>{copy('\u4ed3\u5e93\u5730\u5740', 'Repository address')}</span>
                <input
                  className="input-text"
                  value={remoteUrlInput}
                  onChange={(event) => setRemoteUrlInput(event.target.value)}
                  placeholder={t('settings_cloud_url_placeholder')}
                />
              </label>

              <div className="actions-row">
                <button
                  className="btn btn-primary"
                  disabled={syncing || !remoteUrlInput.trim()}
                  onClick={() => void handleConnectCloud()}
                >
                  {copy('\u8fde\u63a5\u8fd9\u4e2a\u9879\u76ee', 'Connect This Project')}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={syncing || !remoteUrlInput.trim()}
                  onClick={() => void handleTestCloudConnection()}
                >
                  {copy('\u5148\u6d4b\u8bd5\u4e00\u4e0b', 'Test First')}
                </button>
              </div>

              <div className="actions-row">
                <button
                  className="btn btn-secondary"
                  disabled={syncing || authWorking || !providerLinks.signInUrl}
                  onClick={() =>
                    void (cloudPlatform === 'github' ? handleGitHubLogin() : openExternalUrl(providerLinks.signInUrl))
                  }
                >
                  {cloudPlatform === 'github'
                    ? copy('\u767b\u5f55 GitHub', 'Sign In to GitHub')
                    : t('settings_cloud_helper_sign_in')}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={syncing || authWorking || !providerLinks.createRepoUrl}
                  onClick={() => void openExternalUrl(providerLinks.createRepoUrl)}
                >
                  {copy('\u53bb\u521b\u5efa\u4ed3\u5e93', 'Create Repository')}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={syncing || authWorking || !providerLinks.repoPageUrl}
                  onClick={() => void openExternalUrl(providerLinks.repoPageUrl)}
                >
                  {copy('\u6253\u5f00\u8fd9\u4e2a\u4ed3\u5e93', 'Open Repository')}
                </button>
              </div>

              {connectionTest ? (
                <p className={connectionTest.reachable ? 'success-text' : 'muted'}>
                  {toCloudTestMessage(connectionTest, t)}
                </p>
              ) : null}

              {cloudAdvice ? <p className="muted">{cloudAdvice}</p> : null}
            </div>
          </section>

          <section className="panel settings-card">
            <div className="section-head">
              <div>
                <h2>{copy('\u73b0\u5728\u540c\u6b65', 'Sync Now')}</h2>
                <p className="panel-subtitle">{syncSummary}</p>
              </div>
              <span className="pill">{syncStateLabel}</span>
            </div>

            <div className="settings-stack-tight">
              <div className="settings-fact-grid">
                <article className="settings-fact-card settings-fact-card-wide">
                  <span>{copy('\u5f53\u524d\u8fde\u63a5', 'Current remote')}</span>
                  <strong>{cloudStatus?.remoteUrl || copy('\u8fd8\u6ca1\u8fde\u4e0a', 'Not connected yet')}</strong>
                </article>
                <article className="settings-fact-card">
                  <span>{copy('\u540c\u6b65\u72b6\u6001', 'Sync state')}</span>
                  <strong>{cloudStatus ? toCloudStatusText(cloudStatus, t) : copy('\u7b49\u5f85\u8fde\u63a5', 'Waiting for connection')}</strong>
                </article>
                <article className="settings-fact-card">
                  <span>{copy('\u5f53\u524d\u526f\u672c', 'Current copy')}</span>
                  <strong>
                    {cloudStatus
                      ? toPlanLabel(
                          cloudStatus.currentPlan,
                          cloudStatus.currentPlan === 'main' || cloudStatus.currentPlan === 'master',
                          t
                        )
                      : copy('\u4e3b\u7ebf', 'Main')}
                  </strong>
                </article>
                <article className="settings-fact-card">
                  <span>{copy('\u8fd8\u6ca1\u4e0a\u4f20', 'Pending upload')}</span>
                  <strong>{t('common_record_unit', { count: cloudStatus?.pendingUpload ?? 0 })}</strong>
                </article>
                <article className="settings-fact-card">
                  <span>{copy('\u8fd8\u6ca1\u53d6\u56de', 'Pending download')}</span>
                  <strong>{t('common_record_unit', { count: cloudStatus?.pendingDownload ?? 0 })}</strong>
                </article>
              </div>

              <div className="actions-row">
                <button
                  className="btn btn-primary"
                  disabled={syncing || !cloudStatus?.connected}
                  onClick={() => void handleUploadToCloud()}
                >
                  {t('settings_cloud_upload')}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={syncing || !cloudStatus?.connected}
                  onClick={() => void handleGetCloudLatest()}
                >
                  {t('settings_cloud_get_latest')}
                </button>
                <button className="btn btn-secondary" disabled={syncing} onClick={() => void loadCloudStatus()}>
                  {copy('\u5237\u65b0\u72b6\u6001', 'Refresh Status')}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <div className="settings-grid settings-grid-secondary">
        <section className="panel settings-card">
          <div className="section-head">
            <div>
                <h2>{copy('\u5e94\u7528\u504f\u597d', 'App Preferences')}</h2>
                <p className="panel-subtitle">
                  {copy('\u8bed\u8a00\u548c\u9ed8\u8ba4\u6587\u6848\u3002', 'Language and default notes.')}
                </p>
              </div>
          </div>
          {!config ? (
            <p className="muted">{t('settings_pref_loading')}</p>
          ) : (
            <div className="settings-stack-tight">
              <label className="switch-row stacked">
                <span>{t('settings_pref_language')}</span>
                <select
                  className="input-select"
                  value={config.settings.language}
                  onChange={(event) => void patchSettings({ language: event.target.value as AppLanguagePreference })}
                >
                  <option value="auto">{t('settings_pref_language_auto')}</option>
                  <option value="en-US">{t('settings_pref_language_en')}</option>
                  <option value="zh-CN">{t('settings_pref_language_zh')}</option>
                </select>
              </label>

              <label className="switch-row stacked">
                <span>{t('settings_pref_save_template')}</span>
                <input
                  className="input-text"
                  type="text"
                  value={config.settings.defaultSaveMessageTemplate}
                  onChange={(event) => void patchSettings({ defaultSaveMessageTemplate: event.target.value })}
                  placeholder={t('settings_pref_save_template_placeholder')}
                />
              </label>

              <label className="switch-row">
                <span>{t('settings_pref_show_guide')}</span>
                <input
                  type="checkbox"
                  checked={config.settings.showBeginnerGuide}
                  onChange={(event) => void patchSettings({ showBeginnerGuide: event.target.checked })}
                />
              </label>

              <label className="switch-row">
                <span>{t('settings_pref_show_advanced')}</span>
                <input
                  type="checkbox"
                  checked={config.settings.showAdvancedMode}
                  onChange={(event) => void patchSettings({ showAdvancedMode: event.target.checked })}
                />
              </label>
            </div>
          )}
        </section>

        <section className="panel settings-card">
          <div className="section-head">
            <div>
                <h2>{copy('\u5b89\u5168\u4e0e\u652f\u6301', 'Safety & Support')}</h2>
                <p className="panel-subtitle">
                  {copy('\u6062\u590d\u4fdd\u62a4\u548c\u65e5\u5fd7\u3002', 'Recovery protection and logs.')}
                </p>
              </div>
          </div>

          {!config ? (
            <p className="muted">{t('settings_pref_loading')}</p>
          ) : (
            <div className="settings-stack-tight">
              <label className="switch-row">
                <span>{t('settings_pref_snapshot_restore')}</span>
                <input
                  type="checkbox"
                  checked={config.settings.autoSnapshotBeforeRestore}
                  onChange={(event) => void patchSettings({ autoSnapshotBeforeRestore: event.target.checked })}
                />
              </label>

              <label className="switch-row">
                <span>{t('settings_pref_snapshot_merge')}</span>
                <input
                  type="checkbox"
                  checked={config.settings.autoSnapshotBeforeMerge}
                  onChange={(event) => void patchSettings({ autoSnapshotBeforeMerge: event.target.checked })}
                />
              </label>

              <div className="settings-status-card">
                <span>{copy('Git \u73af\u5883', 'Git environment')}</span>
                <strong>
                  {!gitEnv
                    ? copy('\u6b63\u5728\u68c0\u67e5', 'Checking')
                    : gitEnv.available
                      ? t('settings_env_available', { version: gitEnv.version })
                      : t('settings_env_missing')}
                </strong>
              </div>

              <div className="actions-row">
                <button className="btn btn-secondary" disabled={checking} onClick={() => void loadGitEnvironment()}>
                  {t('settings_env_recheck')}
                </button>
                <button className="btn btn-secondary" onClick={() => void handleExportLogs()}>
                  {t('settings_trouble_export_logs')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
