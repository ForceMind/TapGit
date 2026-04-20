import { GitHubAuthStatus } from '../shared/contracts';
import { useI18n } from '../i18n';
import { parseRemoteUrl } from '../shared/remote-url';

interface ProjectImportDialogProps {
  remoteUrl: string;
  folderName: string;
  destinationDirectory: string;
  authStatus: GitHubAuthStatus | null;
  preferredAccount: string;
  authLoading: boolean;
  busy: boolean;
  onRemoteUrlChange: (value: string) => void;
  onPreferredAccountChange: (value: string) => void;
  onFolderNameChange: (value: string) => void;
  onPickDestination: () => void;
  onLoginGitHub: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ProjectImportDialog({
  remoteUrl,
  folderName,
  destinationDirectory,
  authStatus,
  preferredAccount,
  authLoading,
  busy,
  onRemoteUrlChange,
  onPreferredAccountChange,
  onFolderNameChange,
  onPickDestination,
  onLoginGitHub,
  onCancel,
  onConfirm
}: ProjectImportDialogProps) {
  const { t } = useI18n();
  const isGitHubRemote = parseRemoteUrl(remoteUrl).provider === 'github';

  return (
    <div className="dialog-backdrop" role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        className="dialog-card import-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-import-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-eyebrow">{t('home_import_eyebrow')}</div>
        <h3 id="project-import-dialog-title">{t('home_import_title')}</h3>
        <p className="dialog-description">{t('home_import_desc')}</p>

        <div className="form-stack">
          <label className="field-stack">
            <span className="field-label">{t('home_import_url_label')}</span>
            <input
              className="input-text"
              value={remoteUrl}
              placeholder={t('home_import_url_placeholder')}
              onChange={(event) => onRemoteUrlChange(event.target.value)}
            />
          </label>

          <div className="field-stack">
            <span className="field-label">{t('home_import_destination_label')}</span>
            <div className="field-row">
              <input
                className="input-text"
                value={destinationDirectory}
                placeholder={t('home_import_destination_placeholder')}
                readOnly
              />
              <button className="btn btn-secondary" type="button" onClick={onPickDestination}>
                {t('home_import_pick_destination')}
              </button>
            </div>
          </div>

          <label className="field-stack">
            <span className="field-label">{t('home_import_folder_name_label')}</span>
            <input
              className="input-text"
              value={folderName}
              placeholder={t('home_import_folder_name_placeholder')}
              onChange={(event) => onFolderNameChange(event.target.value)}
            />
          </label>

          <div className="import-status-card">
            <div className="section-head">
              <div>
                <strong>{t('home_import_auth_title')}</strong>
                <p className="panel-subtitle">
                  {authLoading
                    ? t('home_import_auth_loading')
                    : authStatus?.activeAccount
                      ? t('home_import_auth_signed_in', { account: authStatus.activeAccount })
                      : t('home_import_auth_none')}
                </p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={onLoginGitHub}>
                {t('home_import_auth_action')}
              </button>
            </div>
            {isGitHubRemote && authStatus?.accounts.length ? (
              <label className="field-stack">
                <span className="field-label">{t('settings_cloud_account_use_for_project')}</span>
                <select
                  className="input-select"
                  value={preferredAccount}
                  onChange={(event) => onPreferredAccountChange(event.target.value)}
                >
                  {authStatus.accounts.map((account) => (
                    <option key={account} value={account}>
                      {account}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="panel-subtitle">{t('home_import_note')}</p>
          </div>
        </div>

        <div className="dialog-actions">
          <button className="btn btn-secondary" disabled={busy} onClick={onCancel}>
            {t('common_cancel')}
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={onConfirm}>
            {busy ? t('home_import_loading') : t('home_import_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
