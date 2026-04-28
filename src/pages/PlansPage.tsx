import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  GitBranch,
  Lightbulb,
  Plus,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppActions } from '../app/app-context';
import { toLocalizedConflictContent, toLocalizedErrorMessage, toPlanLabel, useI18n } from '../i18n';
import { MergeResult, PlanInfo } from '../shared/contracts';
import { getBridge, unwrapResult } from '../services/bridge';
import { useAppStore } from '../stores/useAppStore';

function planLabel(plan: PlanInfo, t: ReturnType<typeof useI18n>['t']) {
  return toPlanLabel(plan.name, plan.isMain, t);
}

function formatSavedTime(timestamp: number | null, locale: string) {
  if (!timestamp) {
    return locale === 'zh-CN' ? '还没有保存记录' : 'No saved record yet';
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

export function PlansPage() {
  const { project, setNotice } = useAppStore();
  const { openProjectFolder, enableProtection, refreshProject } = useAppActions();
  const { locale, t } = useI18n();
  const navigate = useNavigate();
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
  const currentPlanLabel = currentPlan
    ? planLabel(currentPlan, t)
    : stablePlan
      ? planLabel(stablePlan, t)
      : copy('稳定版本', 'Stable version');
  const stablePlanLabel = stablePlan ? planLabel(stablePlan, t) : copy('稳定版本', 'Stable version');
  const needsFirstSave = (historyCount ?? 0) === 0;
  const hasUnsavedChanges = (project?.pendingChangeCount ?? 0) > 0;
  const isBlocked = needsFirstSave || hasUnsavedChanges;
  const activeIdeaPlan = currentPlan && !currentPlan.isMain ? currentPlan : null;

  const selectedConflict = useMemo(
    () => mergeState?.conflicts.find((item) => item.filePath === selectedConflictFile) ?? mergeState?.conflicts[0],
    [mergeState, selectedConflictFile]
  );

  const selectedConflictIndex = useMemo(() => {
    if (!mergeState?.conflicts.length || !selectedConflict) {
      return 0;
    }

    return Math.max(0, mergeState.conflicts.findIndex((item) => item.filePath === selectedConflict.filePath));
  }, [mergeState, selectedConflict]);

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

      const nextIdea = plansData.find((item) => !item.isMain)?.name ?? '';
      setMergeFrom((current) => {
        if (plansData.some((item) => item.name === current && !item.isMain)) {
          return current;
        }
        return nextIdea;
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

  function applyMergeResult(result: MergeResult, preferredFile = '') {
    setMergeState(result);

    if (result.status === 'needs_decision') {
      const nextConflict =
        result.conflicts.find((item) => item.filePath === preferredFile) ?? result.conflicts[0];
      setSelectedConflictFile(nextConflict?.filePath ?? '');
      setManualContent(nextConflict?.currentContent ?? '');
      return;
    }

    setSelectedConflictFile('');
    setManualContent('');
  }

  async function handleCreatePlan() {
    const planName = newPlanName.trim();
    if (!project?.path || !planName || isBlocked) {
      return;
    }

    setWorking(true);
    try {
      await unwrapResult(getBridge().createPlan(project.path, planName, currentPlan?.name ?? stablePlan?.name));
      setNewPlanName('');
      setNotice({ type: 'success', text: t('plans_notice_created', { name: planName }) });
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
    if (!project?.path || !planName) {
      return;
    }

    setWorking(true);
    try {
      await unwrapResult(getBridge().switchPlan(project.path, planName));
      await refreshProject();
      await loadPlans();
      const nextPlan = plans.find((item) => item.name === planName);
      setNotice({
        type: 'success',
        text: t('plans_notice_switched', {
          name: nextPlan ? planLabel(nextPlan, t) : planName
        })
      });
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
    if (!project?.path || !stablePlan?.name || !mergeFrom || isBlocked) {
      return;
    }

    setWorking(true);
    try {
      const result = await unwrapResult(getBridge().mergePlan(project.path, mergeFrom, stablePlan.name));
      applyMergeResult(result, result.conflicts[0]?.filePath ?? '');

      if (result.status === 'merged') {
        setNotice({ type: 'info', text: copy('已经带回稳定版本，最后保存一次结果即可。', 'Ready to save the merged result.') });
      } else {
        setNotice({
          type: 'info',
          text: copy('两边改到了同一部分，请逐个文件决定保留哪份内容。', 'Both copies changed the same part. Choose what to keep.')
        });
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
      applyMergeResult(result, selectedConflict.filePath);
      setNotice({
        type: 'info',
        text:
          result.status === 'needs_decision'
            ? copy(`还剩 ${result.conflicts.length} 个文件需要决定。`, `${result.conflicts.length} files still need a decision.`)
            : copy('碰到一起的修改已经处理完，最后保存一次结果。', 'The overlapping edits are resolved. Save the result to finish.')
      });
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
      for (const conflict of mergeState.conflicts) {
        latestResult = await unwrapResult(getBridge().resolveCollision(project.path, conflict.filePath, strategy));
        if (latestResult.status === 'merged') {
          break;
        }
      }
      applyMergeResult(latestResult);
      setNotice({
        type: 'info',
        text:
          latestResult.status === 'needs_decision'
            ? copy(`还剩 ${latestResult.conflicts.length} 个文件需要决定。`, `${latestResult.conflicts.length} files still need a decision.`)
            : copy('碰到一起的修改已经处理完，最后保存一次结果。', 'The overlapping edits are resolved. Save the result to finish.')
      });
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
          copy(`带回想法副本：${mergeFrom} -> ${stablePlan.name}`, `Bring back idea copy: ${mergeFrom} -> ${stablePlan.name}`)
        )
      );
      setMergeState(null);
      setNotice({ type: 'success', text: copy('已经保存带回后的结果。', 'The merged result has been saved.') });
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

  function renderStateCard(title: string, description: string, action: ReactNode) {
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
    return renderStateCard(
      copy('先打开一个项目', 'Open a project first'),
      copy('打开项目后，才能从一个稳定版本开始试新想法。', 'Open a project before trying a separate idea copy.'),
      <button className="btn btn-primary" onClick={() => void openProjectFolder()}>
        {t('app_open_project')}
      </button>
    );
  }

  if (!project.isProtected) {
    return renderStateCard(
      copy('先开启版本保护', 'Turn on protection first'),
      copy('这样每次尝试前都有可恢复的保存点。', 'This makes every experiment recoverable.'),
      <button className="btn btn-primary" onClick={() => void enableProtection()}>
        {t('app_enable_protection')}
      </button>
    );
  }

  return (
    <div className="page page-v2 plans-page-v2">
      <header className="section-header-v2 compact">
        <div>
          <h1>{copy('试新想法', 'Idea Lab')}</h1>
          <p>{copy('把不确定的修改放到单独副本里，满意后再带回稳定版本。', 'Try risky work in a separate copy, then bring it back when it works.')}</p>
        </div>
        <div className="header-actions-v2">
          <button className="btn btn-secondary" onClick={() => navigate('/changes')}>
            {copy('处理当前修改', 'Handle Changes')}
          </button>
          <button className="btn btn-primary project-header-primary" disabled={working || isBlocked || !newPlanName.trim()} onClick={() => void handleCreatePlan()}>
            <Plus size={18} />
            {copy('创建想法副本', 'Create Idea Copy')}
          </button>
        </div>
      </header>

      <section className="plans-status-grid-v2">
        <article className="stat-card-v2">
          <span className="stat-icon-v2 plan"><GitBranch size={22} /></span>
          <div>
            <span>{copy('当前所在', 'Current copy')}</span>
            <strong>{currentPlanLabel}</strong>
            <small>{activeIdeaPlan ? copy('正在一个想法副本里', 'Inside an idea copy') : copy('稳定版本', 'Stable version')}</small>
          </div>
        </article>
        <article className="stat-card-v2">
          <span className="stat-icon-v2 clean"><ShieldCheck size={22} /></span>
          <div>
            <span>{copy('稳定版本', 'Stable version')}</span>
            <strong>{stablePlanLabel}</strong>
            <small>{formatSavedTime(stablePlan?.lastSavedAt ?? null, locale)}</small>
          </div>
        </article>
        <article className="stat-card-v2">
          <span className="stat-icon-v2 plan"><Lightbulb size={22} /></span>
          <div>
            <span>{copy('想法副本', 'Idea copies')}</span>
            <strong>{ideaPlans.length}</strong>
            <small>{copy('可独立尝试', 'Safe to try separately')}</small>
          </div>
        </article>
        <article className="stat-card-v2">
          <span className={`stat-icon-v2 ${isBlocked ? 'danger' : 'clean'}`}>
            {isBlocked ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
          </span>
          <div>
            <span>{copy('下一步状态', 'Next step')}</span>
            <strong>{isBlocked ? copy('先处理当前项目', 'Handle project first') : copy('可以开始尝试', 'Ready to try')}</strong>
            <small>{hasUnsavedChanges ? copy(`${project.pendingChangeCount} 个文件还没保存`, `${project.pendingChangeCount} unsaved files`) : copy('工作区干净', 'Work area is clean')}</small>
          </div>
        </article>
      </section>

      {isBlocked ? (
        <section className="problem-strip-v2">
          <AlertTriangle size={20} />
          <div>
            <strong>{needsFirstSave ? copy('先保存一个可回来的版本', 'Save a recoverable version first') : copy('先保存或清理当前修改', 'Save or clean current changes first')}</strong>
            <span>{copy('这样切换副本或带回修改时，不会覆盖你手上的工作。', 'This prevents switching or bringing work back from overwriting your current work.')}</span>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/changes')}>
            {copy('去处理', 'Handle Now')}
          </button>
        </section>
      ) : null}

      <section className="plans-workbench-v2">
        <div className="plans-main-card-v2">
          <div className="plans-card-head-v2">
            <div>
              <h2>{copy('版本副本', 'Version Copies')}</h2>
              <p>{copy('普通使用只需要理解：稳定版本可以随时回来，想法副本用来试错。', 'Stable is your safe version. Idea copies are for experiments.')}</p>
            </div>
            {loading ? <span className="tone-badge">{copy('读取中', 'Loading')}</span> : null}
          </div>

          <div className="plan-copy-list-v2">
            {[stablePlan, ...ideaPlans].filter(Boolean).map((plan) => {
              const item = plan as PlanInfo;
              return (
                <article key={item.name} className={`plan-copy-card-v2 ${item.isCurrent ? 'active' : ''}`}>
                  <span className={`plan-copy-icon-v2 ${item.isMain ? 'stable' : 'idea'}`}>
                    {item.isMain ? <ShieldCheck size={22} /> : <Sparkles size={22} />}
                  </span>
                  <div className="plan-copy-body-v2">
                    <div className="plan-copy-title-v2">
                      <strong>{planLabel(item, t)}</strong>
                      {item.isCurrent ? <span>{copy('当前正在这里', 'You are here')}</span> : null}
                    </div>
                    <p>{item.lastMessage || copy('还没有保存说明。', 'No saved note yet.')}</p>
                    <small>{formatSavedTime(item.lastSavedAt, locale)}</small>
                  </div>
                  {!item.isCurrent ? (
                    <button className="btn btn-secondary" disabled={working} onClick={() => void handleSwitchPlan(item.name)}>
                      {copy('切换到这里', 'Switch Here')}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>

        <aside className="plans-side-stack-v2">
          <section className="plans-side-card-v2">
            <h2>{copy('创建新想法', 'Create New Idea')}</h2>
            <p>{copy('从当前版本复制一份出来，所有尝试都先放在这份副本里。', 'Copy the current version and try changes there first.')}</p>
            <label className="settings-field-v2">
              {copy('给这个想法起个名字', 'Idea name')}
              <input
                className="input-text"
                value={newPlanName}
                placeholder={copy('例如：登录页新排版', 'Example: new login layout')}
                onChange={(event) => setNewPlanName(event.target.value)}
              />
            </label>
            <button className="btn btn-primary project-header-primary" disabled={working || isBlocked || !newPlanName.trim()} onClick={() => void handleCreatePlan()}>
              <Plus size={18} />
              {copy('开始这个想法', 'Start This Idea')}
            </button>
          </section>

          <section className="plans-side-card-v2">
            <h2>{copy('带回稳定版本', 'Bring Back to Stable')}</h2>
            <p>{copy('某个想法做对了，再把它带回稳定版本。', 'When an idea works, bring it back to stable.')}</p>
            <label className="settings-field-v2">
              {copy('选择要带回的想法', 'Choose an idea')}
              <select className="input-select" value={mergeFrom} onChange={(event) => setMergeFrom(event.target.value)}>
                <option value="">{copy('请选择', 'Select')}</option>
                {ideaPlans.map((plan) => (
                  <option key={plan.name} value={plan.name}>
                    {planLabel(plan, t)}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-secondary" disabled={working || isBlocked || !mergeFrom} onClick={() => void handleMerge()}>
              <ArrowRightLeft size={18} />
              {copy('带回稳定版本', 'Bring Back')}
            </button>
          </section>
        </aside>
      </section>

      {mergeState?.status === 'needs_decision' && selectedConflict ? (
        <section className="collision-panel-v2">
          <div className="plans-card-head-v2">
            <div>
              <h2>{copy('两边改到了同一部分', 'Both copies changed the same part')}</h2>
              <p>{copy('按文件决定保留稳定版本、想法副本，或手动整理后保存。', 'Choose stable, idea copy, or edit the final content yourself.')}</p>
            </div>
            <span className="tone-badge attention">
              {selectedConflictIndex + 1} / {mergeState.conflicts.length}
            </span>
          </div>

          <div className="collision-actions-v2">
            <select
              className="input-select"
              value={selectedConflict.filePath}
              onChange={(event) => {
                const nextFile = event.target.value;
                const nextConflict = mergeState.conflicts.find((item) => item.filePath === nextFile);
                setSelectedConflictFile(nextFile);
                setManualContent(nextConflict?.currentContent ?? '');
              }}
            >
              {mergeState.conflicts.map((conflict) => (
                <option key={conflict.filePath} value={conflict.filePath}>
                  {conflict.filePath}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" disabled={working} onClick={() => void handleResolveAll('keepCurrent')}>
              {copy('全部保留稳定版本', 'Keep stable for all')}
            </button>
            <button className="btn btn-secondary" disabled={working} onClick={() => void handleResolveAll('keepIncoming')}>
              {copy('全部保留想法副本', 'Keep idea for all')}
            </button>
          </div>

          <div className="collision-grid-v2">
            <article>
              <h3>{copy('稳定版本', 'Stable version')}</h3>
              <pre>{toLocalizedConflictContent(selectedConflict.currentContent, 'current', t)}</pre>
              <button className="btn btn-secondary" disabled={working} onClick={() => void handleResolve('keepCurrent')}>
                {copy('保留这一版', 'Keep This')}
              </button>
            </article>
            <article>
              <h3>{copy('想法副本', 'Idea copy')}</h3>
              <pre>{toLocalizedConflictContent(selectedConflict.incomingContent, 'incoming', t)}</pre>
              <button className="btn btn-secondary" disabled={working} onClick={() => void handleResolve('keepIncoming')}>
                {copy('保留这一版', 'Keep This')}
              </button>
            </article>
            <article>
              <h3>{copy('手动整理', 'Manual edit')}</h3>
              <textarea
                className="input-textarea"
                value={manualContent}
                rows={12}
                onChange={(event) => setManualContent(event.target.value)}
              />
              <button className="btn btn-secondary" disabled={working} onClick={() => void handleResolve('manual')}>
                {copy('使用整理后的内容', 'Use Edited Content')}
              </button>
            </article>
          </div>
        </section>
      ) : null}

      {mergeState?.status === 'merged' ? (
        <section className="problem-strip-v2 ready">
          <CheckCircle2 size={20} />
          <div>
            <strong>{copy('带回结果已准备好', 'The result is ready')}</strong>
            <span>{copy('最后保存一次，稳定版本就会包含这个想法。', 'Save once more so stable includes this idea.')}</span>
          </div>
          <button className="btn btn-primary project-header-primary" disabled={working} onClick={() => void handleCompleteMerge()}>
            {copy('保存这次结果', 'Save Result')}
          </button>
        </section>
      ) : null}
    </div>
  );
}
