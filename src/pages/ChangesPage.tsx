import dayjs from 'dayjs';
import { CheckCircle2, FileText, FolderOpen, GitBranch, Search, Settings, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toChangeStatusLabel, toLocalizedDiffText, toLocalizedErrorMessage, useI18n } from '../i18n';
import { ChangeItem } from '../shared/contracts';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';

function statusText(status: ChangeItem['changeType'], locale: string) {
  if (status === 'added') return locale === 'zh-CN' ? '新增' : 'Added';
  if (status === 'deleted') return locale === 'zh-CN' ? '删除' : 'Deleted';
  if (status === 'renamed') return locale === 'zh-CN' ? '改名' : 'Renamed';
  return locale === 'zh-CN' ? '修改' : 'Modified';
}

function statusTone(status: ChangeItem['changeType']) {
  if (status === 'added') return 'added';
  if (status === 'deleted') return 'deleted';
  if (status === 'renamed') return 'renamed';
  return 'modified';
}

function splitDiffLines(diffText: string) {
  return diffText.split(/\r?\n/).slice(0, 260).map((line, index) => {
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

export function ChangesPage() {
  const { project, config, setNotice } = useAppStore();
  const { openProjectFolder, enableProtection, refreshProject } = useAppActions();
  const { locale, t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [fileActionBusy, setFileActionBusy] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);
  const checkedCount = selectedFiles.size;

  const filteredChanges = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return changes;
    return changes.filter((item) => item.path.toLowerCase().includes(keyword));
  }, [changes, query]);

  const selectedItem = useMemo(
    () => changes.find((item) => item.path === selectedPath) ?? filteredChanges[0] ?? null,
    [changes, filteredChanges, selectedPath]
  );

  const diffLines = useMemo(
    () => splitDiffLines(toLocalizedDiffText(selectedItem?.diffText ?? '', t)),
    [selectedItem?.diffText, t]
  );

  const totalAdditions = changes.reduce((sum, item) => sum + item.additions, 0);
  const totalDeletions = changes.reduce((sum, item) => sum + item.deletions, 0);

  async function loadChanges() {
    if (!project?.path || !project.isProtected) {
      return;
    }

    setLoading(true);
    try {
      const data = await unwrapResult(getBridge().getCurrentChanges(project.path));
      setChanges(data);
      setSelectedPath((current) => data.find((item) => item.path === current)?.path ?? data[0]?.path ?? '');
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'changes_notice_load_failed')
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChanges();
    setSelectedFiles(new Set());
  }, [project?.path, project?.isProtected]);

  function toggleSelection(filePath: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }

  async function handleSave(mode: 'all' | 'selected') {
    if (!project?.path) {
      return;
    }

    if (mode === 'selected' && selectedFiles.size === 0) {
      setNotice({ type: 'info', text: t('changes_notice_select_files') });
      return;
    }

    const autoMessage = t('changes_auto_message', { datetime: dayjs().format('YYYY-MM-DD HH:mm') });
    const finalMessage = message.trim() || config?.settings.defaultSaveMessageTemplate.trim() || autoMessage;

    setSaving(true);
    try {
      await unwrapResult(
        getBridge().saveProgress({
          projectPath: project.path,
          message: finalMessage,
          selectedFiles: mode === 'selected' ? Array.from(selectedFiles) : undefined
        })
      );
      setNotice({ type: 'success', text: t('changes_notice_saved') });
      setMessage('');
      setSelectedFiles(new Set());
      await loadChanges();
      await refreshProject();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'changes_notice_save_failed')
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleShowInFolder() {
    if (!project?.path || !selectedItem) return;

    setFileActionBusy(true);
    try {
      await unwrapResult(getBridge().openInFileManager(`${project.path}/${selectedItem.path}`));
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'changes_notice_open_in_folder_failed')
      });
    } finally {
      setFileActionBusy(false);
    }
  }

  async function handleStopTracking() {
    if (!project?.path || !selectedItem) return;

    setFileActionBusy(true);
    try {
      await unwrapResult(getBridge().stopTrackingFile(project.path, selectedItem.path));
      setNotice({ type: 'success', text: t('changes_notice_stop_tracking_success', { path: selectedItem.path }) });
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        next.delete(selectedItem.path);
        return next;
      });
      await loadChanges();
      await refreshProject();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'changes_notice_stop_tracking_failed')
      });
    } finally {
      setFileActionBusy(false);
    }
  }

  async function handleDiscardAll() {
    if (!project?.path) return;

    setDiscarding(true);
    try {
      await unwrapResult(getBridge().discardAllChanges(project.path));
      setNotice({
        type: 'success',
        text: copy('已清理当前修改，并保留了恢复备份。', 'Changes discarded and a recovery backup was kept.')
      });
      setSelectedFiles(new Set());
      setDiscardDialogOpen(false);
      await loadChanges();
      await refreshProject();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'changes_notice_save_failed')
      });
    } finally {
      setDiscarding(false);
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
    <div className="page page-v2 changes-page-v2 changes-simple-page">
      <header className="simple-section-head">
        <div>
          <span className="simple-eyebrow">{copy('当前修改', 'Current Changes')}</span>
          <h1>{copy('把这次工作保存成一个节点', 'Save this work as a point')}</h1>
          <p>{copy('流程只有三步：看文件、写一句话、保存。保存后就能从时间线回到这里。', 'Three steps: review files, write one note, save. You can return here from the timeline later.')}</p>
        </div>
        <div className="header-actions-v2">
          <button className="btn btn-secondary" disabled={changes.length === 0 || discarding} onClick={() => setDiscardDialogOpen(true)}>
            <Trash2 size={18} />
            {copy('不要这些修改', 'Discard Changes')}
          </button>
        </div>
      </header>

      <section className="change-flow-strip">
        <div className="done"><span>1</span><strong>{copy('看改了什么', 'Review')}</strong></div>
        <div className={message.trim() ? 'done' : ''}><span>2</span><strong>{copy('写一句说明', 'Write note')}</strong></div>
        <div><span>3</span><strong>{copy('保存成节点', 'Save point')}</strong></div>
      </section>

      <section className="changes-layout-v2 changes-layout-simple">
        <aside className="changes-sidebar-v2">
          <div className="changes-search-row-v2">
            <label className="search-input-v2">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy('搜索文件', 'Search files')} />
            </label>
          </div>

          {loading ? (
            <p className="changes-empty-v2">{t('changes_loading')}</p>
          ) : changes.length === 0 ? (
            <div className="changes-clean-v2">
              <CheckCircle2 size={28} />
              <strong>{copy('没有待保存修改', 'Nothing to save')}</strong>
              <span>{t('changes_empty')}</span>
              <Link to="/timeline">{copy('查看保存时间线', 'Open timeline')}</Link>
            </div>
          ) : (
            <ul className="change-file-list-v2 simple-change-list">
              {filteredChanges.map((item) => (
                <li key={item.path}>
                  <button
                    type="button"
                    className={`change-file-row-v2 ${selectedItem?.path === item.path ? 'active' : ''}`}
                    onClick={() => setSelectedPath(item.path)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(item.path)}
                      aria-label={t('changes_toggle_file', { path: item.path })}
                      onChange={(event) => {
                        event.stopPropagation();
                        toggleSelection(item.path);
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <span className="change-file-icon-v2">
                      <FileText size={20} />
                    </span>
                    <span className="change-file-copy-v2">
                      <strong>{item.path}</strong>
                      <small>{statusText(item.changeType, locale)} · +{item.additions} / -{item.deletions}</small>
                    </span>
                    <span className={`status-chip-v2 ${statusTone(item.changeType)}`}>
                      {statusText(item.changeType, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="changes-detail-v2">
          <div className="change-detail-head-v2">
            <div>
              <h2>{selectedItem?.path ?? copy('选择一个文件', 'Select a file')}</h2>
              {selectedItem ? (
                <p>
                  {toChangeStatusLabel(selectedItem.changeType, t)}
                  <span>+{selectedItem.additions}</span>
                  <span>-{selectedItem.deletions}</span>
                </p>
              ) : (
                <p>{t('changes_select_file_hint')}</p>
              )}
            </div>
            {selectedItem ? (
              <div className="panel-actions-v2">
                <button className="btn btn-secondary" disabled={fileActionBusy} onClick={() => void handleShowInFolder()}>
                  <FolderOpen size={18} />
                  {copy('在文件夹里处理', 'Show in Folder')}
                </button>
                {selectedItem.changeType !== 'deleted' ? (
                  <button className="btn btn-secondary" disabled={fileActionBusy} onClick={() => void handleStopTracking()}>
                    <Settings size={18} />
                    {copy('以后不管这个文件', 'Stop Tracking')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="diff-card-v2">
            <div className="diff-columns-head-v2">
              <strong>{copy('修改前', 'Before')}</strong>
              <strong>{copy('修改后', 'After')}</strong>
            </div>
            {selectedItem ? (
              <div className="diff-lines-v2">
                {diffLines.map((line, index) => (
                  <div key={line.id} className={`diff-line-v2 ${line.type}`}>
                    <span>{index + 1}</span>
                    <code>{line.line || ' '}</code>
                  </div>
                ))}
              </div>
            ) : (
              <div className="diff-empty-v2">{t('changes_select_file_hint')}</div>
            )}
          </div>
        </main>
      </section>

      <footer className="commit-bar-v2 simple-save-bar">
        <label>
          <span>{copy('给这个保存节点起个名字', 'Name this save point')}</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('changes_message_placeholder')}
            rows={2}
          />
        </label>
        <div className="commit-actions-v2">
          <div className="commit-summary-v2">
            <span>{copy(`${changes.length} 个文件改动`, `${changes.length} changed files`)}</span>
            <strong>+{totalAdditions} / -{totalDeletions}</strong>
          </div>
          <button className="btn btn-secondary" disabled={saving || checkedCount === 0} onClick={() => void handleSave('selected')}>
            {copy(`只保存勾选的 ${checkedCount} 个`, `Save ${checkedCount} checked`)}
          </button>
          <button className="btn btn-primary project-header-primary" disabled={saving || changes.length === 0} onClick={() => void handleSave('all')}>
            <GitBranch size={18} />
            {copy('保存节点', 'Save Point')}
          </button>
        </div>
      </footer>

      {discardDialogOpen ? (
        <ConfirmDialog
          title={copy('要放弃这次还没保存的修改吗？', 'Discard unsaved changes?')}
          description={copy(
            '码迹会先保留一个安全备份，然后把项目恢复到最近一次保存节点。',
            'TapGit will keep a safety backup first, then return the project to the latest save point.'
          )}
          details={[
            copy(`将处理 ${changes.length} 个改动文件`, `${changes.length} changed files will be handled`),
            copy('完成后可以在“备份与恢复”中找回。', 'You can recover it later from Backups.')
          ]}
          cancelLabel={t('common_cancel')}
          confirmLabel={copy('放弃这些修改', 'Discard Changes')}
          confirmKind="danger"
          busy={discarding}
          onCancel={() => setDiscardDialogOpen(false)}
          onConfirm={() => void handleDiscardAll()}
        />
      ) : null}
    </div>
  );
}
