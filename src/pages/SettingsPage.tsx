import { useEffect, useState } from 'react';
import {
  toCloudAdvice,
  toCloudStatusText,
  toCloudTestMessage,
  toLocalizedErrorMessage,
  toPlanLabel,
  useI18n
} from '../i18n';
import { BridgeError, getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';
import {
  AppLanguagePreference,
  CloudConnectionTestResult,
  CloudSyncStatus,
  GitEnvironment
} from '../shared/contracts';

type CloudPlatform = 'github' | 'gitlab' | 'custom';

export function SettingsPage() {
  const { project, config, setConfig, setNotice } = useAppStore();
  const { t } = useI18n();
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

  useEffect(() => {
    void loadGitEnvironment();
  }, []);

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
        const githubMatch = status.remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/i);
        const gitlabMatch = status.remoteUrl.match(/gitlab\.com[:/](.+?)\/(.+?)(\.git)?$/i);
        if (githubMatch) {
          setCloudPlatform('github');
          setCloudOwner(githubMatch[1]);
          setCloudRepo(githubMatch[2].replace(/\.git$/i, ''));
        } else if (gitlabMatch) {
          setCloudPlatform('gitlab');
          setCloudOwner(gitlabMatch[1]);
          setCloudRepo(gitlabMatch[2].replace(/\.git$/i, ''));
        }
      }
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'settings_notice_cloud_status_failed')
      });
    }
  }

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

  useEffect(() => {
    void loadCloudStatus();
  }, [project?.path, project?.isProtected]);

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
    if (!project?.path) return;
    setSyncing(true);
    try {
      const status = await unwrapResult(getBridge().connectCloud(project.path, remoteUrlInput.trim()));
      setCloudStatus(status);
      setRemoteUrlInput(status.remoteUrl);
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
    if (!project?.path) return;
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
    if (!project?.path) return;
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
    if (!project?.path) return;
    setSyncing(true);
    try {
      const result = await unwrapResult(getBridge().testCloudConnection(project.path, remoteUrlInput.trim()));
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

  return (
    <div className="page">
      <section className="panel">
        <div className="section-head">
          <h2>{t('settings_env_title')}</h2>
          <button className="btn btn-secondary" disabled={checking} onClick={() => void loadGitEnvironment()}>
            {t('settings_env_recheck')}
          </button>
        </div>
        {!gitEnv ? (
          <p className="muted">{t('settings_env_loading')}</p>
        ) : gitEnv.available ? (
          <p className="success-text">{t('settings_env_available', { version: gitEnv.version })}</p>
        ) : (
          <p className="danger-text">{t('settings_env_missing')}</p>
        )}
      </section>

      <section className="panel">
        <h2>{t('settings_pref_title')}</h2>
        {!config ? (
          <p className="muted">{t('settings_pref_loading')}</p>
        ) : (
          <div className="settings-stack">
            <label className="switch-row">
              <span>{t('settings_pref_show_advanced')}</span>
              <input
                type="checkbox"
                checked={config.settings.showAdvancedMode}
                onChange={(event) => void patchSettings({ showAdvancedMode: event.target.checked })}
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
            <label className="switch-row stacked">
              <span>{t('settings_pref_language')}</span>
              <select
                className="input-select"
                value={config.settings.language}
                onChange={(event) =>
                  void patchSettings({ language: event.target.value as AppLanguagePreference })
                }
              >
                <option value="auto">{t('settings_pref_language_auto')}</option>
                <option value="en-US">{t('settings_pref_language_en')}</option>
                <option value="zh-CN">{t('settings_pref_language_zh')}</option>
              </select>
            </label>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{t('settings_cloud_title')}</h2>
        {!project ? (
          <p className="muted">{t('settings_cloud_open_first')}</p>
        ) : !project.isProtected ? (
          <p className="muted">{t('settings_cloud_enable_first')}</p>
        ) : (
          <div className="settings-stack">
            <label className="switch-row stacked">
              <span>{t('settings_cloud_wizard')}</span>
              <div className="field-row">
                <select
                  className="input-select"
                  value={cloudPlatform}
                  onChange={(event) => setCloudPlatform(event.target.value as CloudPlatform)}
                >
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="custom">{t('settings_cloud_platform_custom')}</option>
                </select>
                {cloudPlatform === 'custom' ? (
                  <span className="muted">{t('settings_cloud_custom_hint')}</span>
                ) : (
                  <>
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
                      {t('settings_cloud_fill_url')}
                    </button>
                  </>
                )}
              </div>
            </label>

            <label className="switch-row stacked">
              <span>{t('settings_cloud_url')}</span>
              <div className="field-row">
                <input
                  className="input-text"
                  value={remoteUrlInput}
                  onChange={(event) => setRemoteUrlInput(event.target.value)}
                  placeholder={t('settings_cloud_url_placeholder')}
                />
                <button className="btn btn-secondary" disabled={syncing} onClick={() => void handleConnectCloud()}>
                  {t('settings_cloud_connect')}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={syncing || !remoteUrlInput.trim()}
                  onClick={() => void handleTestCloudConnection()}
                >
                  {t('settings_cloud_test')}
                </button>
              </div>
            </label>

            {connectionTest ? (
              <p className={connectionTest.reachable ? 'success-text' : 'muted'}>
                {toCloudTestMessage(connectionTest, t)}
              </p>
            ) : null}

            {cloudAdvice ? <p className="muted">{cloudAdvice}</p> : null}

            {cloudStatus ? (
              <div className="detail-stack">
                <p>
                  <strong>{t('settings_cloud_status')}</strong>
                  {toCloudStatusText(cloudStatus, t)}
                </p>
                <p>
                  <strong>{t('settings_cloud_plan')}</strong>
                  {toPlanLabel(
                    cloudStatus.currentPlan,
                    cloudStatus.currentPlan === 'main' || cloudStatus.currentPlan === 'master',
                    t
                  )}
                </p>
                <p>
                  <strong>{t('settings_cloud_pending_upload')}</strong>
                  {t('common_record_unit', { count: cloudStatus.pendingUpload })}
                </p>
                <p>
                  <strong>{t('settings_cloud_pending_download')}</strong>
                  {t('common_record_unit', { count: cloudStatus.pendingDownload })}
                </p>
              </div>
            ) : (
              <p className="muted">{t('settings_cloud_loading')}</p>
            )}

            <div className="actions-row">
              <button
                className="btn btn-secondary"
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
                {t('settings_cloud_refresh')}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{t('settings_trouble_title')}</h2>
        <p className="muted">{t('settings_trouble_desc')}</p>
        <button className="btn btn-secondary" onClick={() => void handleExportLogs()}>
          {t('settings_trouble_export_logs')}
        </button>
      </section>
    </div>
  );
}
