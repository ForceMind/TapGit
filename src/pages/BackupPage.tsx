import dayjs from 'dayjs';
import { Cloud, DownloadCloud, HardDrive, Monitor, MoreHorizontal, RotateCcw, Search, Settings, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useAppActions } from '../app/app-context';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toLocalizedErrorMessage, toSafetyBackupSourceLabel, useI18n } from '../i18n';
import { SafetyBackup } from '../shared/contracts';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';

function formatDateTime(timestamp: number | null) {
  if (!timestamp) {
    return '-';
  }
  return dayjs.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

function formatShortTime(timestamp: number | null, locale: string) {
  if (!timestamp) {
    return '-';
  }
  return locale === 'zh-CN'
    ? dayjs.unix(timestamp).format('今天 HH:mm')
    : dayjs.unix(timestamp).format('MMM D HH:mm');
}

export function BackupPage() {
  const { project, config, setNotice } = useAppStore();
  const { openProjectFolder, enableProtection, refreshProject } = useAppActions();
  const { locale, t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<SafetyBackup[]>([]);
  const [selectedBackupId, setSelectedBackupId] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);

  const filteredBackups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return backups;
    return backups.filter((item) => {
      return (
        item.name.toLowerCase().includes(keyword) ||
        item.lastMessage.toLowerCase().includes(keyword) ||
        toSafetyBackupSourceLabel(item.source, t).toLowerCase().includes(keyword)
      );
    });
  }, [backups, query, t]);

  const selectedBackup = useMemo(
    () => backups.find((item) => item.id === selectedBackupId) ?? filteredBackups[0] ?? null,
    [backups, filteredBackups, selectedBackupId]
  );

  async function loadBackups() {
    if (!project?.path || !project.isProtected) {
      return;
    }

    setLoading(true);
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
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBackups();
  }, [project?.path, project?.isProtected]);

  async function handleCreateBackup() {
    if (!project?.path) {
      return;
    }

    setCreating(true);
    try {
      const backup = await unwrapResult(getBridge().createSafetyBackup(project.path));
      setNotice({ type: 'success', text: copy('已创建新的安全备份。', 'Safety backup created.') });
      setBackups((current) => [backup, ...current]);
      setSelectedBackupId(backup.id);
      await refreshProject();
      await loadBackups();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'timeline_backup_notice_load_failed')
      });
    } finally {
      setCreating(false);
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
      setRestoreDialogOpen(false);
      await refreshProject();
      await loadBackups();
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
    <div className="page page-v2 backups-page-v2">
      <header className="section-header-v2">
        <div>
          <h1>{copy('备份与恢复', 'Backups & Restore')}</h1>
          <p>{copy('保护你的项目数据，随时恢复到任意时间点', 'Protect project data and restore to a safe point')}</p>
        </div>
        <div className="header-actions-v2">
          <button className="btn btn-primary project-header-primary" disabled={creating} onClick={() => void handleCreateBackup()}>
            <DownloadCloud size={18} />
            {copy('立即备份', 'Back Up Now')}
          </button>
          <button className="btn btn-secondary" disabled>
            <Settings size={18} />
            {copy('备份设置', 'Backup Settings')}
          </button>
        </div>
      </header>

      <div className="simple-tabs-v2">
        <button className="active">{copy('备份管理', 'Backups')}</button>
        <button>{copy('恢复项目', 'Restore')}</button>
      </div>

      <section className="backup-stats-v2">
        <article>
          <span className="stat-icon-v2 size">
            <Monitor size={22} />
          </span>
          <div>
            <small>{copy('本地备份', 'Local Backups')}</small>
            <strong>{backups.length}</strong>
            <span>{copy('安全恢复点', 'safe restore points')}</span>
          </div>
        </article>
        <article>
          <span className="stat-icon-v2">
            <Cloud size={22} />
          </span>
          <div>
            <small>{copy('云端备份', 'Cloud Backups')}</small>
            <strong>0</strong>
            <span>{copy('稍后接入', 'coming later')}</span>
          </div>
        </article>
        <article>
          <span className="stat-icon-v2 last">
            <RotateCcw size={22} />
          </span>
          <div>
            <small>{copy('最新备份', 'Latest Backup')}</small>
            <strong>{formatShortTime(backups[0]?.createdAt ?? null, locale)}</strong>
            <span>{backups[0]?.lastMessage || project.name}</span>
          </div>
        </article>
        <article>
          <span className="stat-icon-v2 warning">
            <ShieldCheck size={22} />
          </span>
          <div>
            <small>{copy('自动备份', 'Auto Backup')}</small>
            <strong>{config?.settings.autoSnapshotBeforeRestore ? copy('已开启', 'On') : copy('未开启', 'Off')}</strong>
            <span>{copy('恢复和合并前保护', 'before restore and merge')}</span>
          </div>
        </article>
      </section>

      <section className="backup-table-panel-v2">
        <header>
          <h2>{copy('备份列表', 'Backup List')}</h2>
          <div className="backup-table-tools-v2">
            <label className="search-input-v2">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy('搜索备份...', 'Search backups...')}
              />
            </label>
            <button className="btn btn-secondary">{copy('全部类型', 'All Types')}</button>
          </div>
        </header>

        <div className="backup-table-v2">
          <div className="backup-table-head-v2">
            <span>{copy('备份名称', 'Name')}</span>
            <span>{copy('项目', 'Project')}</span>
            <span>{copy('类型', 'Type')}</span>
            <span>{copy('时间', 'Time')}</span>
            <span>{copy('位置', 'Location')}</span>
            <span>{copy('操作', 'Action')}</span>
          </div>

          {loading ? (
            <div className="backup-empty-v2">{t('timeline_backups_loading')}</div>
          ) : filteredBackups.length === 0 ? (
            <div className="backup-empty-v2">{t('timeline_backups_empty')}</div>
          ) : (
            filteredBackups.map((backup) => (
              <div
                key={backup.id}
                role="button"
                tabIndex={0}
                className={`backup-row-v2 ${selectedBackup?.id === backup.id ? 'active' : ''}`}
                onClick={() => setSelectedBackupId(backup.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedBackupId(backup.id);
                  }
                }}
              >
                <span className="backup-name-v2">
                  <HardDrive size={19} />
                  {backup.lastMessage || backup.name}
                </span>
                <span>{project.name}</span>
                <span className="backup-type-v2">{toSafetyBackupSourceLabel(backup.source, t)}</span>
                <span>{formatShortTime(backup.createdAt, locale)}</span>
                <span>{copy('本地', 'Local')}</span>
                <span className="backup-actions-inline-v2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedBackupId(backup.id);
                      setRestoreDialogOpen(true);
                    }}
                  >
                    {copy('恢复', 'Restore')}
                  </button>
                  <MoreHorizontal size={18} />
                </span>
              </div>
            ))
          )}
        </div>

        <footer className="backup-storage-v2">
          <div>
            <strong>{copy('备份存储使用情况', 'Backup Storage Usage')}</strong>
            <span>{copy(`${backups.length} 个本地恢复点`, `${backups.length} local restore points`)}</span>
          </div>
          <div className="backup-progress-v2">
            <span style={{ width: `${Math.min(100, backups.length * 8)}%` }} />
          </div>
          <strong>{Math.min(100, backups.length * 8)}%</strong>
        </footer>
      </section>

      {restoreDialogOpen && selectedBackup ? (
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
          onCancel={() => setRestoreDialogOpen(false)}
          onConfirm={() => void handleRestoreBackup()}
        />
      ) : null}
    </div>
  );
}
