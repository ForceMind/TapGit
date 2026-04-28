import dayjs from 'dayjs';
import { Clock3, Copy, FileText, GitBranch, RotateCcw, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toLocalizedErrorMessage, useI18n } from '../i18n';
import { HistoryRecord } from '../shared/contracts';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';

function formatDateTime(timestamp: number | null, locale: string) {
  if (!timestamp) return '-';
  return dayjs.unix(timestamp).format(locale === 'zh-CN' ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD HH:mm');
}

function formatRelative(timestamp: number | null, locale: string) {
  if (!timestamp) return '-';
  const hours = Math.max(1, Math.round((Date.now() / 1000 - timestamp) / 3600));
  if (hours < 24) return locale === 'zh-CN' ? `${hours} 小时前` : `${hours}h ago`;
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
    if (!project?.path || !project.isProtected) return;

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
    if (!project?.path || !selectedRecord) return;

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

  async function copyRecordId(id: string) {
    await navigator.clipboard?.writeText(id).catch(() => undefined);
    setNotice({ type: 'success', text: copy('已复制节点编号', 'Point ID copied') });
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
      <button className="btn btn-primary" onClick={() => void openProjectFolder()}>{t('app_open_project')}</button>
    );
  }

  if (!project.isProtected) {
    return renderEmptyState(
      copy('先开启保护', 'Turn on protection first'),
      t('common_protection_help'),
      <button className="btn btn-primary" onClick={() => void enableProtection()}>{t('app_enable_protection')}</button>
    );
  }

  return (
    <div className="page page-v2 history-page-v2 timeline-simple-page">
      <header className="simple-section-head">
        <div>
          <span className="simple-eyebrow">{copy('保存时间线', 'Save Timeline')}</span>
          <h1>{copy('每次保存都是一个可以回去的节点', 'Every save is a point you can return to')}</h1>
          <p>{copy('选择一个节点，就能查看当时保存了什么；需要时可以安全回到那里。', 'Pick a point to see what was saved there. Restore when needed.')}</p>
        </div>
        <div className="header-actions-v2">
          <Link className="btn btn-secondary" to="/changes">
            <FileText size={18} />
            {copy('查看当前修改', 'Current Changes')}
          </Link>
        </div>
      </header>

      <section className="timeline-overview-card">
        <div className="timeline-overview-copy">
          <GitBranch size={26} />
          <div>
            <strong>{copy('当前路线', 'Current Path')}</strong>
            <span>{project.currentPlan}</span>
          </div>
        </div>
        <label className="search-input-v2">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy('搜索节点说明或文件', 'Search notes or files')} />
        </label>
      </section>

      <section className="history-layout-v2 timeline-layout-simple">
        <aside className="history-list-panel-v2 timeline-list-simple">
          {loading ? (
            <p className="history-empty-v2">{t('timeline_loading')}</p>
          ) : filteredRecords.length === 0 ? (
            <div className="history-empty-v2">
              <strong>{copy('还没有保存节点', 'No save points yet')}</strong>
              <span>{t('timeline_empty')}</span>
              <Link className="btn btn-primary" to="/changes">{t('timeline_empty_action')}</Link>
            </div>
          ) : (
            <ol className="timeline-node-list">
              {filteredRecords.map((record, index) => (
                <li key={record.id}>
                  <button
                    type="button"
                    className={`timeline-node-row ${selectedRecord?.id === record.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <span className="timeline-node-dot">{index + 1}</span>
                    <span className="timeline-node-copy">
                      <strong>{record.message || copy('没有说明', 'No note')}</strong>
                      <small>{formatRelative(record.timestamp, locale)} · {record.changedFiles} {copy('个文件', 'files')}</small>
                    </span>
                    <code>{record.id.slice(0, 7)}</code>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>

        <main className="history-detail-panel-v2 timeline-detail-simple">
          {!selectedRecord ? (
            <div className="history-empty-v2">{t('timeline_select_record')}</div>
          ) : (
            <>
              <div className="timeline-point-hero">
                <span>{records[0]?.id === selectedRecord.id ? copy('最新节点', 'Latest point') : copy('历史节点', 'Saved point')}</span>
                <h2>{selectedRecord.message || copy('没有说明', 'No note')}</h2>
                <p>
                  <Clock3 size={18} />
                  {formatDateTime(selectedRecord.timestamp, locale)}
                </p>
              </div>

              <div className="timeline-action-row">
                <button className="btn btn-primary project-header-primary" onClick={() => setRestoreDialogOpen(true)}>
                  <RotateCcw size={18} />
                  {copy('回到这个节点', 'Restore This Point')}
                </button>
                <button className="btn btn-secondary" onClick={() => void copyRecordId(selectedRecord.id)}>
                  <Copy size={18} />
                  {copy('复制节点编号', 'Copy Point ID')}
                </button>
              </div>

              <section className="timeline-files-card">
                <h3>{copy('这个节点保存了哪些文件', 'Files saved in this point')}</h3>
                <div className="timeline-files-summary">
                  <strong>{selectedRecord.changedFiles}</strong>
                  <span>{copy('个文件有变化', 'files changed')}</span>
                </div>
                <ul>
                  {selectedRecord.files.slice(0, 28).map((file) => (
                    <li key={file}>
                      <FileText size={17} />
                      {file}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </main>
      </section>

      {restoreDialogOpen && selectedRecord ? (
        <ConfirmDialog
          title={copy('要回到这个保存节点吗？', 'Restore this save point?')}
          description={copy(
            '当前项目文件会回到这个时间点。码迹会先保留安全备份，方便你反悔。',
            'Project files will return to this point. TapGit keeps a safety backup first.'
          )}
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
          confirmLabel={copy('确认回到这里', 'Restore Now')}
          confirmKind="danger"
          busy={restoring}
          onCancel={() => setRestoreDialogOpen(false)}
          onConfirm={() => void handleRestoreRecord()}
        />
      ) : null}
    </div>
  );
}
