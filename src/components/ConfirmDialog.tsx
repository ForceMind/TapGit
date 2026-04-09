import { useI18n } from '../i18n';

interface ConfirmDialogProps {
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  cancelLabel: string;
  confirmKind?: 'primary' | 'danger';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  description,
  details,
  confirmLabel,
  cancelLabel,
  confirmKind = 'primary',
  busy = false,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <div className="dialog-backdrop" role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        className="dialog-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-eyebrow">{t('dialog_safety_eyebrow')}</div>
        <h3 id="confirm-dialog-title">{title}</h3>
        <p className="dialog-description">{description}</p>
        {details && details.length > 0 ? (
          <ul className="dialog-list">
            {details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="dialog-actions">
          <button className="btn btn-secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${confirmKind === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
