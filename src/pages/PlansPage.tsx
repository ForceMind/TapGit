import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { toLocalizedConflictContent, toLocalizedErrorMessage, toPlanLabel, useI18n } from '../i18n';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';
import { MergeResult, PlanInfo } from '../shared/contracts';

function mapPlanLabel(plan: PlanInfo, t: ReturnType<typeof useI18n>['t']) {
  return toPlanLabel(plan.name, plan.isMain, t);
}

export function PlansPage() {
  const { project, setNotice } = useAppStore();
  const { openProjectFolder, enableProtection, refreshProject } = useAppActions();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [newPlanName, setNewPlanName] = useState('');
  const [working, setWorking] = useState(false);
  const [mergeFrom, setMergeFrom] = useState('');
  const [mergeState, setMergeState] = useState<MergeResult | null>(null);
  const [selectedConflictFile, setSelectedConflictFile] = useState('');
  const [manualContent, setManualContent] = useState('');

  const stablePlan = useMemo(
    () => plans.find((item) => item.isMain) ?? plans.find((item) => item.name === 'main' || item.name === 'master'),
    [plans]
  );

  const ideaPlans = useMemo(() => plans.filter((item) => !item.isMain), [plans]);
  const currentPlan = useMemo(() => plans.find((item) => item.isCurrent) ?? null, [plans]);
  const needsFirstSave = (historyCount ?? 0) === 0;
  const hasUnsavedChanges = (project?.pendingChangeCount ?? 0) > 0;
  const ideasLocked = needsFirstSave || hasUnsavedChanges;

  const selectedConflict = useMemo(
    () => mergeState?.conflicts.find((item) => item.filePath === selectedConflictFile) ?? mergeState?.conflicts[0],
    [mergeState, selectedConflictFile]
  );

  const selectedConflictIndex = useMemo(() => {
    if (!mergeState?.conflicts.length || !selectedConflict) {
      return 0;
    }
    return Math.max(
      0,
      mergeState.conflicts.findIndex((item) => item.filePath === selectedConflict.filePath)
    );
  }, [mergeState, selectedConflict]);

  const conflictProgress = useMemo(() => {
    if (!mergeState?.conflicts.length) {
      return 0;
    }
    return ((selectedConflictIndex + 1) / mergeState.conflicts.length) * 100;
  }, [mergeState, selectedConflictIndex]);

  function pickNextConflictFile(conflicts: MergeResult['conflicts'], previousFile: string) {
    if (conflicts.length === 0) return '';
    const sameFile = conflicts.find((item) => item.filePath === previousFile);
    if (sameFile) return sameFile.filePath;

    const previousIndex = mergeState?.conflicts.findIndex((item) => item.filePath === previousFile) ?? -1;
    if (previousIndex >= 0) {
      return conflicts[Math.min(previousIndex, conflicts.length - 1)]?.filePath ?? conflicts[0].filePath;
    }
    return conflicts[0].filePath;
  }

  function applyMergeResult(result: MergeResult, preferredFile = '') {
    setMergeState(result);
    if (result.status === 'needs_decision') {
      const nextFile = pickNextConflictFile(result.conflicts, preferredFile);
      const nextConflict = result.conflicts.find((item) => item.filePath === nextFile) ?? result.conflicts[0];
      setSelectedConflictFile(nextConflict?.filePath ?? '');
      setManualContent(nextConflict?.currentContent ?? '');
      return;
    }

    setSelectedConflictFile('');
    setManualContent('');
  }

  async function loadPlans() {
    if (!project?.path || !project.isProtected) return;
    setLoading(true);
    try {
      const [plansData, historyData] = await Promise.all([
        unwrapResult(getBridge().listPlans(project.path)),
        unwrapResult(getBridge().listHistory(project.path))
      ]);
      setPlans(plansData);
      setHistoryCount(historyData.length);

      const mainTarget = plansData.find((item) => item.isMain)?.name ?? '';
      const firstIdea = plansData.find((item) => !item.isMain)?.name ?? '';
      setMergeFrom((current) => {
        if (plansData.find((item) => item.name === current && !item.isMain)) {
          return current;
        }
        return firstIdea || current || '';
      });
      if (!mainTarget && !firstIdea) {
        setMergeFrom('');
      }
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'plans_notice_load_failed')
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, [project?.path, project?.isProtected]);

  async function handleCreatePlan() {
    if (!project?.path || !newPlanName.trim() || ideasLocked) return;
    setWorking(true);
    try {
      await unwrapResult(
        getBridge().createPlan(project.path, newPlanName.trim(), currentPlan?.name ?? stablePlan?.name)
      );
      setNotice({ type: 'success', text: t('plans_notice_created', { name: newPlanName.trim() }) });
      setNewPlanName('');
      await refreshProject();
      await loadPlans();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'plans_notice_create_failed')
      });
    } finally {
      setWorking(false);
    }
  }

  async function handleSwitchPlan(planName: string) {
    if (!project?.path || !planName || ideasLocked) return;
    setWorking(true);
    try {
      await unwrapResult(getBridge().switchPlan(project.path, planName));
      setNotice({ type: 'success', text: t('plans_notice_switched', { name: planName }) });
      await refreshProject();
      await loadPlans();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'plans_notice_switch_failed')
      });
    } finally {
      setWorking(false);
    }
  }

  async function handleMerge() {
    if (!project?.path || !stablePlan?.name || !mergeFrom || ideasLocked) return;
    setWorking(true);
    try {
      const result = await unwrapResult(getBridge().mergePlan(project.path, mergeFrom, stablePlan.name));
      if (result.status === 'merged') {
        setNotice({ type: 'success', text: t('plans_notice_merged') });
        applyMergeResult(result);
      } else {
        setNotice({ type: 'info', text: t('plans_notice_need_decision') });
        applyMergeResult(result, result.conflicts[0]?.filePath ?? '');
      }
      await refreshProject();
      await loadPlans();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'plans_notice_merge_failed')
      });
    } finally {
      setWorking(false);
    }
  }

  async function handleResolve(strategy: 'keepCurrent' | 'keepIncoming' | 'manual') {
    if (!project?.path || !selectedConflict) return;
    setWorking(true);
    try {
      const result = await unwrapResult(
        getBridge().resolveCollision(
          project.path,
          selectedConflict.filePath,
          strategy,
          strategy === 'manual' ? manualContent : undefined
        )
      );
      if (result.status === 'needs_decision') {
        applyMergeResult(result, selectedConflict.filePath);
        setNotice({
          type: 'info',
          text: t('plans_notice_remaining_conflicts', { count: result.conflicts.length })
        });
      } else {
        applyMergeResult(result);
        setNotice({ type: 'info', text: t('plans_notice_conflicts_resolved') });
      }
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'plans_notice_resolve_failed')
      });
    } finally {
      setWorking(false);
    }
  }

  async function handleResolveAll(strategy: 'keepCurrent' | 'keepIncoming') {
    if (!project?.path || !mergeState?.conflicts.length) return;

    setWorking(true);
    try {
      let latestResult: MergeResult = mergeState;
      const files = mergeState.conflicts.map((item) => item.filePath);

      for (const filePath of files) {
        latestResult = await unwrapResult(getBridge().resolveCollision(project.path, filePath, strategy));
        if (latestResult.status === 'merged') {
          break;
        }
      }

      applyMergeResult(latestResult);
      if (latestResult.status === 'needs_decision') {
        setNotice({
          type: 'info',
          text: t('plans_notice_remaining_conflicts', { count: latestResult.conflicts.length })
        });
      } else {
        setNotice({ type: 'info', text: t('plans_notice_conflicts_resolved') });
      }
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'plans_notice_resolve_failed')
      });
    } finally {
      setWorking(false);
    }
  }

  async function handleCompleteMerge() {
    if (!project?.path || !stablePlan?.name) return;
    setWorking(true);
    try {
      await unwrapResult(
        getBridge().completeMerge(
          project.path,
          t('plans_merge_commit_message', { from: mergeFrom, to: stablePlan.name })
        )
      );
      setMergeState(null);
      setNotice({ type: 'success', text: t('plans_notice_complete_saved') });
      await refreshProject();
      await loadPlans();
    } catch (error) {
      setNotice({
        type: 'error',
        text: toLocalizedErrorMessage(error, t, 'plans_notice_complete_failed')
      });
    } finally {
      setWorking(false);
    }
  }

  if (!project) {
    return (
      <div className="page">
        <section className="panel">
          <h2>{t('plans_title')}</h2>
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
          <h2>{t('plans_title')}</h2>
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
            <h2>{t('plans_intro_title')}</h2>
            <p className="panel-subtitle">{t('plans_intro_desc')}</p>
          </div>
        </div>
        <div className="guide-grid">
          <div className="guide-step">
            <span className="guide-index">1</span>
            <div>
              <strong>{t('plans_intro_point_1_title')}</strong>
              <p>{t('plans_intro_point_1_desc')}</p>
            </div>
          </div>
          <div className="guide-step">
            <span className="guide-index">2</span>
            <div>
              <strong>{t('plans_intro_point_2_title')}</strong>
              <p>{t('plans_intro_point_2_desc')}</p>
            </div>
          </div>
          <div className="guide-step">
            <span className="guide-index">3</span>
            <div>
              <strong>{t('plans_intro_point_3_title')}</strong>
              <p>{t('plans_intro_point_3_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>{t('plans_ready_title')}</h2>
            <p className="panel-subtitle">{t('plans_ready_desc')}</p>
          </div>
        </div>
        {needsFirstSave ? (
          <div className="cloud-auth-callout">
            <h3>{t('plans_ready_no_history_title')}</h3>
            <p>{t('plans_ready_no_history_desc')}</p>
            <div className="actions-row">
              <Link className="btn btn-primary" to="/changes">
                {t('plans_ready_go_changes')}
              </Link>
            </div>
          </div>
        ) : hasUnsavedChanges ? (
          <div className="cloud-auth-callout">
            <h3>{t('plans_ready_unsaved_title')}</h3>
            <p>{t('plans_ready_unsaved_desc')}</p>
            <div className="actions-row">
              <Link className="btn btn-primary" to="/changes">
                {t('plans_ready_go_changes')}
              </Link>
            </div>
          </div>
        ) : (
          <p className="success-text">{t('plans_ready_desc')}</p>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>{t('plans_create_title')}</h2>
            <p className="panel-subtitle">{t('plans_create_help')}</p>
          </div>
        </div>
        <p className="muted">
          <strong>{t('plans_create_from_label')}</strong>{' '}
          {currentPlan ? mapPlanLabel(currentPlan, t) : mapPlanLabel(stablePlan ?? { id: '', name: 'main', isCurrent: false, isMain: true, lastSavedAt: null, lastMessage: '' }, t)}
        </p>
        <div className="field-row">
          <input
            className="input-text"
            value={newPlanName}
            placeholder={t('plans_create_placeholder')}
            onChange={(event) => setNewPlanName(event.target.value)}
          />
          <button className="btn btn-primary" disabled={working || ideasLocked} onClick={() => void handleCreatePlan()}>
            {t('plans_create_button')}
          </button>
        </div>
      </section>

      <div className="grid-two">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>{t('plans_current_stable_title')}</h2>
              <p className="panel-subtitle">{t('plans_current_stable_desc')}</p>
            </div>
          </div>
          {stablePlan ? (
            <div className="detail-stack">
              <div className="item-title">
                {mapPlanLabel(stablePlan, t)}
                <span className="tag tag-main">{t('plans_tag_main')}</span>
                {stablePlan.isCurrent ? <span className="tag">{t('plans_here_now')}</span> : null}
              </div>
              <div className="item-subtle">{stablePlan.lastMessage || t('plans_no_saved_record')}</div>
              {!stablePlan.isCurrent ? (
                <div className="actions-row">
                  <button
                    className="btn btn-secondary"
                    disabled={working || ideasLocked}
                    onClick={() => void handleSwitchPlan(stablePlan.name)}
                  >
                    {t('plans_switch_button')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted">{t('plans_no_saved_record')}</p>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>{t('plans_ideas_title')}</h2>
              <p className="panel-subtitle">{t('plans_ideas_desc')}</p>
            </div>
            <span className="pill">{t('common_record_unit', { count: ideaPlans.length })}</span>
          </div>
          {loading ? (
            <p className="muted">{t('plans_loading')}</p>
          ) : ideaPlans.length === 0 ? (
            <p className="muted">{t('plans_ideas_empty')}</p>
          ) : (
            <ul className="list">
              {ideaPlans.map((plan) => (
                <li key={plan.id} className={`list-item ${plan.isCurrent ? 'active' : ''}`}>
                  <div className="flex-grow">
                    <div className="item-title">
                      {mapPlanLabel(plan, t)}
                      {plan.isCurrent ? <span className="tag">{t('plans_here_now')}</span> : null}
                    </div>
                    <div className="item-subtle">{plan.lastMessage || t('plans_no_saved_record')}</div>
                  </div>
                  {!plan.isCurrent ? (
                    <button
                      className="btn btn-secondary"
                      disabled={working || ideasLocked}
                      onClick={() => void handleSwitchPlan(plan.name)}
                    >
                      {t('plans_switch_button')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>{t('plans_back_title')}</h2>
            <p className="panel-subtitle">{t('plans_back_desc')}</p>
          </div>
        </div>
        {ideaPlans.length === 0 ? (
          <p className="muted">{t('plans_back_empty')}</p>
        ) : (
          <>
            <div className="field-row">
              <label>{t('plans_merge_source')}</label>
              <select className="input-select" value={mergeFrom} onChange={(event) => setMergeFrom(event.target.value)}>
                <option value="">{t('common_select')}</option>
                {ideaPlans.map((plan) => (
                  <option key={plan.name} value={plan.name}>
                    {mapPlanLabel(plan, t)}
                  </option>
                ))}
              </select>
              <label>{t('plans_back_target_label')}</label>
              <span className="pill">{stablePlan ? mapPlanLabel(stablePlan, t) : t('common_main_plan')}</span>
              <button className="btn btn-primary" disabled={working || ideasLocked || !mergeFrom} onClick={() => void handleMerge()}>
                {t('plans_merge_button')}
              </button>
            </div>
            <p className="muted">{t('plans_merge_hint')}</p>
          </>
        )}
      </section>

      {mergeState?.status === 'needs_decision' && mergeState.conflicts.length > 0 ? (
        <section className="panel">
          <div className="section-head">
            <h2>{t('plans_conflict_title')}</h2>
            <span className="pill">{t('plans_conflict_files', { count: mergeState.conflicts.length })}</span>
          </div>

          <div className="conflict-summary-card">
            <div className="section-head">
              <div>
                <h3>{t('plans_conflict_helper_title')}</h3>
                <p className="panel-subtitle">{t('plans_conflict_helper_desc')}</p>
              </div>
              <span className="tone-badge attention">
                {t('plans_conflict_progress', {
                  current: selectedConflictIndex + 1,
                  total: mergeState.conflicts.length
                })}
              </span>
            </div>
            <div className="conflict-progress-track" aria-hidden="true">
              <div className="conflict-progress-fill" style={{ width: `${conflictProgress}%` }} />
            </div>
            <div className="actions-row">
              <button
                className="btn btn-secondary"
                disabled={working}
                onClick={() => void handleResolveAll('keepCurrent')}
              >
                {t('plans_conflict_keep_all_current')}
              </button>
              <button
                className="btn btn-secondary"
                disabled={working}
                onClick={() => void handleResolveAll('keepIncoming')}
              >
                {t('plans_conflict_keep_all_incoming')}
              </button>
            </div>
          </div>

          <div className="field-row">
            <label>{t('plans_conflict_selected_file')}</label>
            <select
              className="input-select"
              value={selectedConflict?.filePath}
              onChange={(event) => {
                const next = event.target.value;
                setSelectedConflictFile(next);
                const conflict = mergeState.conflicts.find((item) => item.filePath === next);
                setManualContent(conflict?.currentContent ?? '');
              }}
            >
              {mergeState.conflicts.map((conflict) => (
                <option key={conflict.filePath} value={conflict.filePath}>
                  {conflict.filePath}
                </option>
              ))}
            </select>
          </div>

          {selectedConflict ? (
            <div className="conflict-layout">
              <div className="conflict-col">
                <h4>{t('plans_conflict_current')}</h4>
                <pre>{toLocalizedConflictContent(selectedConflict.currentContent, 'current', t)}</pre>
                <button
                  className="btn btn-secondary"
                  disabled={working}
                  onClick={() => void handleResolve('keepCurrent')}
                >
                  {t('plans_conflict_keep_current')}
                </button>
              </div>
              <div className="conflict-col">
                <h4>{t('plans_conflict_incoming')}</h4>
                <pre>{toLocalizedConflictContent(selectedConflict.incomingContent, 'incoming', t)}</pre>
                <button
                  className="btn btn-secondary"
                  disabled={working}
                  onClick={() => void handleResolve('keepIncoming')}
                >
                  {t('plans_conflict_keep_incoming')}
                </button>
              </div>
              <div className="conflict-col">
                <h4>{t('plans_conflict_manual')}</h4>
                <textarea
                  className="input-textarea"
                  value={manualContent}
                  rows={18}
                  onChange={(event) => setManualContent(event.target.value)}
                />
                <button
                  className="btn btn-secondary"
                  disabled={working}
                  onClick={() => void handleResolve('manual')}
                >
                  {t('plans_conflict_use_manual')}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {mergeState?.status === 'merged' ? (
        <section className="panel">
          <h3>{t('plans_notice_merged')}</h3>
          <div className="actions-row">
            <button className="btn btn-primary" onClick={() => void handleCompleteMerge()}>
              {t('plans_complete_merge')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
