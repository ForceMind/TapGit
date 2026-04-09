import { useI18n } from '../i18n';

interface IdeaCopyDialogProps {
  value: string;
  sourceLabel: string;
  busy: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function IdeaCopyDialog({
  value,
  sourceLabel,
  busy,
  onChange,
  onCancel,
  onConfirm
}: IdeaCopyDialogProps) {
  const { t } = useI18n();

  return (
    <div className="dialog-backdrop" role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        className="dialog-card prompt-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="idea-copy-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-eyebrow">{t('plans_dialog_eyebrow')}</div>
        <h3 id="idea-copy-dialog-title">{t('plans_dialog_title')}</h3>
        <p className="dialog-description">{t('plans_dialog_desc')}</p>

        <div className="form-stack">
          <div className="field-stack">
            <span className="field-label">{t('plans_create_from_label')}</span>
            <div className="import-status-card">
              <strong>{sourceLabel}</strong>
            </div>
          </div>

          <label className="field-stack">
            <span className="field-label">{t('plans_dialog_name_label')}</span>
            <input
              className="input-text"
              value={value}
              placeholder={t('plans_create_placeholder')}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
        </div>

        <div className="dialog-actions">
          <button className="btn btn-secondary" disabled={busy} onClick={onCancel}>
            {t('common_cancel')}
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={onConfirm}>
            {busy ? t('plans_dialog_loading') : t('plans_dialog_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
