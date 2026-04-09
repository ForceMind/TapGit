import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { toLocalizedErrorMessage, toPlanLabel, useI18n } from '../i18n';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';

export function HomePage() {
  const { project, config, setConfig, setNotice } = useAppStore();
  const { openProjectFolder, openProjectByPath } = useAppActions();
  const { t } = useI18n();

  async function hideBeginnerGuide() {
    try {
      const settings = await unwrapResult(getBridge().updateSettings({ showBeginnerGuide: false }));
      if (config) {
        setConfig({ ...config, settings });
      }
      setNotice({ type: 'success', text: t('home_notice_hide_guide_success') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'home_notice_update_settings_failed')
      });
    }
  }

  return (
    <div className="page">
      <div className="hero-card">
        <div>
          <h1>{t('home_title')}</h1>
          <p>{t('home_subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => void openProjectFolder()}>
          {t('home_open_folder')}
        </button>
      </div>

      {config?.settings.showBeginnerGuide ? (
        <section className="panel guide-card">
          <div className="section-head">
            <h2>{t('home_guide_title')}</h2>
            <button className="btn btn-secondary" onClick={() => void hideBeginnerGuide()}>
              {t('home_guide_close')}
            </button>
          </div>
          <div className="guide-grid">
            <div className="guide-step">
              <span className="guide-index">1</span>
              <div>
                <strong>{t('home_guide_step1_title')}</strong>
                <p>{t('home_guide_step1_desc')}</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-index">2</span>
              <div>
                <strong>{t('home_guide_step2_title')}</strong>
                <p>{t('home_guide_step2_desc')}</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-index">3</span>
              <div>
                <strong>{t('home_guide_step3_title')}</strong>
                <p>{t('home_guide_step3_desc')}</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-index">4</span>
              <div>
                <strong>{t('home_guide_step4_title')}</strong>
                <p>{t('home_guide_step4_desc')}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid-two">
        <section className="panel">
          <h2>{t('home_recent_projects')}</h2>
          {!config || config.recentProjects.length === 0 ? (
            <p className="muted">{t('home_recent_projects_empty')}</p>
          ) : (
            <ul className="list">
              {config.recentProjects.map((item) => (
                <li key={item} className="list-item">
                  <div>
                    <div className="item-title">{item.split(/[\\/]/).pop()}</div>
                    <div className="item-subtle">{item}</div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => void openProjectByPath(item)}>
                    {t('home_open')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>{t('home_project_status')}</h2>
          {!project ? (
            <p className="muted">{t('home_project_status_empty')}</p>
          ) : (
            <div className="status-stack">
              <div>
                <span className="status-label">{t('home_label_project')}</span>
                <strong>{project.name}</strong>
              </div>
              <div>
                <span className="status-label">{t('home_label_current_plan')}</span>
                <strong>
                  {toPlanLabel(
                    project.currentPlan,
                    project.currentPlan === 'main' || project.currentPlan === 'master',
                    t
                  )}
                </strong>
              </div>
              <div>
                <span className="status-label">{t('home_label_unsaved_changes')}</span>
                <strong>{t('common_file_unit', { count: project.pendingChangeCount })}</strong>
              </div>
              <div className="quick-actions">
                <Link className="btn btn-secondary" to="/changes">
                  {t('home_action_view_changes')}
                </Link>
                <Link className="btn btn-secondary" to="/timeline">
                  {t('home_action_view_timeline')}
                </Link>
                <Link className="btn btn-secondary" to="/plans">
                  {t('home_action_manage_plans')}
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
