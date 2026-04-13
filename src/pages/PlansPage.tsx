import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { toLocalizedConflictContent, toLocalizedErrorMessage, toPlanLabel, useI18n } from '../i18n';
import { MergeResult, PlanInfo } from '../shared/contracts';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';

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

  const copy = (zh: string, en: string) => (locale === 'zh-CN' ? zh : en);

  const stablePlan = useMemo(
    () => plans.find((item) => item.isMain) ?? plans.find((item) => item.name === 'main' || item.name === 'master'),
    [plans]
  );
  const ideaPlans = useMemo(() => plans.filter((item) => !item.isMain), [plans]);
  const currentPlan = useMemo(() => plans.find((item) => item.isCurrent) ?? null, [plans]);
  const fallbackPlan = useMemo<PlanInfo>(
    () => ({
      id: '',
      name: 'main',
      isCurrent: false,
      isMain: true,
      lastSavedAt: null,
      lastMessage: ''
    }),
    []
  );
  const currentPlanLabel = currentPlan
    ? mapPlanLabel(currentPlan, t)
    : mapPlanLabel(stablePlan ?? fallbackPlan, t);
  const needsFirstSave = (historyCount ?? 0) === 0;
  const hasUnsavedChanges = (project?.pendingChangeCount ?? 0) > 0;
  const ideasLocked = needsFirstSave || hasUnsavedChanges;
  const noSavedNoteText = copy('还没有保存说明。', 'No saved note yet.');

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
    if (conflicts.length === 0) {
      return '';
    }

    const sameFile = conflicts.find((item) => item.filePath === previousFile);
    if (sameFile) {
      return sameFile.filePath;
    }

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
    if (!project?.path || !project.isProtected) {
      return;
    }

    setLoading(true);
    try {
      const [plansData, historyData] = await Promise.all([
        unwrapResult(getBridge().listPlans(project.path)),
        unwrapResult(getBridge().listHistory(project.path))
      ]);
      setPlans(plansData);
      setHistoryCount(historyData.length);

      const firstIdea = plansData.find((item) => !item.isMain)?.name ?? '';
      setMergeFrom((current) => {
        if (plansData.find((item) => item.name === current && !item.isMain)) {
          return current;
        }
        return firstIdea || current || '';
      });
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
    if (!project?.path || !newPlanName.trim() || ideasLocked) {
      return;
    }

    setWorking(true);
    try {
      await unwrapResult(
        getBridge().createPlan(project.path, newPlanName.trim(), currentPlan?.name ?? stablePlan?.name)
      );
      setNotice({
        type: 'success',
        text: copy(`已创建试验副本：${newPlanName.trim()}`, `Experiment copy created: ${newPlanName.trim()}`)
      });
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
    if (!project?.path || !planName || ideasLocked) {
      return;
    }

    setWorking(true);
    try {
      await unwrapResult(getBridge().switchPlan(project.path, planName));
      const nextLabel =
        plans.find((item) => item.name === planName) !== undefined
          ? mapPlanLabel(plans.find((item) => item.name === planName) as PlanInfo, t)
          : planName;
      setNotice({
        type: 'success',
        text: copy(`现在正在查看：${nextLabel}`, `Now viewing: ${nextLabel}`)
      });
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
    if (!project?.path || !stablePlan?.name || !mergeFrom || ideasLocked) {
      return;
    }

    setWorking(true);
    try {
      const result = await unwrapResult(getBridge().mergePlan(project.path, mergeFrom, stablePlan.name));
      if (result.status === 'merged') {
        setNotice({
          type: 'success',
          text: copy('这份试验副本已经带回稳定版本。', 'This idea copy has been brought back into the stable version.')
        });
        applyMergeResult(result);
      } else {
        setNotice({
          type: 'info',
          text: copy('两边都改到了同一部分，需要你决定保留哪一边。', 'Both copies changed the same part. Choose which side to keep.')
        });
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
    if (!project?.path || !selectedConflict) {
      return;
    }

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
          text: copy(
            `还剩 ${result.conflicts.length} 个文件需要决定。`,
            `${result.conflicts.length} files still need a decision.`
          )
        });
      } else {
        applyMergeResult(result);
        setNotice({
          type: 'info',
          text: copy('碰到一起的修改已经处理完，最后保存一下结果。', 'The overlapping edits are resolved. Save the result to finish.')
        });
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
    if (!project?.path || !mergeState?.conflicts.length) {
      return;
    }

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
          text: copy(
            `还剩 ${latestResult.conflicts.length} 个文件需要决定。`,
            `${latestResult.conflicts.length} files still need a decision.`
          )
        });
      } else {
        setNotice({
          type: 'info',
          text: copy('碰到一起的修改已经处理完，最后保存一下结果。', 'The overlapping edits are resolved. Save the result to finish.')
        });
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
    if (!project?.path || !stablePlan?.name) {
      return;
    }

    setWorking(true);
    try {
      await unwrapResult(
        getBridge().completeMerge(
          project.path,
          copy(`带回试验副本：${mergeFrom} -> ${stablePlan.name}`, `Bring back idea copy: ${mergeFrom} -> ${stablePlan.name}`)
        )
      );
      setMergeState(null);
      setNotice({
        type: 'success',
        text: copy('已保存带回后的结果。', 'The merged result has been saved.')
      });
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
          <h2>{copy('试新想法', 'Try Ideas')}</h2>
          <div className="empty-action-panel">
            <h3>{copy('先打开一个项目。', 'Open a project first.')}</h3>
            <p>{copy('打开项目后，才知道要从哪个稳定版本开始试。', 'Open a project before starting a safe experiment.')}</p>
            <div className="actions-row">
              <button className="btn btn-primary" onClick={() => void openProjectFolder()}>
                {copy('打开项目', 'Open Project')}
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
          <h2>{copy('试新想法', 'Try Ideas')}</h2>
          <div className="empty-action-panel">
            <h3>{copy('先开启版本保护。', 'Turn on protection first.')}</h3>
            <p>{copy('这样试验副本和恢复才安全。', 'This makes idea copies and restore safe.')}</p>
            <div className="actions-row">
              <button className="btn btn-primary" onClick={() => void enableProtection()}>
                {copy('开启版本保护', 'Enable Protection')}
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
          <span className="pill">{copy('安全试验区', 'Safe Workspace')}</span>
          <h1>{copy('试新想法', 'Try Ideas')}</h1>
          <p>
            {ideasLocked
              ? copy('先把当前项目收成稳定版本，再来这里试。', 'Make one stable point first, then come back here.')
              : copy('在单独副本里尝试，满意了再带回稳定版本。', 'Try ideas in a separate copy, then bring back only what works.')}
          </p>
        </div>
        <div className="lab-hero-metrics">
          <article className="lab-metric-card">
            <span>{copy('当前副本', 'Current copy')}</span>
            <strong>{currentPlanLabel}</strong>
          </article>
          <article className="lab-metric-card">
            <span>{copy('试验副本', 'Idea copies')}</span>
            <strong>{ideaPlans.length}</strong>
          </article>
          <article className="lab-metric-card">
            <span>{copy('当前状态', 'Current state')}</span>
            <strong>
              {ideasLocked
                ? copy('还差一步', 'Needs one step first')
                : copy('可以开始试验', 'Ready to experiment')}
            </strong>
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
                  ? copy('先留下一次可回到的保存点，再开试验副本。', 'Create one safe point before starting an idea copy.')
                  : copy('先把手上这批工作保存好，再开始试验。', 'Save this work first, then start the experiment.')}
              </p>
            </div>
            <span className="tone-badge attention">{copy('现在先做这个', 'Do this first')}</span>
          </div>
          <div className="actions-row">
            <Link className="btn btn-primary" to="/changes">
              {copy('去保存当前工作', 'Go Save Current Work')}
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
                {copy('这是你随时可以回来的版本。', 'This is the version you can always return to.')}
              </p>
            </div>
            <span className="tag tag-main">
              {stablePlan?.isCurrent ? copy('你现在就在这里', 'You are here') : copy('稳定版本', 'Stable')}
            </span>
          </div>
          {stablePlan ? (
            <div className="lab-stack">
              <div className="item-title">{mapPlanLabel(stablePlan, t)}</div>
              <div className="item-subtle">{stablePlan.lastMessage || noSavedNoteText}</div>
              {!stablePlan.isCurrent ? (
                <div className="actions-row">
                  <button
                    className="btn btn-secondary"
                    disabled={working || ideasLocked}
                    onClick={() => void handleSwitchPlan(stablePlan.name)}
                  >
                    {copy('打开这个版本', 'Open this version')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted">{noSavedNoteText}</p>
          )}
        </section>

        <section className="panel lab-card">
          <div className="section-head">
            <div>
              <h2>{copy('试验副本', 'Idea Copies')}</h2>
              <p className="panel-subtitle">
                {copy('每个试验都单独放着，不会直接碰稳定版本。', 'Separate copies for risky attempts.')}
              </p>
            </div>
            <span className="pill">{ideaPlans.length}</span>
          </div>
          {loading ? (
            <p className="muted">{copy('正在读取试验副本。', 'Loading idea copies.')}</p>
          ) : ideaPlans.length === 0 ? (
            <div className="lab-empty-state">
              <strong>{copy('还没有试验副本', 'No idea copies yet')}</strong>
              <p>{copy('下面输入一个名字，就能开一个单独副本。', 'Create one below when you are ready to try something new.')}</p>
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
                    <div className="item-subtle">{plan.lastMessage || noSavedNoteText}</div>
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
              <h2>{copy('开一个新试验', 'Start a New Experiment')}</h2>
              <p className="panel-subtitle">
                {copy('会从你现在看到的版本复制一份出去。', 'This starts from the version you are looking at now.')}
              </p>
            </div>
          </div>
          <p className="muted">
            <strong>{copy('起点：', 'Starting from:')}</strong> {currentPlanLabel}
          </p>
          <div className="field-row">
            <input
              className="input-text"
              value={newPlanName}
              placeholder={copy('例如：登录页新排版', 'Example: new login layout')}
              onChange={(event) => setNewPlanName(event.target.value)}
            />
            <button className="btn btn-primary" disabled={working || ideasLocked} onClick={() => void handleCreatePlan()}>
              {copy('开始这个试验', 'Start This Idea')}
            </button>
          </div>
        </section>

        <section className="panel lab-card">
          <div className="section-head">
            <div>
              <h2>{copy('带回稳定版本', 'Bring Back to Stable')}</h2>
              <p className="panel-subtitle">
                {copy('哪个试验做对了，就把它带回来。', 'Bring back the idea copy that turned out right.')}
              </p>
            </div>
          </div>
          {ideaPlans.length === 0 ? (
            <p className="muted">{copy('先创建一个试验副本。', 'Create one idea copy first.')}</p>
          ) : (
            <div className="field-row">
              <label>{copy('要带回哪个试验', 'Choose an idea copy')}</label>
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
                <strong>{stablePlan ? mapPlanLabel(stablePlan, t) : copy('稳定版本', 'Stable Version')}</strong>
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
                <h3>{copy('先选一边', 'Pick one side first')}</h3>
                <p className="panel-subtitle">
                  {copy('如果大部分文件都想保留同一边，可以先批量处理。', 'If most files should keep the same side, use a bulk decision first.')}
                </p>
              </div>
              <span className="tone-badge attention">
                {copy(
                  `正在处理 ${selectedConflictIndex + 1} / ${mergeState.conflicts.length}`,
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
                <h4>{copy('稳定版本这边', 'Stable version')}</h4>
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
                <h4>{copy('试验副本这边', 'Idea copy')}</h4>
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
                <h4>{copy('自己整理后保存', 'Edit it yourself')}</h4>
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
          <h3>{copy('这次带回已经准备好了，最后保存一下结果。', 'This merge is ready. Save the result to finish.')}</h3>
          <div className="actions-row">
            <button className="btn btn-primary" onClick={() => void handleCompleteMerge()}>
              {copy('保存这次结果', 'Save This Merge')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
