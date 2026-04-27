import dayjs from 'dayjs';
import { FileText, Filter, FolderOpen, GitBranch, Plus, Search, Settings, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useAppActions } from '../app/app-context';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toChangeStatusLabel, toLocalizedDiffText, toLocalizedErrorMessage, useI18n } from '../i18n';
import { ChangeItem } from '../shared/contracts';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';

function statusBadge(status: ChangeItem['changeType']) {
  if (status === 'added') return 'A';
  if (status === 'deleted') return 'D';
  if (status === 'renamed') return 'R';
  return 'M';
}

function statusTone(status: ChangeItem['changeType']) {
  if (status === 'added') return 'added';
  if (status === 'deleted') return 'deleted';
  if (status === 'renamed') return 'renamed';
  return 'modified';
}

function splitDiffLines(diffText: string) {
  const lines = diffText.split(/\r?\n/);
  return lines.slice(0, 220).map((line, index) => {
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

  const worktreeChanges = useMemo(
    () => filteredChanges.filter((item) => item.area !== 'ready'),
    [filteredChanges]
  );
  const readyChanges = useMemo(
    () => filteredChanges.filter((item) => item.area === 'ready'),
    [filteredChanges]
  );

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
    const finalMessage =
      message.trim() || config?.settings.defaultSaveMessageTemplate.trim() || autoMessage;

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
    if (!project?.path || !selectedItem) {
      return;
    }

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
    if (!project?.path || !selectedItem) {
      return;
    }

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
    if (!project?.path) {
      return;
    }

    setDiscarding(true);
    try {
      await unwrapResult(getBridge().discardAllChanges(project.path));
      setNotice({
        type: 'success',
        text: copy('已清理当前变更，并保留了恢复备份。', 'Changes discarded and a recovery backup was kept.')
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

  function renderChangeGroup(title: string, items: ChangeItem[]) {
    return (
      <section className="changes-group-v2">
        <h3>
          {title}
          <span>{items.length}</span>
        </h3>
        {items.length === 0 ? (
          <p className="changes-empty-v2">
            {copy('这里暂时没有文件。', 'No files here yet.')}
          </p>
        ) : (
          <ul className="change-file-list-v2">
            {items.map((item) => (
              <li key={item.path}>
                <button
                  type="button"
                  className={`change-file-row-v2 ${selectedItem?.path === item.path ? 'active' : ''}`}
                  onClick={() => setSelectedPath(item.path)}
                >
                  <span className="change-file-icon-v2">
                    <FileText size={20} />
                  </span>
                  <span className="change-file-copy-v2">
                    <strong>{item.path}</strong>
                    <small>
                      +{item.additions} / -{item.deletions}
                    </small>
                  </span>
                  <span className={`status-chip-v2 ${statusTone(item.changeType)}`}>
                    {statusBadge(item.changeType)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="page page-v2 changes-page-v2">
      <header className="section-header-v2">
        <div>
          <h1>{copy('变更', 'Changes')}</h1>
          <p>{copy('查看并管理你的代码变更', 'Review and manage your code changes')}</p>
        </div>
        <div className="header-actions-v2">
          <button
            className="btn btn-secondary"
            disabled={changes.length === 0 || discarding}
            onClick={() => setDiscardDialogOpen(true)}
          >
            <Trash2 size={18} />
            {copy('丢弃所有变更', 'Discard All Changes')}
          </button>
          <button className="btn btn-primary project-header-primary" disabled={saving} onClick={() => void handleSave('all')}>
            <GitBranch size={18} />
            {copy(`提交到 ${project.currentPlan}`, `Save to ${project.currentPlan}`)}
          </button>
        </div>
      </header>

      <div className="changes-tabs-v2">
        <button className="active">
          {copy('工作区变更', 'Work Area Changes')}
          <span>{worktreeChanges.length}</span>
        </button>
        <button>
          {copy('暂存区变更', 'Ready to Save')}
          <span>{readyChanges.length}</span>
        </button>
      </div>

      <section className="changes-layout-v2">
        <aside className="changes-sidebar-v2">
          <div className="changes-search-row-v2">
            <label className="search-input-v2">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy('搜索文件...', 'Search files...')}
              />
            </label>
            <button className="icon-button-v2" type="button" aria-label={copy('筛选', 'Filter')}>
              <Filter size={18} />
            </button>
          </div>

          {loading ? (
            <p className="changes-empty-v2">{t('changes_loading')}</p>
          ) : changes.length === 0 ? (
            <div className="changes-clean-v2">
              <strong>{copy('工作区很干净', 'Everything is clean')}</strong>
              <span>{t('changes_empty')}</span>
            </div>
          ) : (
            <>
              {renderChangeGroup(copy('未暂存的文件', 'Not Ready Yet'), worktreeChanges)}
              {renderChangeGroup(copy('已暂存的文件', 'Ready Files'), readyChanges)}
            </>
          )}

          <div className="drop-card-v2">
            <Plus size={18} />
            <span>{copy('拖拽文件到这里以快速查看，或点击打开文件夹处理删除。', 'Drop files here to review, or open the folder to delete files.')}</span>
          </div>
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
                  {t('changes_delete_in_folder')}
                </button>
                {selectedItem.changeType !== 'deleted' ? (
                  <button className="btn btn-secondary" disabled={fileActionBusy} onClick={() => void handleStopTracking()}>
                    <Settings size={18} />
                    {t('changes_stop_tracking')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="diff-toolbar-v2">
            <span>{copy('查看', 'View')}</span>
            <button className="active">{copy('并排', 'Split')}</button>
            <button>{copy('内联', 'Inline')}</button>
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

      <footer className="commit-bar-v2">
        <label>
          <span>{copy('提交信息', 'Save Note')}</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('changes_message_placeholder')}
            rows={2}
          />
        </label>
        <div className="commit-actions-v2">
          <button className="btn btn-secondary ai-disabled-v2" disabled>
            {copy('AI 生成提交信息', 'AI Draft Note')}
          </button>
          <div className="commit-summary-v2">
            <span>{copy(`${changes.length} 个文件变更`, `${changes.length} changed files`)}</span>
            <strong>+{totalAdditions} / -{totalDeletions}</strong>
          </div>
          <button
            className="btn btn-secondary"
            disabled={saving || checkedCount === 0}
            onClick={() => void handleSave('selected')}
          >
            {copy(`只提交选中的 ${checkedCount} 个`, `Save ${checkedCount} checked`)}
          </button>
          <button className="btn btn-primary project-header-primary" disabled={saving || changes.length === 0} onClick={() => void handleSave('all')}>
            <GitBranch size={18} />
            {copy(`提交到 ${project.currentPlan}`, `Save to ${project.currentPlan}`)}
          </button>
        </div>
      </footer>

      {selectedItem ? (
        <div className="floating-selection-v2">
          <label>
            <input
              type="checkbox"
              checked={selectedFiles.has(selectedItem.path)}
              aria-label={t('changes_toggle_file', { path: selectedItem.path })}
              onChange={() => toggleSelection(selectedItem.path)}
            />
            <span>{copy('勾选当前文件用于部分提交', 'Check this file for a partial save')}</span>
          </label>
        </div>
      ) : null}

      {discardDialogOpen ? (
        <ConfirmDialog
          title={copy('要丢弃所有当前变更吗？', 'Discard all current changes?')}
          description={copy(
            '码迹会先为当前内容保留一个安全备份，然后把工作区恢复到最近一次保存。',
            'TapGit will keep a safety backup first, then return the work area to the latest save.'
          )}
          details={[
            copy(`将处理 ${changes.length} 个变更文件`, `${changes.length} changed files will be handled`),
            copy('完成后可在“备份与恢复”中找回。', 'You can recover it later from Backups.')
          ]}
          cancelLabel={t('common_cancel')}
          confirmLabel={copy('确认丢弃', 'Discard Changes')}
          confirmKind="danger"
          busy={discarding}
          onCancel={() => setDiscardDialogOpen(false)}
          onConfirm={() => void handleDiscardAll()}
        />
      ) : null}
    </div>
  );
}
