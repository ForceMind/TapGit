import dayjs from 'dayjs';
import { BarChart3, Clock3, Copy, FileText, Filter, GitBranch, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toLocalizedErrorMessage, useI18n } from '../i18n';
import { HistoryRecord } from '../shared/contracts';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';

function formatDateTime(timestamp: number | null) {
  if (!timestamp) {
    return '-';
  }
  return dayjs.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

function formatRelative(timestamp: number | null, locale: string) {
  if (!timestamp) {
    return '-';
  }
  const hours = Math.max(1, Math.round((Date.now() / 1000 - timestamp) / 3600));
  if (hours < 24) {
    return locale === 'zh-CN' ? `${hours} 小时前` : `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return locale === 'zh-CN' ? `${days} 天前` : `${days}d ago`;
}

export function TimelinePage() {
  const { project, config, setNotice } = useAppStore();
  const { openProjectFolder, enableProtection, refreshProject } = useAppActions();
  const { locale, t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return records;
    return records.filter((item) => {
      return (
        item.message.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword) ||
        item.files.some((file) => file.toLowerCase().includes(keyword))
      );
    });
  }, [query, records]);

  const selectedRecord = useMemo(
    () => records.find((item) => item.id === selectedId) ?? filteredRecords[0] ?? null,
    [filteredRecords, records, selectedId]
  );

  async function loadRecords() {
    if (!project?.path || !project.isProtected) {
      return;
    }

    setLoading(true);
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
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
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

  function renderEmptyState(title: string, description: string, action: ReactNode) {
    return (
      <div className="page page-v2">
        <section className="state-card-v2">
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="actions-row">{action}</div>
        </section>
      </div>
    );
  }

  if (!project) {
    return renderEmptyState(
      copy('先打开一个项目', 'Open a project first'),
      t('common_project_open_help'),
      <button className="btn btn-primary" onClick={() => void openProjectFolder()}>
        {t('app_open_project')}
      </button>
    );
  }

  if (!project.isProtected) {
    return renderEmptyState(
      copy('先开启版本保护', 'Turn on protection first'),
      t('common_protection_help'),
      <button className="btn btn-primary" onClick={() => void enableProtection()}>
        {t('app_enable_protection')}
      </button>
    );
  }

  return (
    <div className="page page-v2 history-page-v2">
      <header className="section-header-v2">
        <div>
          <h1>{copy('提交历史', 'Save History')}</h1>
          <p>{copy('查看项目的提交记录和历史变更', 'Review saved records and project changes')}</p>
        </div>
        <div className="header-actions-v2">
          <button className="btn btn-secondary" disabled>
            <BarChart3 size={18} />
            {copy('图表视图', 'Graph View')}
          </button>
          <button className="btn btn-secondary" disabled>
            <GitBranch size={18} />
            {copy('比较提交', 'Compare Saves')}
          </button>
        </div>
      </header>

      <div className="history-filter-row-v2">
        <button className="history-branch-select-v2">
          <GitBranch size={18} />
          {project.currentPlan}
        </button>
        <label className="search-input-v2">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy('搜索提交信息、作者...', 'Search save notes, files...')}
          />
        </label>
        <button className="btn btn-secondary">
          <Filter size={18} />
          {copy('筛选', 'Filter')}
        </button>
      </div>

      <section className="history-layout-v2">
        <aside className="history-list-panel-v2">
          {loading ? (
            <p className="history-empty-v2">{t('timeline_loading')}</p>
          ) : filteredRecords.length === 0 ? (
            <div className="history-empty-v2">
              <strong>{copy('还没有保存记录', 'No saved records yet')}</strong>
              <span>{t('timeline_empty')}</span>
              <Link className="btn btn-primary" to="/changes">
                {t('timeline_empty_action')}
              </Link>
            </div>
          ) : (
            <>
              <div className="history-day-label-v2">{copy('今天', 'Today')}</div>
              <ul className="history-list-v2">
                {filteredRecords.map((record, index) => (
                  <li key={record.id}>
                    <button
                      type="button"
                      className={`history-row-v2 ${selectedRecord?.id === record.id ? 'active' : ''}`}
                      onClick={() => setSelectedId(record.id)}
                    >
                      <span className="history-dot-v2" />
                      <span className="history-icon-v2">
                        {index === 0 ? <GitBranch size={18} /> : <FileText size={18} />}
                      </span>
                      <span className="history-copy-v2">
                        <strong>{record.message}</strong>
                        <small>
                          {copy('本机用户', 'Local user')} · {formatRelative(record.timestamp, locale)}
                        </small>
                      </span>
                      <span className="history-id-v2">
                        {record.id.slice(0, 7)}
                        <Copy size={16} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="history-end-v2">{copy('没有更多提交了', 'No more saved records')}</div>
            </>
          )}
        </aside>

        <main className="history-detail-panel-v2">
          {!selectedRecord ? (
            <div className="history-empty-v2">{t('timeline_select_record')}</div>
          ) : (
            <>
              <div className="history-detail-head-v2">
                <div>
                  <h2>
                    {selectedRecord.message}
                    {records[0]?.id === selectedRecord.id ? (
                      <span>{copy('最新提交', 'Latest')}</span>
                    ) : null}
                  </h2>
                  <div className="history-id-line-v2">
                    <code>{selectedRecord.id.slice(0, 8)}</code>
                    <Copy size={16} />
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={() => setRestoreDialogOpen(true)}>
                  {t('timeline_restore_button')}
                </button>
              </div>

              <div className="history-meta-v2">
                <span>
                  <Clock3 size={18} />
                  {formatDateTime(selectedRecord.timestamp)}
                </span>
                <span>{t('common_file_unit', { count: selectedRecord.changedFiles })}</span>
              </div>

              <div className="history-message-box-v2">{selectedRecord.message}</div>

              <div className="history-file-summary-v2">
                <span>{copy(`此提交涉及 ${selectedRecord.changedFiles} 个文件的变更`, `This save changed ${selectedRecord.changedFiles} files`)}</span>
                <Link to="/changes">{copy('查看当前变更', 'View Current Changes')}</Link>
              </div>

              <div className="history-file-card-v2">
                <header>
                  <FileText size={22} />
                  <strong>{selectedRecord.files[0] ?? copy('文件列表', 'Files')}</strong>
                  <span>+{selectedRecord.changedFiles}</span>
                </header>
                <ul>
                  {selectedRecord.files.slice(0, 24).map((file) => (
                    <li key={file}>
                      <FileText size={17} />
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </main>
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
    </div>
  );
}
