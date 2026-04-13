import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toLocalizedErrorMessage, toSafetyBackupSourceLabel, useI18n } from '../i18n';
import { HistoryRecord, SafetyBackup } from '../shared/contracts';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';

function formatDateTime(timestamp: number | null) {
  if (!timestamp) {
    return '-';
  }
  return dayjs.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

function formatShortDateTime(timestamp: number | null) {
  if (!timestamp) {
    return '-';
  }
  return dayjs.unix(timestamp).format('MM-DD HH:mm');
}

export function TimelinePage() {
  const { project, config, setNotice } = useAppStore();
  const { openProjectFolder, enableProtection, refreshProject } = useAppActions();
  const { locale, t } = useI18n();
  const [historyLoading, setHistoryLoading] = useState(false);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [backups, setBackups] = useState<SafetyBackup[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedBackupId, setSelectedBackupId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);

  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);

  const selectedRecord = useMemo(
    () => records.find((item) => item.id === selectedId) ?? records[0] ?? null,
    [records, selectedId]
  );

  const selectedBackup = useMemo(
    () => backups.find((item) => item.id === selectedBackupId) ?? backups[0] ?? null,
    [backups, selectedBackupId]
  );

  const timelineStateLabel = historyLoading || backupsLoading
    ? copy('\u6b63\u5728\u6574\u7406', 'Loading')
    : records.length === 0
      ? copy('\u5148\u4fdd\u5b58\u4e00\u6b21', 'Save once first')
      : backups.length > 0
        ? copy('\u53ef\u4ee5\u5b89\u5168\u56de\u5230\u4ee5\u524d', 'Ready to go back safely')
        : copy('\u5386\u53f2\u5df2\u53ef\u7528', 'History is ready');

  async function loadRecords() {
    if (!project?.path || !project.isProtected) {
      return;
    }

    setHistoryLoading(true);
    try {
      const data = await unwrapResult(getBridge().listHistory(project.path));
      setRecords(data);
      setSelectedId((current) => data.find((item) => item.id === current)?.id ?? data[0]?.id ?? '');
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'timeline_notice_load_failed')
      });
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadBackups() {
    if (!project?.path || !project.isProtected) {
      return;
    }

    setBackupsLoading(true);
    try {
      const data = await unwrapResult(getBridge().listSafetyBackups(project.path));
      setBackups(data);
      setSelectedBackupId((current) => data.find((item) => item.id === current)?.id ?? data[0]?.id ?? '');
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'timeline_backup_notice_load_failed')
      });
    } finally {
      setBackupsLoading(false);
    }
  }

  async function refreshTimelineData() {
    await Promise.all([loadRecords(), loadBackups()]);
  }

  useEffect(() => {
    void refreshTimelineData();
  }, [project?.path, project?.isProtected]);

  async function handleRestoreRecord() {
    if (!project?.path || !selectedRecord) {
      return;
    }

    setRestoring(true);
    try {
      await unwrapResult(getBridge().restoreToRecord(project.path, selectedRecord.id));
      setNotice({ type: 'success', text: t('timeline_notice_restored') });
      setRestoreDialogOpen(false);
      await refreshProject();
      await refreshTimelineData();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'timeline_notice_restore_failed')
      });
    } finally {
      setRestoring(false);
    }
  }

  async function handleRestoreBackup() {
    if (!project?.path || !selectedBackup) {
      return;
    }

    setRestoring(true);
    try {
      await unwrapResult(getBridge().restoreToSafetyBackup(project.path, selectedBackup.id));
      setNotice({ type: 'success', text: t('timeline_backup_notice_restored') });
      setBackupDialogOpen(false);
      await refreshProject();
      await refreshTimelineData();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'timeline_notice_restore_failed')
      });
    } finally {
      setRestoring(false);
    }
  }

  if (!project) {
    return (
      <div className="page">
        <section className="panel">
          <h2>{copy('\u5386\u53f2', 'History')}</h2>
          <div className="empty-action-panel">
            <h3>{t('common_project_open_required')}</h3>
            <p>{t('common_project_open_help')}</p>
            <div className="actions-row">
              <button className="btn btn-primary" onClick={() => void openProjectFolder()}>
                {t('app_open_project')}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!project.isProtected) {
    return (
      <div className="page">
        <section className="panel">
          <h2>{copy('\u5386\u53f2', 'History')}</h2>
          <div className="empty-action-panel">
            <h3>{t('common_protection_required')}</h3>
            <p>{t('common_protection_help')}</p>
            <div className="actions-row">
              <button className="btn btn-primary" onClick={() => void enableProtection()}>
                {t('app_enable_protection')}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="panel timeline-hero">
        <div className="timeline-hero-copy">
          <span className="pill">{copy('\u5386\u53f2\u4e0e\u6062\u590d', 'History & Restore')}</span>
          <h1>{copy('\u5b89\u5168\u56de\u5230\u4ee5\u524d', 'Go Back Safely')}</h1>
          <p>
            {copy(
              '\u5728\u8fd9\u91cc\u627e\u5230\u4f60\u4e3b\u52a8\u4fdd\u5b58\u7684\u7248\u672c\uff0c\u4e5f\u53ef\u4ee5\u627e\u56de\u7cfb\u7edf\u5728\u6062\u590d\u524d\u81ea\u52a8\u7559\u4e0b\u7684\u5b89\u5168\u5907\u4efd\u3002',
              'Find the versions you saved on purpose, or return to an automatic safety backup created before risky actions.'
            )}
          </p>
        </div>
        <div className="timeline-hero-metrics">
          <article className="timeline-metric-card">
            <span>{copy('\u4fdd\u5b58\u70b9', 'Saved points')}</span>
            <strong>{historyLoading ? copy('\u6b63\u5728\u8bfb\u53d6', 'Loading') : records.length}</strong>
          </article>
          <article className="timeline-metric-card">
            <span>{copy('\u5b89\u5168\u5907\u4efd', 'Safety backups')}</span>
            <strong>{backupsLoading ? copy('\u6b63\u5728\u8bfb\u53d6', 'Loading') : backups.length}</strong>
          </article>
          <article className="timeline-metric-card">
            <span>{copy('\u5f53\u524d\u72b6\u6001', 'Current state')}</span>
            <strong>{timelineStateLabel}</strong>
          </article>
        </div>
      </section>

      <section className="panel split-panel">
        <div className="list-panel">
          <div className="section-head">
            <h2>{copy('\u4fdd\u5b58\u70b9', 'Saved Points')}</h2>
            <span className="pill">{t('common_record_unit', { count: records.length })}</span>
          </div>
          {historyLoading ? (
            <p className="muted">{t('timeline_loading')}</p>
          ) : records.length === 0 ? (
            <div className="empty-action-panel">
              <h3>{copy('\u8fd8\u6ca1\u6709\u4fdd\u5b58\u70b9', 'No saved points yet')}</h3>
              <p>{t('timeline_empty')}</p>
              <div className="actions-row">
                <Link className="btn btn-primary" to="/changes">
                  {t('timeline_empty_action')}
                </Link>
              </div>
            </div>
          ) : (
            <ul className="list">
              {records.map((item) => (
                <li
                  key={item.id}
                  className={`list-item ${selectedRecord?.id === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex-grow">
                    <div className="item-title">{item.message}</div>
                    <div className="item-subtle">
                      {dayjs.unix(item.timestamp).format('YYYY-MM-DD HH:mm')} |{' '}
                      {t('common_file_unit', { count: item.changedFiles })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="detail-panel workbench-panel">
          <div className="section-head">
            <div>
              <h2>{copy('\u9009\u4e2d\u7684\u4fdd\u5b58\u70b9', 'Selected Point')}</h2>
              <p className="panel-subtitle">
                {copy('\u786e\u8ba4\u8fd9\u4e2a\u7248\u672c\u5408\u9002\uff0c\u518d\u51b3\u5b9a\u8981\u4e0d\u8981\u56de\u5230\u5b83\u3002', 'Check this saved point, then decide whether to return to it.')}
              </p>
            </div>
            <div className="actions-row">
              {selectedRecord && config?.settings.showAdvancedMode ? (
                <span className="pill">{selectedRecord.id.slice(0, 8)}</span>
              ) : null}
              {selectedRecord ? (
                <button className="btn btn-danger" disabled={restoring} onClick={() => setRestoreDialogOpen(true)}>
                  {copy('\u56de\u5230\u8fd9\u4e2a\u4fdd\u5b58\u70b9', 'Return to This Save')}
                </button>
              ) : null}
            </div>
          </div>
          {!selectedRecord ? (
            <p className="muted">{t('timeline_select_record')}</p>
          ) : (
            <div className="detail-stack">
              <div className="detail-fact-grid">
                <article className="detail-fact-card">
                  <span>{copy('\u8bf4\u660e', 'Note')}</span>
                  <strong>{selectedRecord.message}</strong>
                </article>
                <article className="detail-fact-card">
                  <span>{copy('\u4fdd\u5b58\u65f6\u95f4', 'Saved at')}</span>
                  <strong>{formatDateTime(selectedRecord.timestamp)}</strong>
                </article>
                <article className="detail-fact-card">
                  <span>{copy('\u6d89\u53ca\u6587\u4ef6', 'Files in this save')}</span>
                  <strong>{t('common_file_unit', { count: selectedRecord.changedFiles })}</strong>
                </article>
              </div>
              <div className="detail-list-box">
                <strong>{copy('\u6587\u4ef6\u6e05\u5355', 'Files')}</strong>
                <ul className="mini-list">
                  {selectedRecord.files.slice(0, 20).map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="panel split-panel">
        <div className="list-panel">
          <div className="section-head">
            <h2>{copy('\u5b89\u5168\u5907\u4efd', 'Safety Backups')}</h2>
            <span className="pill">{t('common_record_unit', { count: backups.length })}</span>
          </div>
          {backupsLoading ? (
            <p className="muted">{t('timeline_backups_loading')}</p>
          ) : backups.length === 0 ? (
            <p className="muted">{t('timeline_backups_empty')}</p>
          ) : (
            <ul className="list">
              {backups.map((backup) => (
                <li
                  key={backup.id}
                  className={`list-item ${selectedBackup?.id === backup.id ? 'active' : ''}`}
                  onClick={() => setSelectedBackupId(backup.id)}
                >
                  <div className="flex-grow">
                    <div className="item-title">
                      {toSafetyBackupSourceLabel(backup.source, t)}
                      <span className="tag">{formatShortDateTime(backup.createdAt)}</span>
                    </div>
                    <div className="item-subtle">{backup.lastMessage || t('timeline_backup_no_record')}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="detail-panel workbench-panel">
          <div className="section-head">
            <div>
              <h2>{copy('\u9009\u4e2d\u7684\u5b89\u5168\u5907\u4efd', 'Selected Backup')}</h2>
              <p className="panel-subtitle">
                {copy('\u8fd9\u662f\u7cfb\u7edf\u5e2e\u4f60\u7559\u4e0b\u7684\u9000\u8def\uff0c\u9002\u5408\u5728\u6062\u590d\u524d\u518d\u68c0\u67e5\u4e00\u904d\u3002', 'This is the safety copy the app kept for you before a risky action.')}
              </p>
            </div>
            <div className="actions-row">
              {selectedBackup && config?.settings.showAdvancedMode ? (
                <span className="pill">{selectedBackup.id}</span>
              ) : null}
              {selectedBackup ? (
                <button className="btn btn-secondary" disabled={restoring} onClick={() => setBackupDialogOpen(true)}>
                  {copy('\u56de\u5230\u8fd9\u4e2a\u5b89\u5168\u5907\u4efd', 'Return to This Backup')}
                </button>
              ) : null}
            </div>
          </div>
          {!selectedBackup ? (
            <p className="muted">{t('timeline_backups_empty')}</p>
          ) : (
            <div className="detail-stack">
              <div className="detail-fact-grid">
                <article className="detail-fact-card">
                  <span>{copy('\u6765\u6e90', 'Created because')}</span>
                  <strong>{toSafetyBackupSourceLabel(selectedBackup.source, t)}</strong>
                </article>
                <article className="detail-fact-card">
                  <span>{copy('\u521b\u5efa\u65f6\u95f4', 'Created at')}</span>
                  <strong>{formatDateTime(selectedBackup.createdAt)}</strong>
                </article>
                <article className="detail-fact-card">
                  <span>{copy('\u5f53\u65f6\u6700\u65b0\u7684\u4fdd\u5b58', 'Latest saved note at that time')}</span>
                  <strong>{selectedBackup.lastMessage || t('timeline_backup_no_record')}</strong>
                </article>
              </div>
            </div>
          )}
        </div>
      </section>

      {restoreDialogOpen && selectedRecord ? (
        <ConfirmDialog
          title={t('timeline_restore_dialog_title')}
          description={t('timeline_restore_dialog_description')}
          details={[
            t('timeline_restore_dialog_time', {
              time: dayjs.unix(selectedRecord.timestamp).format('YYYY-MM-DD HH:mm')
            }),
            t('timeline_restore_dialog_files', { count: selectedRecord.changedFiles }),
            config?.settings.autoSnapshotBeforeRestore
              ? t('timeline_restore_dialog_snapshot_on')
              : t('timeline_restore_dialog_snapshot_off')
          ]}
          cancelLabel={t('common_cancel')}
          confirmLabel={t('timeline_restore_confirm_button')}
          confirmKind="danger"
          busy={restoring}
          onCancel={() => setRestoreDialogOpen(false)}
          onConfirm={() => void handleRestoreRecord()}
        />
      ) : null}

      {backupDialogOpen && selectedBackup ? (
        <ConfirmDialog
          title={t('timeline_backup_dialog_title')}
          description={t('timeline_backup_dialog_description')}
          details={[
            t('timeline_backup_dialog_created', {
              time: formatDateTime(selectedBackup.createdAt)
            }),
            `${t('timeline_backup_source_label')} ${toSafetyBackupSourceLabel(selectedBackup.source, t)}`,
            selectedBackup.lastMessage
              ? t('timeline_backup_dialog_message', { message: selectedBackup.lastMessage })
              : t('timeline_backup_no_record'),
            config?.settings.autoSnapshotBeforeRestore
              ? t('timeline_restore_dialog_snapshot_on')
              : t('timeline_restore_dialog_snapshot_off')
          ]}
          cancelLabel={t('common_cancel')}
          confirmLabel={t('timeline_backup_restore_button')}
          confirmKind="danger"
          busy={restoring}
          onCancel={() => setBackupDialogOpen(false)}
          onConfirm={() => void handleRestoreBackup()}
        />
      ) : null}
    </div>
  );
}
