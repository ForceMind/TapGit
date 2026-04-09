import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useAppActions } from '../app/app-context';
import { toLocalizedErrorMessage, useI18n } from '../i18n';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';
import { HistoryRecord } from '../shared/contracts';

export function TimelinePage() {
  const { project, config, setNotice } = useAppStore();
  const { refreshProject } = useAppActions();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [restoring, setRestoring] = useState(false);

  const selectedRecord = useMemo(
    () => records.find((item) => item.id === selectedId) ?? records[0],
    [records, selectedId]
  );

  async function loadRecords() {
    if (!project?.path || !project.isProtected) return;
    setLoading(true);
    try {
      const data = await unwrapResult(getBridge().listHistory(project.path));
      setRecords(data);
      if (data.length > 0) setSelectedId(data[0].id);
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'timeline_notice_load_failed')
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, [project?.path, project?.isProtected]);

  async function handleRestore() {
    if (!project?.path || !selectedRecord) return;
    const confirmResult = window.confirm(
      t('timeline_restore_confirm', {
        time: dayjs.unix(selectedRecord.timestamp).format('YYYY-MM-DD HH:mm')
      })
    );
    if (!confirmResult) return;

    setRestoring(true);
    try {
      await unwrapResult(getBridge().restoreToRecord(project.path, selectedRecord.id));
      setNotice({ type: 'success', text: t('timeline_notice_restored') });
      await refreshProject();
      await loadRecords();
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
          {loading ? (
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
                {dayjs.unix(selectedRecord.timestamp).format('YYYY-MM-DD HH:mm:ss')}
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
                <button className="btn btn-danger" disabled={restoring} onClick={() => void handleRestore()}>
                  {t('timeline_restore_button')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
