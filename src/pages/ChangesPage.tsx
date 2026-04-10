import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useAppActions } from '../app/app-context';
import { toChangeStatusLabel, toLocalizedDiffText, toLocalizedErrorMessage, useI18n } from '../i18n';
import { ChangeItem } from '../shared/contracts';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';

export function ChangesPage() {
  const { project, config, setNotice } = useAppStore();
  const { openProjectFolder, enableProtection, refreshProject } = useAppActions();
  const { locale, t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const checkedCount = selectedFiles.size;
  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);

  const selectedItem = useMemo(
    () => changes.find((item) => item.path === selectedPath) ?? changes[0] ?? null,
    [changes, selectedPath]
  );

  const currentStateLabel = loading
    ? copy('\u6b63\u5728\u8bfb\u53d6', 'Loading')
    : changes.length === 0
      ? copy('\u6682\u65f6\u5f88\u5e72\u51c0', 'Nothing to save')
      : checkedCount > 0
        ? copy('\u53ef\u4ee5\u90e8\u5206\u4fdd\u5b58', 'Ready for partial save')
        : copy('\u53ef\u4ee5\u5168\u90e8\u4fdd\u5b58', 'Ready to save all');

  async function loadChanges() {
    if (!project?.path || !project.isProtected) {
      return;
    }

    setLoading(true);
    try {
      const data = await unwrapResult(getBridge().getCurrentChanges(project.path));
      setChanges(data);
      setSelectedPath(data[0]?.path ?? '');
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

  if (!project) {
    return (
      <div className="page">
        <section className="panel">
          <h2>{copy('\u5f53\u524d\u4fee\u6539', 'Current Changes')}</h2>
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
          <h2>{copy('\u5f53\u524d\u4fee\u6539', 'Current Changes')}</h2>
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
      <section className="panel changes-hero">
        <div className="changes-hero-copy">
          <span className="pill">{copy('\u5f53\u524d\u5de5\u4f5c\u533a', 'Current Work')}</span>
          <h1>{copy('\u4fee\u6539', 'Changes')}</h1>
          <p>
            {copy(
              '\u5148\u770b\u8fd9\u6b21\u6539\u4e86\u4ec0\u4e48\uff0c\u518d\u5199\u4e00\u53e5\u8bf4\u660e\u628a\u8fd9\u6279\u8fdb\u5ea6\u4fdd\u5b58\u4e0b\u6765\u3002',
              'Review what changed, then save this batch with one short note.'
            )}
          </p>
        </div>
        <div className="changes-hero-metrics">
          <article className="changes-metric-card">
            <span>{copy('\u5df2\u6539\u6587\u4ef6', 'Changed files')}</span>
            <strong>{loading ? copy('\u68c0\u67e5\u4e2d', 'Checking') : changes.length}</strong>
          </article>
          <article className="changes-metric-card">
            <span>{copy('\u5df2\u52fe\u9009', 'Checked')}</span>
            <strong>{checkedCount}</strong>
          </article>
          <article className="changes-metric-card">
            <span>{copy('\u5f53\u524d\u72b6\u6001', 'Current state')}</span>
            <strong>{currentStateLabel}</strong>
          </article>
        </div>
      </section>

      <section className="panel split-panel">
        <div className="list-panel">
          <div className="section-head">
            <h2>{copy('\u5df2\u6539\u6587\u4ef6', 'Changed Files')}</h2>
            <span className="pill">{t('common_file_unit', { count: changes.length })}</span>
          </div>

          {loading ? (
            <p className="muted">{t('changes_loading')}</p>
          ) : changes.length === 0 ? (
            <p className="muted">{t('changes_empty')}</p>
          ) : (
            <ul className="list">
              {changes.map((item) => {
                const statusLabel = toChangeStatusLabel(item.changeType, t);

                return (
                  <li
                    key={item.path}
                    className={`list-item ${selectedItem?.path === item.path ? 'active' : ''}`}
                    onClick={() => setSelectedPath(item.path)}
                  >
                    <label className="check-wrap">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(item.path)}
                        aria-label={t('changes_toggle_file', { path: item.path })}
                        onChange={() => toggleSelection(item.path)}
                        onClick={(event) => event.stopPropagation()}
                      />
                      <span />
                    </label>
                    <div className="flex-grow">
                      <div className="item-title">{item.path}</div>
                      <div className="item-subtle">
                        {statusLabel} | +{item.additions} -{item.deletions}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="detail-panel">
          <div className="section-head">
            <h2>{copy('\u9884\u89c8', 'Preview')}</h2>
            {selectedItem ? (
              <span className="pill">{toChangeStatusLabel(selectedItem.changeType, t)}</span>
            ) : null}
          </div>
          {!selectedItem ? (
            <p className="muted">{t('changes_select_file_hint')}</p>
          ) : (
            <div className="diff-view">
              <div className="diff-path">{selectedItem.path}</div>
              <pre>{toLocalizedDiffText(selectedItem.diffText, t)}</pre>
            </div>
          )}
        </div>
      </section>

      <section className="panel save-panel">
        <div className="section-head">
          <div>
            <h3>{copy('\u4fdd\u5b58\u8fd9\u6b21\u5de5\u4f5c', 'Save This Work')}</h3>
            <p className="panel-subtitle">
              {copy(
                '\u5982\u679c\u8fd9\u6279\u4fee\u6539\u662f\u4e00\u4ef6\u4e8b\uff0c\u5c31\u76f4\u63a5\u5168\u90e8\u4fdd\u5b58\uff1b\u5982\u679c\u4e0d\u662f\uff0c\u5c31\u53ea\u4fdd\u5b58\u52fe\u9009\u5185\u5bb9\u3002',
                'Save everything if this batch belongs together, or save only the checked files.'
              )}
            </p>
          </div>
          <span className="pill">{t('changes_selected_count', { count: checkedCount })}</span>
        </div>
        <textarea
          className="input-textarea"
          placeholder={t('changes_message_placeholder')}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
        />
        <div className="actions-row">
          <button
            className="btn btn-secondary"
            disabled={saving || checkedCount === 0}
            onClick={() => void handleSave('selected')}
          >
            {t('changes_save_selected')}
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={() => void handleSave('all')}>
            {t('changes_save_all')}
          </button>
        </div>
        <p className="muted">
          {checkedCount === 0
            ? t('changes_partial_hint_none')
            : t('changes_partial_hint_some', { count: checkedCount })}
        </p>
      </section>
    </div>
  );
}
