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
  const { locale, t } = useI18n();
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
  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);

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
      <section className="panel lab-hero">
        <div className="lab-hero-copy">
          <span className="pill">{copy('安全实验区', 'Safe Workspace')}</span>
          <h1>{copy('试验区', 'Idea Lab')}</h1>
          <p>
            {ideasLocked
              ? copy(
                  '先把当前项目整理到稳定状态，再来这里试新想法。',
                  'First bring this project to a stable point, then use this page for risky ideas.'
                )
              : copy(
                  '这里专门用来开试验副本，不会直接打乱你当前的稳定版本。',
                  'Use this page to try ideas in separate copies without disturbing the stable version.'
                )}
          </p>
        </div>
        <div className="lab-hero-metrics">
          <article className="lab-metric-card">
            <span>{copy('当前副本', 'Current copy')}</span>
            <strong>{currentPlan ? mapPlanLabel(currentPlan, t) : mapPlanLabel(stablePlan ?? { id: '', name: 'main', isCurrent: false, isMain: true, lastSavedAt: null, lastMessage: '' }, t)}</strong>
          </article>
          <article className="lab-metric-card">
            <span>{copy('试验副本', 'Idea copies')}</span>
            <strong>{ideaPlans.length}</strong>
          </article>
          <article className="lab-metric-card">
            <span>{copy('当前状态', 'Current state')}</span>
            <strong>{ideasLocked ? copy('先处理当前项目', 'Needs one step first') : copy('可以开始试验', 'Ready to experiment')}</strong>
          </article>
        </div>
      </section>

      {ideasLocked ? (
        <section className="panel lab-blocker-card">
          <div className="section-head">
            <div>
              <h2>
                {needsFirstSave
                  ? copy('先保存一个稳定版本', 'Save one stable version first')
                  : copy('先保存当前修改', 'Save current changes first')}
              </h2>
              <p className="panel-subtitle">
                {needsFirstSave
                  ? copy(
                      '没有稳定保存点之前，试验副本没有意义。先去“修改”页保存一次。',
                      'An idea copy only helps after you have one stable saved point. Save once in Changes first.'
                    )
                  : copy(
                      '当前还有未保存修改。先把这次改动保存下来，再开始试验。',
                      'There are still unsaved changes. Save this work first, then start an experiment.'
                    )}
              </p>
            </div>
            <span className="tone-badge attention">{copy('现在先做这个', 'Do this first')}</span>
          </div>
          <div className="actions-row">
            <Link className="btn btn-primary" to="/changes">
              {copy('去保存当前修改', 'Go Save Current Work')}
            </Link>
          </div>
        </section>
      ) : null}

      <div className="lab-grid">
        <section className="panel lab-card">
          <div className="section-head">
            <div>
              <h2>{copy('稳定版本', 'Stable Version')}</h2>
              <p className="panel-subtitle">
                {copy('这是你随时可以回来的安全版本。', 'This is the version you can always come back to.')}
              </p>
            </div>
            <span className="tag tag-main">
              {stablePlan?.isCurrent ? copy('当前就在这里', 'You are here') : copy('稳定版本', 'Stable')}
            </span>
          </div>
          {stablePlan ? (
            <div className="lab-stack">
              <div className="item-title">{mapPlanLabel(stablePlan, t)}</div>
              <div className="item-subtle">{stablePlan.lastMessage || t('plans_no_saved_record')}</div>
              {!stablePlan.isCurrent ? (
                <div className="actions-row">
                  <button
                    className="btn btn-secondary"
                    disabled={working || ideasLocked}
                    onClick={() => void handleSwitchPlan(stablePlan.name)}
                  >
                    {copy('回到这个版本', 'Open this version')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted">{t('plans_no_saved_record')}</p>
          )}
        </section>

        <section className="panel lab-card">
          <div className="section-head">
            <div>
              <h2>{copy('试验副本', 'Idea Copies')}</h2>
              <p className="panel-subtitle">
                {copy(
                  '每个试验副本都单独放着，满意后再带回稳定版本。',
                  'Each idea copy stays separate until you decide to bring it back.'
                )}
              </p>
            </div>
            <span className="pill">{ideaPlans.length}</span>
          </div>
          {loading ? (
            <p className="muted">{t('plans_loading')}</p>
          ) : ideaPlans.length === 0 ? (
            <div className="lab-empty-state">
              <strong>{copy('还没有试验副本', 'No idea copies yet')}</strong>
              <p>
                {copy(
                  '等你准备试一个新想法时，在下面输入名字，马上开一个单独副本。',
                  'When you are ready to try something new, create a separate copy below.'
                )}
              </p>
            </div>
          ) : (
            <ul className="list lab-plan-list">
              {ideaPlans.map((plan) => (
                <li key={plan.id} className={`list-item lab-plan-row ${plan.isCurrent ? 'active' : ''}`}>
                  <div className="flex-grow">
                    <div className="item-title">
                      {mapPlanLabel(plan, t)}
                      {plan.isCurrent ? <span className="tag">{copy('当前在这里', 'You are here')}</span> : null}
                    </div>
                    <div className="item-subtle">{plan.lastMessage || t('plans_no_saved_record')}</div>
                  </div>
                  {!plan.isCurrent ? (
                    <button
                      className="btn btn-secondary"
                      disabled={working || ideasLocked}
                      onClick={() => void handleSwitchPlan(plan.name)}
                    >
                      {copy('打开这个副本', 'Open this copy')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="lab-grid">
        <section className="panel lab-card">
          <div className="section-head">
            <div>
              <h2>{copy('开始一个新试验', 'Start a New Experiment')}</h2>
              <p className="panel-subtitle">
                {copy(
                  '系统会从你当前看到的副本复制一份，稳定版本不会被直接改动。',
                  'We will create a separate copy from what you are looking at now.'
                )}
              </p>
            </div>
          </div>
          <p className="muted">
            <strong>{copy('将从这里开始：', 'Starting from:')}</strong>{' '}
            {currentPlan
              ? mapPlanLabel(currentPlan, t)
              : mapPlanLabel(
                  stablePlan ?? { id: '', name: 'main', isCurrent: false, isMain: true, lastSavedAt: null, lastMessage: '' },
                  t
                )}
          </p>
          <div className="field-row">
            <input
              className="input-text"
              value={newPlanName}
              placeholder={copy('例如：登录页新样式', 'Example: new login layout')}
              onChange={(event) => setNewPlanName(event.target.value)}
            />
            <button className="btn btn-primary" disabled={working || ideasLocked} onClick={() => void handleCreatePlan()}>
              {copy('开始试验', 'Start This Idea')}
            </button>
          </div>
        </section>

        <section className="panel lab-card">
          <div className="section-head">
            <div>
              <h2>{copy('带回稳定版本', 'Bring Back to Stable')}</h2>
              <p className="panel-subtitle">
                {copy(
                  '当某个试验已经满意了，再把它带回稳定版本。',
                  'When an idea copy looks right, bring it back into the stable version.'
                )}
              </p>
            </div>
          </div>
          {ideaPlans.length === 0 ? (
            <p className="muted">{copy('先创建一个试验副本，这里才会有可选内容。', 'Create one idea copy first.')}</p>
          ) : (
            <div className="field-row">
              <label>{copy('选择要带回的试验', 'Choose an idea copy')}</label>
              <select className="input-select" value={mergeFrom} onChange={(event) => setMergeFrom(event.target.value)}>
                <option value="">{copy('请选择', 'Select')}</option>
                {ideaPlans.map((plan) => (
                  <option key={plan.name} value={plan.name}>
                    {mapPlanLabel(plan, t)}
                  </option>
                ))}
              </select>
              <span className="lab-merge-summary">
                {copy('会带回到：', 'Will be added into:')}{' '}
                <strong>{stablePlan ? mapPlanLabel(stablePlan, t) : t('common_main_plan')}</strong>
              </span>
              <button className="btn btn-primary" disabled={working || ideasLocked || !mergeFrom} onClick={() => void handleMerge()}>
                {copy('带回稳定版本', 'Bring It Back')}
              </button>
            </div>
          )}
        </section>
      </div>

      {mergeState?.status === 'needs_decision' && mergeState.conflicts.length > 0 ? (
        <section className="panel">
          <div className="section-head">
            <h2>{copy('两边改到了同一部分', 'Both copies changed the same part')}</h2>
            <span className="pill">
              {copy(`${mergeState.conflicts.length} 个文件待处理`, `${mergeState.conflicts.length} files to decide`)}
            </span>
          </div>

          <div className="conflict-summary-card">
            <div className="section-head">
              <div>
                <h3>{copy('先做一个简单决定', 'Pick one side first')}</h3>
                <p className="panel-subtitle">
                  {copy(
                    '如果大部分文件都想保留同一边，可以直接批量处理。',
                    'If most files should keep the same side, use a bulk decision.'
                  )}
                </p>
              </div>
              <span className="tone-badge attention">
                {copy(
                  `正在处理第 ${selectedConflictIndex + 1} / ${mergeState.conflicts.length} 个`,
                  `Working on ${selectedConflictIndex + 1} / ${mergeState.conflicts.length}`
                )}
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
                {copy('全部保留稳定版本', 'Keep stable version for all')}
              </button>
              <button
                className="btn btn-secondary"
                disabled={working}
                onClick={() => void handleResolveAll('keepIncoming')}
              >
                {copy('全部保留试验副本', 'Keep idea copy for all')}
              </button>
            </div>
          </div>

          <div className="field-row">
            <label>{copy('当前文件', 'Current file')}</label>
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
                <h4>{copy('稳定版本这一边', 'Stable version')}</h4>
                <pre>{toLocalizedConflictContent(selectedConflict.currentContent, 'current', t)}</pre>
                <button
                  className="btn btn-secondary"
                  disabled={working}
                  onClick={() => void handleResolve('keepCurrent')}
                >
                  {copy('保留这一边', 'Keep this side')}
                </button>
              </div>
              <div className="conflict-col">
                <h4>{copy('试验副本这一边', 'Idea copy')}</h4>
                <pre>{toLocalizedConflictContent(selectedConflict.incomingContent, 'incoming', t)}</pre>
                <button
                  className="btn btn-secondary"
                  disabled={working}
                  onClick={() => void handleResolve('keepIncoming')}
                >
                  {copy('保留这一边', 'Keep this side')}
                </button>
              </div>
              <div className="conflict-col">
                <h4>{copy('自己整理后再保存', 'Edit it yourself')}</h4>
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
                  {copy('使用这份整理后的内容', 'Use this edited content')}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {mergeState?.status === 'merged' ? (
        <section className="panel">
          <h3>{copy('这个试验已经带回稳定版本', 'This idea copy is ready to save into the stable version')}</h3>
          <div className="actions-row">
            <button className="btn btn-primary" onClick={() => void handleCompleteMerge()}>
              {copy('保存这次带回结果', 'Save This Merge')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
