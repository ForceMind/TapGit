import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useAppActions } from '../app/app-context';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toLocalizedErrorMessage, toSafetyBackupSourceLabel, useI18n } from '../i18n';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';
import { HistoryRecord, SafetyBackup } from '../shared/contracts';

function formatDateTime(timestamp: number | null) {
  if (!timestamp) return '—';
  return dayjs.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

function formatShortDateTime(timestamp: number | null) {
  if (!timestamp) return '—';
  return dayjs.unix(timestamp).format('MM-DD HH:mm');
}

export function TimelinePage() {
  const { project, config, setNotice } = useAppStore();
  const { refreshProject } = useAppActions();
  const { t } = useI18n();
  const [historyLoading, setHistoryLoading] = useState(false);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [backups, setBackups] = useState<SafetyBackup[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedBackupId, setSelectedBackupId] = useState<string>('');
  const [restoring, setRestoring] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);

  const selectedRecord = useMemo(
    () => records.find((item) => item.id === selectedId) ?? records[0],
    [records, selectedId]
  );

  const selectedBackup = useMemo(
    () => backups.find((item) => item.id === selectedBackupId) ?? backups[0],
    [backups, selectedBackupId]
  );

  async function loadRecords() {
    if (!project?.path || !project.isProtected) return;
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
    if (!project?.path || !project.isProtected) return;
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
    if (!project?.path || !selectedRecord) return;

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
    if (!project?.path || !selectedBackup) return;

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
          <h2>{t('timeline_title')}</h2>
          <p className="muted">{t('common_project_open_required')}</p>
        </section>
      </div>
    );
  }

  if (!project.isProtected) {
    return (
      <div className="page">
        <section className="panel">
          <h2>{t('timeline_title')}</h2>
          <p className="muted">{t('common_protection_required')}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="panel split-panel">
        <div className="list-panel">
          <div className="section-head">
            <h2>{t('timeline_history')}</h2>
            <span className="pill">{t('common_record_unit', { count: records.length })}</span>
          </div>
          {historyLoading ? (
            <p className="muted">{t('timeline_loading')}</p>
          ) : records.length === 0 ? (
            <p className="muted">{t('timeline_empty')}</p>
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
                      {dayjs.unix(item.timestamp).format('YYYY-MM-DD HH:mm')} ·{' '}
                      {t('common_file_unit', { count: item.changedFiles })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="detail-panel">
          <div className="section-head">
            <h2>{t('timeline_details')}</h2>
            {selectedRecord && config?.settings.showAdvancedMode ? (
              <span className="pill">{selectedRecord.id.slice(0, 8)}</span>
            ) : null}
          </div>
          {!selectedRecord ? (
            <p className="muted">{t('timeline_select_record')}</p>
          ) : (
            <div className="detail-stack">
              <p>
                <strong>{t('timeline_label_message')}</strong>
                {selectedRecord.message}
              </p>
              <p>
                <strong>{t('timeline_label_time')}</strong>
                {formatDateTime(selectedRecord.timestamp)}
              </p>
              <p>
                <strong>{t('timeline_label_changed_files')}</strong>
                {selectedRecord.changedFiles}
              </p>
              <div>
                <strong>{t('timeline_label_files')}</strong>
                <ul className="mini-list">
                  {selectedRecord.files.slice(0, 20).map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </div>
              <div className="actions-row">
                <button
                  className="btn btn-danger"
                  disabled={restoring}
                  onClick={() => setRestoreDialogOpen(true)}
                >
                  {t('timeline_restore_button')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="panel split-panel">
        <div className="list-panel">
          <div className="section-head">
            <div>
              <h2>{t('timeline_backups_title')}</h2>
              <p className="panel-subtitle">{t('timeline_backups_subtitle')}</p>
            </div>
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

        <div className="detail-panel">
          <div className="section-head">
            <h2>{t('timeline_backup_details')}</h2>
            {selectedBackup && config?.settings.showAdvancedMode ? (
              <span className="pill">{selectedBackup.id}</span>
            ) : null}
          </div>
          {!selectedBackup ? (
            <p className="muted">{t('timeline_backups_empty')}</p>
          ) : (
            <div className="detail-stack">
              <p>
                <strong>{t('timeline_backup_source_label')}</strong>
                {toSafetyBackupSourceLabel(selectedBackup.source, t)}
              </p>
              <p>
                <strong>{t('timeline_backup_created_label')}</strong>
                {formatDateTime(selectedBackup.createdAt)}
              </p>
              <p>
                <strong>{t('timeline_backup_last_record')}</strong>
                {selectedBackup.lastMessage || t('timeline_backup_no_record')}
              </p>
              <div className="actions-row">
                <button
                  className="btn btn-secondary"
                  disabled={restoring}
                  onClick={() => setBackupDialogOpen(true)}
                >
                  {t('timeline_backup_restore_button')}
                </button>
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
