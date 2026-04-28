import dayjs from 'dayjs';
import { Clock3, Copy, FileText, GitBranch, RotateCcw, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toChangeStatusLabel, toLocalizedDiffText, toLocalizedErrorMessage, useI18n } from '../i18n';
import { HistoryFileChange, HistoryRecord, HistoryRecordDetails } from '../shared/contracts';
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

function splitDiffLines(diffText: string) {
  return diffText.split(/\r?\n/).slice(0, 360).map((line, index) => {
    const type = line.startsWith('+') && !line.startsWith('+++')
      ? 'add'
      : line.startsWith('-') && !line.startsWith('---')
        ? 'del'
        : line.startsWith('@@')
          ? 'meta'
          : 'normal';

    return { id: `${index}-${line}`, line, type };
  });
}

function defaultIdeaName(record: HistoryRecord) {
  return `idea-${record.id.slice(0, 7)}`;
}

export function TimelinePage() {
  const { project, config, setNotice } = useAppStore();
  const { openProjectFolder, enableProtection, refreshProject } = useAppActions();
  const { locale, t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [details, setDetails] = useState<HistoryRecordDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [ideaName, setIdeaName] = useState('');
  const [ideaCreating, setIdeaCreating] = useState(false);

  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);

  const chronologicalRecords = useMemo(() => [...records].reverse(), [records]);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return chronologicalRecords;
    return chronologicalRecords.filter((item) => {
      return (
        item.message.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword) ||
        item.files.some((file) => file.toLowerCase().includes(keyword))
      );
    });
  }, [chronologicalRecords, query]);

  const selectedRecord = useMemo(
    () => records.find((item) => item.id === selectedId) ?? filteredRecords[filteredRecords.length - 1] ?? null,
    [filteredRecords, records, selectedId]
  );

  const selectedChange = useMemo(() => {
    if (!details || details.id !== selectedRecord?.id) return null;
    return details.changes.find((item) => item.path === selectedFilePath) ?? details.changes[0] ?? null;
  }, [details, selectedFilePath, selectedRecord?.id]);

  const diffLines = useMemo(
    () => splitDiffLines(toLocalizedDiffText(selectedChange?.diffText ?? '', t)),
    [selectedChange?.diffText, t]
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

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      if (!project?.path || !selectedRecord) {
        setDetails(null);
        return;
      }

      setDetailsLoading(true);
      try {
        const nextDetails = await unwrapResult(
          getBridge().getHistoryRecordDetails(project.path, selectedRecord.id)
        );
        if (!cancelled) {
          setDetails(nextDetails);
          setSelectedFilePath((current) =>
            nextDetails.changes.some((item) => item.path === current)
              ? current
              : nextDetails.changes[0]?.path ?? ''
          );
        }
      } catch (error) {
        if (!cancelled) {
          setDetails(null);
          setNotice({
            type: 'error',
            text: toLocalizedErrorMessage(error, t, 'timeline_notice_load_failed')
          });
        }
      } finally {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      }
    }

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [project?.path, selectedRecord?.id]);

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

  async function handleCreateIdeaFromNode() {
    if (!project?.path || !selectedRecord) return;

    const finalName = ideaName.trim() || defaultIdeaName(selectedRecord);
    setIdeaCreating(true);
    try {
      await unwrapResult(getBridge().createPlan(project.path, finalName, selectedRecord.id));
      setNotice({
        type: 'success',
        text: copy('已从这个节点拉出一条新路线', 'Created a new path from this point')
      });
      setIdeaDialogOpen(false);
      setIdeaName('');
      await refreshProject();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'plans_notice_create_failed')
      });
    } finally {
      setIdeaCreating(false);
    }
  }

  async function copyRecordId(id: string) {
    await navigator.clipboard?.writeText(id).catch(() => undefined);
    setNotice({ type: 'success', text: copy('已复制节点编号', 'Point ID copied') });
  }

  function openIdeaDialog() {
    if (!selectedRecord) return;
    setIdeaName(defaultIdeaName(selectedRecord));
    setIdeaDialogOpen(true);
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

  function nodeNumber(record: HistoryRecord) {
    const index = chronologicalRecords.findIndex((item) => item.id === record.id);
    return index >= 0 ? index + 1 : 1;
  }

  function renderChangeRow(change: HistoryFileChange) {
    return (
      <button
        key={change.path}
        type="button"
        className={`timeline-file-change ${selectedChange?.path === change.path ? 'active' : ''}`}
        onClick={() => setSelectedFilePath(change.path)}
      >
        <FileText size={17} />
        <span>
          <strong>{change.path}</strong>
          <small>
            {toChangeStatusLabel(change.changeType, t)}
            <em>+{change.additions}</em>
            <em>-{change.deletions}</em>
          </small>
        </span>
      </button>
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
      <header className="simple-section-head compact">
        <div>
          <span className="simple-eyebrow">{copy('保存时间线', 'Save Timeline')}</span>
          <h1>{copy('按节点推进项目', 'Work point by point')}</h1>
          <p>{copy('先保存当前修改；需要试错时，选中一个节点，从那里拉出新路线。', 'Save changes first. When you need to experiment, pick a point and branch a new path from it.')}</p>
        </div>
        <div className="header-actions-v2">
          <Link className="btn btn-secondary" to="/changes">
            <FileText size={18} />
            {copy('当前修改', 'Current Changes')}
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

      <section className="timeline-route-card">
        {loading ? (
          <p className="history-empty-v2">{t('timeline_loading')}</p>
        ) : filteredRecords.length === 0 ? (
          <div className="timeline-empty-route">
            <strong>{copy('还没有保存节点', 'No save points yet')}</strong>
            <span>{t('timeline_empty')}</span>
            <Link className="btn btn-primary" to="/changes">{t('timeline_empty_action')}</Link>
          </div>
        ) : (
          <div className="timeline-route-scroll">
            <div className="timeline-route-line">
              {filteredRecords.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  className={`timeline-route-node ${selectedRecord?.id === record.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(record.id)}
                >
                  <span>{nodeNumber(record)}</span>
                  <strong>{record.message || copy('没有说明', 'No note')}</strong>
                  <small>{formatRelative(record.timestamp, locale)} · {record.changedFiles} {copy('个文件', 'files')}</small>
                </button>
              ))}
              <Link className="timeline-route-node new-point" to="/changes">
                <span>+</span>
                <strong>{copy('保存新节点', 'Save New Point')}</strong>
                <small>{project.pendingChangeCount > 0 ? copy(`${project.pendingChangeCount} 个修改待保存`, `${project.pendingChangeCount} changes waiting`) : copy('有修改时从这里保存', 'Save here when changes exist')}</small>
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="timeline-workbench">
        <aside className="timeline-node-detail">
          {!selectedRecord ? (
            <div className="history-empty-v2">{t('timeline_select_record')}</div>
          ) : (
            <>
              <div className="timeline-point-hero">
                <span>{records[0]?.id === selectedRecord.id ? copy('最新节点', 'Latest point') : copy(`节点 ${nodeNumber(selectedRecord)}`, `Point ${nodeNumber(selectedRecord)}`)}</span>
                <h2>{selectedRecord.message || copy('没有说明', 'No note')}</h2>
                <p>
                  <Clock3 size={18} />
                  {formatDateTime(selectedRecord.timestamp, locale)}
                </p>
              </div>

              <div className="timeline-action-row">
                <button className="btn btn-primary project-header-primary" onClick={() => openIdeaDialog()}>
                  <GitBranch size={18} />
                  {copy('从这里试新路线', 'Try a New Path Here')}
                </button>
                <button className="btn btn-secondary" onClick={() => setRestoreDialogOpen(true)}>
                  <RotateCcw size={18} />
                  {copy('回到这个节点', 'Restore This Point')}
                </button>
                <button className="btn btn-secondary" onClick={() => void copyRecordId(selectedRecord.id)}>
                  <Copy size={18} />
                  {copy('复制编号', 'Copy ID')}
                </button>
              </div>

              <section className="timeline-files-card">
                <h3>{copy('这个节点保存了哪些修改', 'Changes saved in this point')}</h3>
                <div className="timeline-files-summary">
                  <strong>{details?.changes.length ?? selectedRecord.changedFiles}</strong>
                  <span>{copy('个文件有代码记录', 'files with code records')}</span>
                </div>
                <div className="timeline-file-change-list">
                  {detailsLoading ? (
                    <p className="history-empty-v2">{copy('正在读取修改记录...', 'Loading code changes...')}</p>
                  ) : details?.changes.length ? (
                    details.changes.map(renderChangeRow)
                  ) : (
                    <p className="history-empty-v2">{copy('暂无可展示的代码记录', 'No code records to show')}</p>
                  )}
                </div>
              </section>
            </>
          )}
        </aside>

        <main className="timeline-code-panel">
          <div className="change-detail-head-v2">
            <div>
              <h2>{selectedChange?.path ?? copy('选择一个文件', 'Select a file')}</h2>
              {selectedChange ? (
                <p>
                  {toChangeStatusLabel(selectedChange.changeType, t)}
                  <span>+{selectedChange.additions}</span>
                  <span>-{selectedChange.deletions}</span>
                </p>
              ) : (
                <p>{copy('点击左侧文件，查看这个节点里的代码修改。', 'Click a file on the left to inspect the code change in this point.')}</p>
              )}
            </div>
          </div>

          <div className="diff-card-v2 timeline-diff-card">
            <div className="diff-columns-head-v2">
              <strong>{copy('修改前', 'Before')}</strong>
              <strong>{copy('修改后', 'After')}</strong>
            </div>
            {selectedChange ? (
              <div className="diff-lines-v2">
                {diffLines.map((line, index) => (
                  <div key={line.id} className={`diff-line-v2 ${line.type}`}>
                    <span>{index + 1}</span>
                    <code>{line.line || ' '}</code>
                  </div>
                ))}
              </div>
            ) : (
              <div className="diff-empty-v2">{copy('选择一个文件后，这里显示代码修改。', 'Select a file to show code changes here.')}</div>
            )}
          </div>
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

      {ideaDialogOpen && selectedRecord ? (
        <div className="dialog-backdrop" role="presentation" onClick={ideaCreating ? undefined : () => setIdeaDialogOpen(false)}>
          <div
            className="dialog-card idea-from-node-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="idea-from-node-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-eyebrow">{copy(`从节点 ${nodeNumber(selectedRecord)} 开始`, `From point ${nodeNumber(selectedRecord)}`)}</div>
            <h3 id="idea-from-node-title">{copy('试一条新路线', 'Try a new path')}</h3>
            <p className="dialog-description">
              {copy('码迹会从你选中的保存节点拉出一条新路线。原来的路线不会被破坏。', 'TapGit creates a new path from the selected save point. The original path stays safe.')}
            </p>
            <label className="field-stack">
              <span className="field-label">{copy('新路线名称', 'New path name')}</span>
              <input
                className="input-text"
                value={ideaName}
                onChange={(event) => setIdeaName(event.target.value)}
                placeholder={defaultIdeaName(selectedRecord)}
              />
            </label>
            <div className="dialog-actions">
              <button className="btn btn-secondary" disabled={ideaCreating} onClick={() => setIdeaDialogOpen(false)}>
                {t('common_cancel')}
              </button>
              <button className="btn btn-primary" disabled={ideaCreating} onClick={() => void handleCreateIdeaFromNode()}>
                {copy('创建新路线', 'Create New Path')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
