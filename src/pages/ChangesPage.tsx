import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useAppActions } from '../app/app-context';
import { toChangeStatusLabel, toLocalizedDiffText, toLocalizedErrorMessage, useI18n } from '../i18n';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';
import { ChangeItem } from '../shared/contracts';

export function ChangesPage() {
  const { project, config, setNotice } = useAppStore();
  const { openProjectFolder, enableProtection, refreshProject } = useAppActions();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const checkedCount = selectedFiles.size;

  const selectedItem = useMemo(
    () => changes.find((item) => item.path === selectedPath) ?? changes[0],
    [changes, selectedPath]
  );

  async function loadChanges() {
    if (!project?.path || !project.isProtected) return;
    setLoading(true);
    try {
      const data = await unwrapResult(getBridge().getCurrentChanges(project.path));
      setChanges(data);
      if (data.length > 0) {
        setSelectedPath(data[0].path);
      } else {
        setSelectedPath('');
      }
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
    if (!project?.path) return;
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
          <h2>{t('changes_title')}</h2>
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
          <h2>{t('changes_title')}</h2>
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
      <section className="panel guide-card">
        <div className="section-head">
          <div>
            <h2>{t('changes_guide_title')}</h2>
            <p className="panel-subtitle">{t('changes_guide_desc')}</p>
          </div>
        </div>
        <div className="guide-grid">
          <div className="guide-step">
            <span className="guide-index">1</span>
            <div>
              <strong>{t('changes_guide_step1_title')}</strong>
              <p>{t('changes_guide_step1_desc')}</p>
            </div>
          </div>
          <div className="guide-step">
            <span className="guide-index">2</span>
            <div>
              <strong>{t('changes_guide_step2_title')}</strong>
              <p>{t('changes_guide_step2_desc')}</p>
            </div>
          </div>
          <div className="guide-step">
            <span className="guide-index">3</span>
            <div>
              <strong>{t('changes_guide_step3_title')}</strong>
              <p>{t('changes_guide_step3_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel split-panel">
        <div className="list-panel">
          <div className="section-head">
            <h2>{t('changes_change_list')}</h2>
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
            <h2>{t('changes_detail')}</h2>
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
            <h3>{t('changes_save_progress')}</h3>
            <p className="panel-subtitle">{t('changes_save_help')}</p>
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
