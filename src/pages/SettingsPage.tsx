import { Cloud, GitBranch, Info, MonitorCog, Palette, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toCloudAdvice, toCloudStatusText, toCloudTestMessage, toLocalizedErrorMessage, toPlanLabel, useI18n } from '../i18n';
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
type SettingsTab = 'general' | 'git' | 'appearance' | 'sync' | 'safety' | 'about';

interface CloudProviderLinks {
  signInUrl?: string;
  createRepoUrl?: string;
  repoPageUrl?: string;
}

function readSettingsTab(search: string): SettingsTab {
  const tab = new URLSearchParams(search).get('tab');
  if (
    tab === 'general' ||
    tab === 'git' ||
    tab === 'appearance' ||
    tab === 'sync' ||
    tab === 'safety' ||
    tab === 'about'
  ) {
    return tab;
  }

  return 'general';
}

export function SettingsPage() {
  const { project, config, setConfig, setNotice } = useAppStore();
  const { locale, t } = useI18n();
  const { openProjectFolder, openCloneProjectDialog, enableProtection } = useAppActions();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => readSettingsTab(location.search));
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

  const tabs: Array<{ key: SettingsTab; label: string }> = [
    { key: 'general', label: copy('通用', 'General') },
    { key: 'git', label: 'Git' },
    { key: 'appearance', label: copy('外观', 'Appearance') },
    { key: 'sync', label: copy('同步', 'Sync') },
    { key: 'safety', label: copy('安全', 'Safety') },
    { key: 'about', label: copy('关于', 'About') }
  ];

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

  const activeGitHubAccount =
    selectedGitHubAccount || githubAuthStatus?.activeAccount || githubAuthStatus?.accounts[0] || null;

  const providerLabel = useMemo(() => {
    if (cloudPlatform === 'github') return 'GitHub';
    if (cloudPlatform === 'gitlab') return 'GitLab';
    return copy('其他仓库', 'Other Remote');
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
    setActiveTab(readSettingsTab(location.search));
  }, [location.search]);

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
      window.dispatchEvent(new Event('tapgit:github-auth-changed'));
      const needsBrowserCompletion = !status.activeAccount && status.browserLoginOpened;
      const needsManualLogin = !status.activeAccount && status.manualLoginRequired;
      setNotice({
        type: needsBrowserCompletion || needsManualLogin ? 'info' : 'success',
        text: needsManualLogin
          ? t('settings_notice_github_manual_open')
          : needsBrowserCompletion
            ? t('settings_notice_github_browser_opened')
            : t('settings_notice_github_login_success')
      });
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
      window.dispatchEvent(new Event('tapgit:github-auth-changed'));
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

  const syncStateText = !projectReadyForCloud
    ? copy('先打开项目并开启保护', 'Open and protect a project first')
    : !cloudStatus?.connected
      ? copy('尚未连接云端', 'Cloud not connected')
      : toCloudStatusText(cloudStatus, t);

  function renderGeneral() {
    return (
      <div className="settings-grid-v2">
        <section className="settings-card-v2">
          <h2>{copy('常规设置', 'General')}</h2>
          <div className="settings-fact-list-v2">
            <div>
              <strong>{copy('启动时打开', 'Open on launch')}</strong>
              <span>{copy('默认进入“我的项目”。这个入口固定保留，避免启动时迷路。', 'TapGit opens My Projects by default so the start point stays predictable.')}</span>
            </div>
          </div>
          <label className="settings-field-v2">
            <span>{copy('默认项目路径', 'Default project path')}</span>
            <div className="settings-inline-v2">
              <input className="input-text" value={project?.path ?? ''} readOnly placeholder="E:\\Privy\\Projects" />
              <button className="btn btn-secondary" onClick={() => void openProjectFolder()}>
                {copy('更改', 'Change')}
              </button>
            </div>
          </label>
          <label className="switch-row">
            <span>{t('settings_pref_show_guide')}</span>
            <input
              type="checkbox"
              checked={config?.settings.showBeginnerGuide ?? true}
              onChange={(event) => void patchSettings({ showBeginnerGuide: event.target.checked })}
            />
          </label>
        </section>

        <section className="settings-card-v2">
          <h2>{copy('提交设置', 'Save Settings')}</h2>
          <label className="settings-field-v2">
            <span>{t('settings_pref_save_template')}</span>
            <input
              className="input-text"
              value={config?.settings.defaultSaveMessageTemplate ?? ''}
              onChange={(event) => void patchSettings({ defaultSaveMessageTemplate: event.target.value })}
              placeholder={t('settings_pref_save_template_placeholder')}
            />
          </label>
          <div className="settings-fact-list-v2">
            <div>
              <strong>{copy('默认保存方式', 'Default save behavior')}</strong>
              <span>{copy('只保存到本机时间线；上传和获取最新内容由你手动触发。', 'Save to the local timeline only. Upload and get latest stay manual.')}</span>
            </div>
            <div>
              <strong>{copy('保存确认', 'Save confirmation')}</strong>
              <span>{copy('在“当前修改”页写说明并点击“保存节点”，不会再展示无法取消的假选项。', 'Write a note on Current Changes and click Save Point. No locked fake options are shown.')}</span>
            </div>
          </div>
        </section>

        <section className="settings-card-v2">
          <h2>{copy('用户信息', 'User')}</h2>
          <label className="settings-field-v2">
            <span>{copy('用户名', 'Name')}</span>
            <input className="input-text" value={activeGitHubAccount ?? 'TapGit User'} readOnly />
          </label>
          <label className="settings-field-v2">
            <span>{copy('签名预览', 'Signature Preview')}</span>
            <div className="settings-preview-v2">
              {activeGitHubAccount ?? 'TapGit User'} &lt;tapgit@local.dev&gt;
            </div>
          </label>
        </section>

        <section className="settings-card-v2">
          <h2>{copy('其他设置', 'Other Settings')}</h2>
          <div className="settings-fact-list-v2">
            <div>
              <strong>{copy('文件查看', 'File viewer')}</strong>
              <span>{copy('当前使用内置查看器展示修改内容；需要编辑时请用你熟悉的代码编辑器打开项目。', 'TapGit shows changes with the built-in viewer. Edit files in your preferred code editor.')}</span>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => void handleExportLogs()}>
            {copy('导出设置与日志', 'Export Settings and Logs')}
          </button>
        </section>
      </div>
    );
  }

  function renderGit() {
    return (
      <div className="settings-grid-v2">
        <section className="settings-card-v2">
          <h2>Git</h2>
          <div className="settings-status-card-v2">
            <MonitorCog size={24} />
            <div>
              <strong>
                {!gitEnv
                  ? copy('正在检查', 'Checking')
                  : gitEnv.available
                    ? t('settings_env_available', { version: gitEnv.version })
                    : t('settings_env_missing')}
              </strong>
              <span>{copy('码迹在后台调用 Git，但默认不会让普通用户学习命令。', 'TapGit uses Git in the background without exposing commands by default.')}</span>
            </div>
          </div>
          <button className="btn btn-secondary" disabled={checking} onClick={() => void loadGitEnvironment()}>
            <RefreshCw size={18} />
            {t('settings_env_recheck')}
          </button>
        </section>

        <section className="settings-card-v2">
          <h2>GitHub</h2>
          <div className="settings-status-card-v2">
            <GitBranch size={24} />
            <div>
              <strong>{activeGitHubAccount ?? copy('未登录', 'Not signed in')}</strong>
              <span>{githubAuthStatus?.available ? copy('这台电脑可以使用 GitHub 授权。', 'GitHub auth is available on this device.') : copy('GitHub 授权暂不可用。', 'GitHub auth is not available.')}</span>
            </div>
          </div>
          {githubAuthStatus?.accounts.length ? (
            <label className="settings-field-v2">
              <span>{t('settings_cloud_account_use_for_project')}</span>
              <select className="input-select" value={selectedGitHubAccount} onChange={(event) => setSelectedGitHubAccount(event.target.value)}>
                {githubAuthStatus.accounts.map((account) => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="actions-row">
            <button className="btn btn-primary" disabled={authWorking} onClick={() => void handleGitHubLogin()}>
              {copy('登录 GitHub', 'Sign In to GitHub')}
            </button>
            {activeGitHubAccount ? (
              <button className="btn btn-secondary" disabled={authWorking} onClick={() => void handleGitHubLogout(activeGitHubAccount)}>
                {copy('退出当前账号', 'Sign Out')}
              </button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  function renderAppearance() {
    return (
      <div className="settings-grid-v2">
        <section className="settings-card-v2">
          <h2>{copy('外观', 'Appearance')}</h2>
          <label className="settings-field-v2">
            <span>{t('settings_pref_language')}</span>
            <select
              className="input-select"
              value={config?.settings.language ?? 'auto'}
              onChange={(event) => void patchSettings({ language: event.target.value as AppLanguagePreference })}
            >
              <option value="auto">{t('settings_pref_language_auto')}</option>
              <option value="en-US">{t('settings_pref_language_en')}</option>
              <option value="zh-CN">{t('settings_pref_language_zh')}</option>
            </select>
          </label>
          <label className="switch-row">
            <span>{t('settings_pref_show_advanced')}</span>
            <input
              type="checkbox"
              checked={config?.settings.showAdvancedMode ?? false}
              onChange={(event) => void patchSettings({ showAdvancedMode: event.target.checked })}
            />
          </label>
        </section>

        <section className="settings-card-v2">
          <h2>{copy('视觉方向', 'Visual Direction')}</h2>
          <div className="appearance-preview-v2">
            <Palette size={30} />
            <strong>{copy('轻量、清晰、像普通桌面 App', 'Light, clear, consumer-app style')}</strong>
            <span>{copy('复杂功能只在需要时出现。', 'Complex controls appear only when needed.')}</span>
          </div>
        </section>
      </div>
    );
  }

  function renderSyncModern() {
    if (!project) {
      return (
        <section className="state-card-v2 state-card-v2-start">
          <span className="eyebrow">{copy('先选择项目', 'Choose a project first')}</span>
          <h1>{copy('先拉取或打开一个项目', 'Get or open a project first')}</h1>
          <p>{copy('同步设置要跟某一个项目绑定。你可以从 GitHub 获取项目，也可以打开这台电脑上的项目文件夹。', 'Sync settings belong to one project. Get a project from GitHub or open a local project folder first.')}</p>
          <div className="actions-row">
            <button className="btn btn-primary" onClick={() => void openCloneProjectDialog()}>
              {copy('从 GitHub 获取', 'Get from GitHub')}
            </button>
            <button className="btn btn-secondary" onClick={() => void openProjectFolder()}>
              {copy('打开本地项目', 'Open Local Project')}
            </button>
          </div>
        </section>
      );
    }

    if (!project.isProtected) {
      return (
        <section className="state-card-v2">
          <h1>{copy('先开启版本保护', 'Turn on protection first')}</h1>
          <p>{copy('同步前先有保存节点，后面才能安全上传和恢复。', 'Create safe save points before uploading or restoring from cloud.')}</p>
          <button className="btn btn-primary" onClick={() => void enableProtection()}>{t('app_enable_protection')}</button>
        </section>
      );
    }

    const syncSteps = [
      {
        number: 1,
        title: copy('连接账号', 'Connect Account'),
        detail: activeGitHubAccount
          ? copy(`正在使用 ${activeGitHubAccount}`, `Using ${activeGitHubAccount}`)
          : copy('先登录 GitHub，之后拉取和上传都用这个账号。', 'Sign in to GitHub before getting or uploading changes.'),
        state: activeGitHubAccount ? copy('已完成', 'Done') : copy('需要处理', 'Needed')
      },
      {
        number: 2,
        title: copy('连接这个项目', 'Connect This Project'),
        detail: cloudStatus?.connected
          ? cloudStatus.remoteUrl
          : copy('填入云端仓库地址，码迹会记住这个项目的同步位置。', 'Enter the repository address TapGit should sync with.'),
        state: cloudStatus?.connected ? copy('已连接', 'Connected') : copy('未连接', 'Not connected')
      },
      {
        number: 3,
        title: copy('按保存节点同步', 'Sync Save Points'),
        detail: cloudStatus?.connected
          ? toCloudStatusText(cloudStatus, t)
          : copy('连接后再上传本地保存点，或获取云端最新保存点。', 'After connecting, upload local save points or get the latest cloud save points.'),
        state: cloudStatus?.connected ? copy('可同步', 'Ready') : copy('等待连接', 'Waiting')
      }
    ];

    return (
      <div className="sync-workflow-v2">
        <section className="sync-hero-v2">
          <div>
            <span>{copy('同步流程', 'Sync Workflow')}</span>
            <h2>{copy('先账号，再项目，最后同步保存节点', 'Account, project, then save points')}</h2>
            <p>{copy('普通用户只需要按这三步走：登录账号、连接项目地址、上传或获取保存记录。', 'Follow three steps: sign in, connect the project address, then upload or get saved records.')}</p>
          </div>
          <strong>{syncStateText}</strong>
        </section>

        <section className="sync-step-grid-v2">
          {syncSteps.map((step) => (
            <article key={step.number} className={step.number === 3 && cloudStatus?.connected ? 'ready' : ''}>
              <span>{step.number}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <small>{step.state}</small>
            </article>
          ))}
        </section>

        <section className="sync-panels-v2">
          <article className="sync-panel-v2">
            <h2>{copy('1. 账号', '1. Account')}</h2>
            <div className="settings-status-card-v2">
              <GitBranch size={24} />
              <div>
                <strong>{activeGitHubAccount ?? copy('未登录 GitHub', 'Not signed in to GitHub')}</strong>
                <span>{githubAuthStatus?.available ? copy('这台电脑可以打开 GitHub 授权。', 'GitHub sign-in is available on this device.') : copy('如果没有弹出网页，请检查系统浏览器或网络。', 'If no browser opens, check the default browser or network.')}</span>
              </div>
            </div>
            {githubAuthStatus?.accounts.length ? (
              <label className="settings-field-v2">
                <span>{t('settings_cloud_account_use_for_project')}</span>
                <select className="input-select" value={selectedGitHubAccount} onChange={(event) => setSelectedGitHubAccount(event.target.value)}>
                  {githubAuthStatus.accounts.map((account) => (
                    <option key={account} value={account}>{account}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="actions-row">
              <button className="btn btn-primary" disabled={authWorking} onClick={() => void handleGitHubLogin()}>
                {copy('登录 GitHub', 'Sign In to GitHub')}
              </button>
              {activeGitHubAccount ? (
                <button className="btn btn-secondary" disabled={authWorking} onClick={() => void handleGitHubLogout(activeGitHubAccount)}>
                  {copy('退出当前账号', 'Sign Out')}
                </button>
              ) : null}
            </div>
          </article>

          <article className="sync-panel-v2">
            <h2>{copy('2. 项目地址', '2. Project Address')}</h2>
            <label className="settings-field-v2">
              <span>{copy('云端平台', 'Cloud provider')}</span>
              <select className="input-select" value={cloudPlatform} onChange={(event) => setCloudPlatform(event.target.value as CloudPlatform)}>
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="custom">{t('settings_cloud_platform_custom')}</option>
              </select>
            </label>
            {cloudPlatform !== 'custom' ? (
              <div className="settings-inline-v2">
                <input className="input-text" value={cloudOwner} onChange={(event) => setCloudOwner(event.target.value)} placeholder={t('settings_cloud_owner_placeholder')} />
                <input className="input-text" value={cloudRepo} onChange={(event) => setCloudRepo(event.target.value)} placeholder={t('settings_cloud_repo_placeholder')} />
                <button className="btn btn-secondary" disabled={syncing} onClick={() => applyWizardUrl()}>{copy('生成地址', 'Fill Address')}</button>
              </div>
            ) : null}
            <label className="settings-field-v2">
              <span>{copy('仓库地址', 'Repository address')}</span>
              <input className="input-text" value={remoteUrlInput} onChange={(event) => setRemoteUrlInput(event.target.value)} placeholder={t('settings_cloud_url_placeholder')} />
            </label>
            <div className="actions-row">
              <button className="btn btn-primary" disabled={syncing || !remoteUrlInput.trim()} onClick={() => void handleConnectCloud()}>{copy('连接这个项目', 'Connect This Project')}</button>
              <button className="btn btn-secondary" disabled={syncing || !remoteUrlInput.trim()} onClick={() => void handleTestCloudConnection()}>{copy('测试连接', 'Test Connection')}</button>
              <button className="btn btn-secondary" disabled={syncing || !providerLinks.createRepoUrl} onClick={() => void openExternalUrl(providerLinks.createRepoUrl)}>{copy('创建仓库', 'Create Repository')}</button>
              <button className="btn btn-secondary" disabled={syncing || !providerLinks.repoPageUrl} onClick={() => void openExternalUrl(providerLinks.repoPageUrl)}>{copy('打开仓库', 'Open Repository')}</button>
            </div>
            <span className="settings-subtle-v2">{providerLabel}</span>
            {connectionTest ? <p className={connectionTest.reachable ? 'success-text' : 'muted'}>{toCloudTestMessage(connectionTest, t)}</p> : null}
            {cloudAdvice ? <p className="muted">{cloudAdvice}</p> : null}
          </article>

          <article className="sync-panel-v2">
            <h2>{copy('3. 同步保存节点', '3. Sync Save Points')}</h2>
            <div className="sync-node-summary-v2">
              <span>{copy('等待上传', 'Pending upload')}<strong>{cloudStatus?.pendingUpload ?? 0}</strong></span>
              <span>{copy('等待获取', 'Pending download')}<strong>{cloudStatus?.pendingDownload ?? 0}</strong></span>
              <span>{copy('当前路线', 'Current path')}<strong>{cloudStatus ? toPlanLabel(cloudStatus.currentPlan, cloudStatus.currentPlan === 'main' || cloudStatus.currentPlan === 'master', t) : project.currentPlan}</strong></span>
            </div>
            <div className="sync-node-rail-v2">
              <span>{copy('本地保存节点', 'Local save points')}</span>
              <i />
              <span>{copy('云端保存节点', 'Cloud save points')}</span>
            </div>
            <div className="actions-row">
              <button className="btn btn-primary" disabled={syncing || !cloudStatus?.connected} onClick={() => void handleUploadToCloud()}>{t('settings_cloud_upload')}</button>
              <button className="btn btn-secondary" disabled={syncing || !cloudStatus?.connected} onClick={() => void handleGetCloudLatest()}>{t('settings_cloud_get_latest')}</button>
              <button className="btn btn-secondary" disabled={syncing} onClick={() => void loadCloudStatus()}>{copy('刷新状态', 'Refresh')}</button>
            </div>
          </article>
        </section>
      </div>
    );
  }

  function renderSafety() {
    return (
      <div className="settings-grid-v2">
        <section className="settings-card-v2">
          <h2>{copy('恢复保护', 'Recovery Protection')}</h2>
          <label className="switch-row">
            <span>{t('settings_pref_snapshot_restore')}</span>
            <input
              type="checkbox"
              checked={config?.settings.autoSnapshotBeforeRestore ?? true}
              onChange={(event) => void patchSettings({ autoSnapshotBeforeRestore: event.target.checked })}
            />
          </label>
          <label className="switch-row">
            <span>{t('settings_pref_snapshot_merge')}</span>
            <input
              type="checkbox"
              checked={config?.settings.autoSnapshotBeforeMerge ?? true}
              onChange={(event) => void patchSettings({ autoSnapshotBeforeMerge: event.target.checked })}
            />
          </label>
        </section>
        <section className="settings-card-v2">
          <h2>{copy('支持', 'Support')}</h2>
          <button className="btn btn-secondary" onClick={() => void handleExportLogs()}>{t('settings_trouble_export_logs')}</button>
        </section>
      </div>
    );
  }

  function renderAbout() {
    return (
      <section className="settings-card-v2 wide about-card-v2">
        <Info size={34} />
        <h2>{copy('码迹 TapGit', 'TapGit')}</h2>
        <p>{copy('让普通人也敢用的代码进度保存与恢复软件。', 'A code progress save and restore app for non-Git users.')}</p>
        <span>v{import.meta.env.PACKAGE_VERSION ?? '1.0.9'}</span>
      </section>
    );
  }

  return (
    <div className="page page-v2 settings-page-v2">
      <header className="section-header-v2">
        <div>
          <h1>{copy('设置', 'Settings')}</h1>
          <p>{copy('自定义码迹的偏好设置', 'Customize TapGit preferences')}</p>
        </div>
        <div className="header-actions-v2">
          <button className="btn btn-secondary" onClick={() => void loadGitEnvironment()}>
            <RefreshCw size={18} />
            {copy('刷新', 'Refresh')}
          </button>
        </div>
      </header>

      <div className="settings-tabs-v2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? 'active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.key === 'general' ? <SlidersHorizontal size={18} /> : null}
            {tab.key === 'sync' ? <Cloud size={18} /> : null}
            {tab.key === 'safety' ? <ShieldCheck size={18} /> : null}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' ? renderGeneral() : null}
      {activeTab === 'git' ? renderGit() : null}
      {activeTab === 'appearance' ? renderAppearance() : null}
      {activeTab === 'sync' ? renderSyncModern() : null}
      {activeTab === 'safety' ? renderSafety() : null}
      {activeTab === 'about' ? renderAbout() : null}
    </div>
  );
}
