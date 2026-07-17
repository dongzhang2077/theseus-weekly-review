import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { AppWeekSource, FetchLike } from "../../shared/api/loadAppWeek";
import {
  deletePlan,
  loadPlanRecords,
  savePlanDraft,
  type PlanApiStatus
} from "../../shared/api/planApi";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { StateSurface } from "../../shared/components/StateSurface";
import { Icon } from "../../shared/icons/Icon";
import {
  buildPlanProposal,
  calculatePlanMetrics,
  createPlanWorkspace,
  createUpcomingPlanSeed,
  dismissPlanSuggestion,
  formatPlanWeek,
  type PlanDraft,
  type PlanItem,
  type PlanMetrics,
  type PlanWorkspace
} from "./planModel";

const characterLoadingUrl = new URL("../../assets/character-loading.png", import.meta.url).href;
const characterSteadyUrl = new URL("../../assets/character-steady.png", import.meta.url).href;
const characterWaitingUrl = new URL("../../assets/character-waiting.png", import.meta.url).href;
const durationOptions = [15, 25, 30, 45, 60, 90, 120];

export type PlanDetail = "edit" | "suggestion" | "focus" | "slack" | "projects";
type LoadPhase = "loading" | "ready" | "error";
type OperationPhase = "idle" | "saving" | "saved" | "conflict" | "error" | "undoing" | "undone";
type OperationAction = "apply" | "manual" | "undo" | null;

interface OperationState {
  phase: OperationPhase;
  action: OperationAction;
  message: string;
  detail: string | null;
}

interface UndoSnapshot {
  before: PlanDraft | null;
  baseline: PlanDraft;
  appliedPlanId: number | null;
}

interface PlanScreenProps {
  planData: AppWeekViewModel["plan"];
  reviewSource: AppWeekSource;
  apiBaseUrl?: string;
  userId?: number;
  entryRequest: {
    id: number;
    detail: PlanDetail;
  } | null;
  onReview: () => void;
  onFocusItem?: (item: PlanItem, projectTitle: string | null) => void;
  fetchImpl?: FetchLike;
}

const idleOperation: OperationState = {
  phase: "idle",
  action: null,
  message: "",
  detail: null
};

export function PlanScreen({
  apiBaseUrl,
  userId,
  planData,
  reviewSource,
  entryRequest,
  onReview,
  onFocusItem,
  fetchImpl
}: PlanScreenProps) {
  const hasLiveApi = Boolean(apiBaseUrl && userId);
  const initialSeed = hasLiveApi && reviewSource !== "api"
    ? createUpcomingPlanSeed()
    : planData;
  const [workspace, setWorkspace] = useState<PlanWorkspace>(() =>
    createPlanWorkspace(initialSeed)
  );
  const [loadPhase, setLoadPhase] = useState<LoadPhase>(hasLiveApi ? "loading" : "ready");
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [operation, setOperation] = useState<OperationState>(idleOperation);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const [reload, setReload] = useState(0);
  const metrics = useMemo(() => calculatePlanMetrics(workspace.draft), [workspace.draft]);
  const proposal = useMemo(() => buildPlanProposal(workspace), [workspace]);
  const projectNames = useMemo(
    () => new Map(workspace.projects.map((project) => [project.id, project.title])),
    [workspace.projects]
  );

  useEffect(() => {
    const seed = hasLiveApi && reviewSource !== "api"
      ? createUpcomingPlanSeed()
      : planData;
    if (!hasLiveApi) {
      setWorkspace(createPlanWorkspace(seed));
      setLoadPhase("ready");
      setOperation(idleOperation);
      setUndoSnapshot(null);
      return;
    }

    let ignore = false;
    setLoadPhase("loading");
    loadPlanRecords({ apiBaseUrl, userId, fetchImpl }).then((result) => {
      if (ignore) return;
      if (result.status !== "ok" || !result.data) {
        setLoadPhase("error");
        return;
      }
      setWorkspace(createPlanWorkspace(seed, result.data));
      setLoadPhase("ready");
      setOperation(idleOperation);
      setUndoSnapshot(null);
    });

    return () => {
      ignore = true;
    };
  }, [apiBaseUrl, fetchImpl, hasLiveApi, planData, reload, reviewSource, userId]);

  useEffect(() => {
    if (entryRequest) setDetail(entryRequest.detail);
  }, [entryRequest]);

  async function applySuggestion() {
    if (!proposal || operation.phase === "saving" || operation.phase === "undoing") return;
    const snapshot: UndoSnapshot = {
      before: workspace.persistedPlan ? copyPlan(workspace.persistedPlan) : null,
      baseline: copyPlan(workspace.draft),
      appliedPlanId: null
    };
    setOperation({ phase: "saving", action: "apply", message: "Saving adjustment", detail: null });

    if (!hasLiveApi) {
      setWorkspace((current) => ({
        ...current,
        draft: proposal.after,
        persistedPlan: proposal.after,
        suggestionStatus: "applied"
      }));
      setUndoSnapshot(snapshot);
      setOperation({ phase: "saved", action: "apply", message: "Sample adjustment applied", detail: null });
      setDetail(null);
      return;
    }

    const result = await savePlanDraft({
      apiBaseUrl,
      userId,
      draft: proposal.after,
      fetchImpl
    });
    if (result.status !== "ok" || !result.data) {
      setOperation(operationFailure("apply", result.status, result.error));
      setDetail(null);
      return;
    }
    snapshot.appliedPlanId = result.data.id;
    setWorkspace((current) => ({
      ...current,
      draft: result.data as PlanDraft,
      persistedPlan: result.data as PlanDraft,
      suggestionStatus: "applied"
    }));
    setUndoSnapshot(snapshot);
    setOperation({ phase: "saved", action: "apply", message: "Plan saved", detail: null });
    setDetail(null);
  }

  async function undoAdjustment() {
    if (!undoSnapshot || operation.phase === "saving" || operation.phase === "undoing") return;
    setOperation({ phase: "undoing", action: "undo", message: "Restoring plan", detail: null });

    if (!hasLiveApi) {
      restoreSnapshot(undoSnapshot);
      return;
    }

    if (undoSnapshot.before) {
      const result = await savePlanDraft({
        apiBaseUrl,
        userId,
        draft: undoSnapshot.before,
        fetchImpl
      });
      if (result.status !== "ok" || !result.data) {
        setOperation(operationFailure("undo", result.status, result.error));
        setDetail(null);
        return;
      }
      setWorkspace((current) => ({
        ...current,
        draft: result.data as PlanDraft,
        persistedPlan: result.data as PlanDraft,
        suggestionStatus: "available"
      }));
      setUndoSnapshot(null);
      setOperation({ phase: "undone", action: null, message: "Plan restored", detail: null });
      setDetail(null);
      return;
    }

    const planId = undoSnapshot.appliedPlanId ?? workspace.persistedPlan?.id ?? null;
    if (planId === null) {
      setOperation({ phase: "error", action: "undo", message: "Plan could not be restored", detail: null });
      return;
    }
    const result = await deletePlan({ apiBaseUrl, userId, planId, fetchImpl });
    if (result.status !== "ok") {
      setOperation(operationFailure("undo", result.status, result.error));
      setDetail(null);
      return;
    }
    restoreSnapshot(undoSnapshot);
  }

  async function saveManualPlan(nextDraft: PlanDraft): Promise<boolean> {
    if (operation.phase === "saving" || operation.phase === "undoing") return false;
    const snapshot: UndoSnapshot = {
      before: workspace.persistedPlan ? copyPlan(workspace.persistedPlan) : null,
      baseline: copyPlan(workspace.draft),
      appliedPlanId: null
    };
    setOperation({ phase: "saving", action: "manual", message: "Saving plan", detail: null });

    if (!hasLiveApi) {
      setWorkspace((current) => ({
        ...current,
        draft: copyPlan(nextDraft),
        persistedPlan: copyPlan(nextDraft)
      }));
      setUndoSnapshot(snapshot);
      setOperation({ phase: "saved", action: "manual", message: "Plan updated", detail: null });
      setDetail(null);
      return true;
    }

    const result = await savePlanDraft({
      apiBaseUrl,
      userId,
      draft: nextDraft,
      fetchImpl
    });
    if (result.status !== "ok" || !result.data) {
      setOperation(operationFailure("manual", result.status, result.error));
      return false;
    }
    snapshot.appliedPlanId = result.data.id;
    setWorkspace((current) => ({
      ...current,
      draft: result.data as PlanDraft,
      persistedPlan: result.data as PlanDraft
    }));
    setUndoSnapshot(snapshot);
    setOperation({ phase: "saved", action: "manual", message: "Plan saved", detail: null });
    setDetail(null);
    return true;
  }

  function restoreSnapshot(snapshot: UndoSnapshot) {
    setWorkspace((current) => ({
      ...current,
      draft: copyPlan(snapshot.baseline),
      persistedPlan: snapshot.before ? copyPlan(snapshot.before) : null,
      suggestionStatus: "available"
    }));
    setUndoSnapshot(null);
    setOperation({ phase: "undone", action: null, message: "Plan restored", detail: null });
    setDetail(null);
  }

  function retryOperation() {
    if (operation.action === "undo") void undoAdjustment();
    else if (operation.action === "apply") void applySuggestion();
  }

  return (
    <section className="screen plan-screen">
      <header className="screen-header">
        <div className="screen-title">{formatPlanWeek(workspace.draft.week)}</div>
      </header>

      {loadPhase === "loading" ? (
        <div className="plan-state">
          <StateSurface icon="calendar" title="Loading plan" />
        </div>
      ) : null}

      {loadPhase === "error" ? (
        <div className="plan-state">
          <StateSurface
            icon="info"
            title="Plan could not load"
            actionLabel="Retry"
            actionIcon="activity"
            onAction={() => setReload((value) => value + 1)}
          />
        </div>
      ) : null}

      {loadPhase === "ready" ? (
        <div className="plan-workspace">
          <div className={`plan-companion status-${metrics.status}`}>
            <span className="plan-companion-mark" aria-hidden="true">
              <Icon name="calendar" />
            </span>
            <span className="plan-companion-copy">
              <small>Week plan</small>
              <strong>{balanceLabel(metrics.status)}</strong>
            </span>
            <img src={planCharacter(metrics.status)} alt="" aria-hidden="true" />
            <span className="plan-companion-line one" aria-hidden="true" />
            <span className="plan-companion-line two" aria-hidden="true" />
          </div>

          <button
            className={`plan-balance-summary status-${metrics.status}`}
            type="button"
            aria-label={`Week balance: ${balanceLabel(metrics.status)}`}
            onClick={() => setDetail("slack")}
          >
            <span className="plan-balance-head">
              <span className="plan-balance-icon" aria-hidden="true"><Icon name="gauge" /></span>
              <span>
                <small>Week balance</small>
                <strong>{balanceLabel(metrics.status)}</strong>
              </span>
              <Icon name="chevronRight" />
            </span>
            <span className="plan-load-track" aria-hidden="true">
              <span style={{ width: `${loadPercent(metrics)}%` }} />
            </span>
            <span className="plan-balance-values">
              <span><small>Planned</small><strong>{formatMinutes(metrics.plannedMinutes)}</strong></span>
              <span><small>Capacity</small><strong>{formatMinutesOrDash(metrics.capacityMinutes)}</strong></span>
              <span><small>Slack</small><strong>{formatNullableMinutes(metrics.slackMinutes)}</strong></span>
            </span>
          </button>

          {operation.phase !== "idle" ? (
            <div
              className={`plan-operation operation-${operation.phase}`}
              role={operation.phase === "error" || operation.phase === "conflict" ? "alert" : "status"}
              title={operation.detail ?? undefined}
            >
              <Icon name={operationIcon(operation.phase)} />
              <span>{operation.message}</span>
              {operation.phase === "saved" && undoSnapshot && detail !== "suggestion" ? (
                <button type="button" onClick={() => void undoAdjustment()}>Undo</button>
              ) : null}
              {operation.phase === "error" && operation.action !== "manual" ? (
                <button type="button" onClick={retryOperation}>Retry</button>
              ) : null}
              {operation.phase === "conflict" ? (
                <button type="button" onClick={() => setReload((value) => value + 1)}>Reload</button>
              ) : null}
            </div>
          ) : null}

          {proposal ? (
            <button
              className="plan-proposal-card"
              type="button"
              aria-label={`Suggested adjustment: ${proposal.suggestion.title}`}
              onClick={() => setDetail("suggestion")}
            >
              <span className="plan-proposal-kicker">Suggested adjustment</span>
              <span className="plan-proposal-icon" aria-hidden="true"><Icon name="route" /></span>
              <span className="plan-proposal-copy">
                <strong>{proposal.suggestion.title}</strong>
                <small>
                  {proposal.suggestion.projectTitle ?? "Flexible block"}
                  {" · "}{formatSignedMinutes(proposal.suggestion.deltaMinutes)}
                </small>
                <span>{proposal.suggestion.reason}</span>
              </span>
              <Icon name="chevronRight" />
            </button>
          ) : workspace.suggestionStatus === "applied" ? (
            <button className="plan-proposal-state applied" type="button" onClick={() => setDetail("suggestion")}>
              <Icon name="check" />
              <span><strong>Adjustment applied</strong><small>Saved in this week</small></span>
              <Icon name="chevronRight" />
            </button>
          ) : workspace.suggestionStatus === "dismissed" && workspace.suggestion ? (
            <button className="plan-proposal-state" type="button" onClick={() => setDetail("suggestion")}>
              <Icon name="x" />
              <span><strong>Suggestion dismissed</strong><small>Review when useful</small></span>
              <Icon name="chevronRight" />
            </button>
          ) : (
            <div className="plan-empty-action">
              <StateSurface
                icon="book"
                title="Review the week before adjusting"
                actionLabel="Open review"
                actionIcon="book"
                onAction={onReview}
              />
            </div>
          )}

          <div className="plan-action-grid" aria-label="Plan details">
            <button type="button" aria-label="Edit plan" onClick={() => setDetail("edit")}>
              <Icon name="plus" />
            </button>
            <button type="button" aria-label="Focus" onClick={() => setDetail("focus")}>
              <Icon name="target" />
            </button>
            <button type="button" aria-label="Slack" onClick={() => setDetail("slack")}>
              <Icon name="gauge" />
            </button>
            <button type="button" aria-label="Projects" onClick={() => setDetail("projects")}>
              <Icon name="folder" />
            </button>
          </div>
        </div>
      ) : null}

      <DetailPanel title={detailTitle(detail)} open={detail !== null && loadPhase === "ready"} onBack={() => setDetail(null)}>
        {detail === "edit" ? (
          <PlanEditor
            draft={workspace.draft}
            projects={workspace.projects}
            operation={operation}
            onSave={saveManualPlan}
          />
        ) : null}
        {detail === "suggestion" ? (
          <SuggestionDetail
            workspace={workspace}
            operation={operation}
            onApply={() => void applySuggestion()}
            onDismiss={() => setWorkspace((current) => dismissPlanSuggestion(current))}
            onRestore={() => setWorkspace((current) => ({ ...current, suggestionStatus: "available" }))}
            canUndo={undoSnapshot !== null}
            onUndo={() => void undoAdjustment()}
          />
        ) : null}
        {detail === "focus" ? (
          <FocusDetail
            workspace={workspace}
            projectNames={projectNames}
            onReview={onReview}
            onFocusItem={onFocusItem}
          />
        ) : null}
        {detail === "slack" ? <SlackDetail metrics={metrics} onEdit={() => setDetail("edit")} /> : null}
        {detail === "projects" ? <ProjectsDetail workspace={workspace} /> : null}
      </DetailPanel>
    </section>
  );
}

function PlanEditor({
  draft,
  projects,
  operation,
  onSave
}: {
  draft: PlanDraft;
  projects: PlanWorkspace["projects"];
  operation: OperationState;
  onSave: (draft: PlanDraft) => Promise<boolean>;
}) {
  const [editor, setEditor] = useState<PlanDraft>(() => copyPlan(draft));
  const orderedProjects = [...projects].sort((left, right) => {
    const statusDelta = Number(right.status === "active") - Number(left.status === "active");
    return statusDelta || left.title.localeCompare(right.title);
  });
  const invalidItems = editor.items.some((item) => !item.title.trim() || item.plannedMinutes <= 0);
  const canSave = editor.capacityMinutes > 0 && !invalidItems && operation.phase !== "saving";
  const plannedMinutes = editor.items.reduce((sum, item) => sum + item.plannedMinutes, 0);

  function updateItem(index: number, patch: Partial<PlanItem>) {
    setEditor((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    }));
  }

  function addItem() {
    const project = orderedProjects.find((item) => item.status === "active") ?? null;
    setEditor((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          projectId: project?.id ?? null,
          title: project ? `${project.title} block` : "New focus block",
          plannedMinutes: 30,
          priority: current.items.length + 1,
          isCompleted: false
        }
      ]
    }));
  }

  function removeItem(index: number) {
    setEditor((current) => ({
      ...current,
      items: current.items
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, priority: itemIndex + 1 }))
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    void onSave({
      ...editor,
      items: editor.items.map((item, index) => ({
        ...item,
        title: item.title.trim(),
        priority: index + 1
      }))
    });
  }

  return (
    <form className="plan-editor" onSubmit={submit}>
      <div className="plan-editor-summary">
        <span aria-hidden="true"><Icon name="calendar" /></span>
        <div>
          <strong>{editor.items.length} focus blocks</strong>
          <small>{formatMinutes(plannedMinutes)} planned</small>
        </div>
      </div>

      <div className="plan-editor-settings">
        <label>
          <span>Capacity</span>
          <div className="plan-number-field">
            <input
              aria-label="Weekly capacity hours"
              min="0.5"
              step="0.5"
              type="number"
              value={editor.capacityMinutes / 60}
              onChange={(event) => setEditor((current) => ({
                ...current,
                capacityMinutes: Math.max(0, Math.round(Number(event.currentTarget.value) * 60))
              }))}
            />
            <span>hours</span>
          </div>
        </label>
        <div className="plan-editor-capacity-result">
          <span>Remaining</span>
          <strong>{formatMinutes(Math.max(0, editor.capacityMinutes - plannedMinutes))}</strong>
        </div>
      </div>

      <div className="plan-editor-section-head">
        <div>
          <strong>Plan blocks</strong>
          <small>Task, project, duration</small>
        </div>
        <button type="button" onClick={addItem}>
          <Icon name="plus" />
          <span>Add block</span>
        </button>
      </div>

      <div className="plan-editor-list">
        {editor.items.map((item, index) => (
          <section className="plan-editor-item" key={item.id ?? `new-${index}`}>
            <div className="plan-editor-item-head">
              <span>{index + 1}</span>
              <strong>{item.title.trim() || "Untitled block"}</strong>
              <div className="plan-editor-item-actions">
                <button
                  className="remove"
                  type="button"
                  aria-label={`Remove ${item.title || "block"}`}
                  onClick={() => removeItem(index)}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
            <label className="plan-editor-title-field">
              <span>Title</span>
              <input
                aria-label={`Plan block ${index + 1} title`}
                maxLength={100}
                type="text"
                value={item.title}
                onChange={(event) => updateItem(index, { title: event.currentTarget.value })}
              />
            </label>
            <div className="plan-editor-item-fields">
              <label>
                <span>Project</span>
                <select
                  aria-label={`Plan block ${index + 1} project`}
                  value={item.projectId ?? ""}
                  onChange={(event) => updateItem(index, {
                    projectId: event.currentTarget.value ? Number(event.currentTarget.value) : null
                  })}
                >
                  <option value="">Flexible</option>
                  {orderedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}{project.status === "active" ? "" : ` (${project.status})`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Duration</span>
                <select
                  aria-label={`Plan block ${index + 1} duration`}
                  value={item.plannedMinutes}
                  onChange={(event) => updateItem(index, {
                    plannedMinutes: Number(event.currentTarget.value)
                  })}
                >
                  {!durationOptions.includes(item.plannedMinutes) ? (
                    <option value={item.plannedMinutes}>{formatMinutes(item.plannedMinutes)}</option>
                  ) : null}
                  {durationOptions.map((minutes) => (
                    <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        ))}
      </div>

      {editor.items.length === 0 ? (
        <div className="plan-editor-empty">
          <Icon name="target" />
          <span>No blocks planned</span>
        </div>
      ) : null}

      {operation.phase === "error" || operation.phase === "conflict" ? (
        <div className="plan-editor-error" role="alert">
          <Icon name="info" />
          <span>{operation.message}</span>
        </div>
      ) : null}

      <button className="plan-editor-save" type="submit" disabled={!canSave}>
        <Icon name="check" />
        <span>{operation.phase === "saving" ? "Saving" : "Save plan"}</span>
        <Icon name="chevronRight" />
      </button>
    </form>
  );
}

function SuggestionDetail({
  workspace,
  operation,
  onApply,
  onDismiss,
  onRestore,
  canUndo,
  onUndo
}: {
  workspace: PlanWorkspace;
  operation: OperationState;
  onApply: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  canUndo: boolean;
  onUndo: () => void;
}) {
  const proposal = buildPlanProposal(workspace);
  if (!workspace.suggestion) {
    return <StateSurface icon="book" title="No review suggestion yet" />;
  }
  if (workspace.suggestionStatus === "applied") {
    return (
      <StateSurface
        icon="check"
        title="Adjustment applied"
        actionLabel={canUndo ? "Undo" : undefined}
        actionIcon="activity"
        onAction={canUndo ? onUndo : undefined}
      />
    );
  }
  if (workspace.suggestionStatus === "dismissed") {
    return (
      <div className="detail-stack">
        <StateSurface
          icon="x"
          title="Suggestion dismissed"
          actionLabel="Restore"
          actionIcon="activity"
          onAction={onRestore}
        />
      </div>
    );
  }
  if (!proposal) {
    return <StateSurface icon="info" title="This adjustment has no plan change" />;
  }

  return (
    <div className="detail-stack plan-suggestion-detail">
      <span className="status-chip severity-attention">Suggested</span>
      <h2>{proposal.suggestion.title}</h2>
      <p>{proposal.suggestion.reason}</p>
      <div className="plan-diff" aria-label="Plan change">
        <div className="plan-diff-head"><span /><span>Before</span><span>After</span></div>
        <DiffRow
          label={proposal.suggestion.projectTitle ?? "Block"}
          before={formatMinutes(proposal.beforeProjectMinutes)}
          after={formatMinutes(proposal.afterProjectMinutes)}
        />
        <DiffRow
          label="Planned"
          before={formatMinutes(proposal.beforeMetrics.plannedMinutes)}
          after={formatMinutes(proposal.afterMetrics.plannedMinutes)}
        />
        <DiffRow
          label="Slack"
          before={formatNullableMinutes(proposal.beforeMetrics.slackMinutes)}
          after={formatNullableMinutes(proposal.afterMetrics.slackMinutes)}
        />
      </div>
      <div className="action-row">
        <button
          className="paper-action"
          type="button"
          disabled={operation.phase === "saving" || operation.phase === "undoing"}
          onClick={onApply}
        >
          {operation.phase === "saving" ? "Saving" : "Apply"}
        </button>
        <button
          className="paper-action subtle"
          type="button"
          disabled={operation.phase === "saving" || operation.phase === "undoing"}
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function DiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  return <div className="plan-diff-row"><strong>{label}</strong><span>{before}</span><span>{after}</span></div>;
}

function FocusDetail({
  workspace,
  projectNames,
  onReview,
  onFocusItem
}: {
  workspace: PlanWorkspace;
  projectNames: Map<number, string>;
  onReview: () => void;
  onFocusItem?: (item: PlanItem, projectTitle: string | null) => void;
}) {
  const items = [...workspace.draft.items].sort((a, b) => a.priority - b.priority);
  if (items.length === 0) {
    return (
      <StateSurface
        icon="target"
        title="No focus block yet"
        actionLabel="Open review"
        actionIcon="book"
        onAction={onReview}
      />
    );
  }
  const totalMinutes = items.reduce((sum, item) => sum + item.plannedMinutes, 0);
  return (
    <div className="plan-focus-detail">
      <div className="plan-detail-summary">
        <span aria-hidden="true"><Icon name="target" /></span>
        <div><strong>{items.length} blocks ready</strong><small>{formatMinutes(totalMinutes)} planned</small></div>
      </div>
      <div className="plan-item-list">
        {items.map((item, index) => (
          <button
            className="plan-item-row"
            type="button"
            aria-label={`Focus ${item.title}`}
            key={item.id ?? `${item.title}-${index}`}
            onClick={() => onFocusItem?.(item, item.projectId ? projectNames.get(item.projectId) ?? null : null)}
          >
            <span className="plan-item-priority">{item.priority}</span>
            <span><strong>{item.title}</strong><small>{item.projectId ? projectNames.get(item.projectId) ?? "Project" : "Flexible"}</small></span>
            <span className="plan-item-focus-action">
              <strong>{formatMinutes(item.plannedMinutes)}</strong>
              <Icon name="play" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SlackDetail({ metrics, onEdit }: { metrics: PlanMetrics; onEdit: () => void }) {
  return (
    <div className="detail-stack plan-slack-detail">
      <div
        className={`plan-slack-visual plan-status-${metrics.status}`}
        style={{ "--plan-load": `${loadPercent(metrics) * 3.6}deg` } as CSSProperties}
      >
        <span aria-hidden="true"><Icon name="gauge" /></span>
        <strong>{formatNullableMinutes(metrics.slackMinutes)}</strong>
        <small>Slack</small>
      </div>
      <div className="plan-slack-status">
        <span className={`status-chip plan-status-${metrics.status}`}>{balanceLabel(metrics.status)}</span>
        <strong>{slackGuidance(metrics.status)}</strong>
      </div>
      <dl className="plan-metric-grid">
        <div><dt>Planned</dt><dd>{formatMinutes(metrics.plannedMinutes)}</dd></div>
        <div><dt>Capacity</dt><dd>{formatMinutesOrDash(metrics.capacityMinutes)}</dd></div>
        <div><dt>Target buffer</dt><dd>{formatNullableMinutes(metrics.requiredSlackMinutes)}</dd></div>
      </dl>
      <button className="paper-action plan-slack-edit" type="button" onClick={onEdit}>
        <Icon name="calendar" />
        <span>Adjust plan</span>
      </button>
    </div>
  );
}

function ProjectsDetail({ workspace }: { workspace: PlanWorkspace }) {
  if (workspace.projects.length === 0) {
    return <StateSurface icon="folder" title="No projects linked yet" />;
  }
  const totalMinutes = workspace.projects.reduce(
    (total, project) => total + projectMinutes(workspace.draft, project.id),
    0
  );
  return (
    <div className="plan-project-detail">
      <div className="plan-detail-summary">
        <span aria-hidden="true"><Icon name="folder" /></span>
        <div><strong>{workspace.projects.length} projects</strong><small>{formatMinutes(totalMinutes)} allocated</small></div>
      </div>
      <div className="plan-project-list">
        {workspace.projects.map((project) => {
          const planned = projectMinutes(workspace.draft, project.id);
          const progress = project.weeklyTargetMinutes > 0
            ? Math.min(100, Math.round(planned / project.weeklyTargetMinutes * 100))
            : 0;
          return (
            <div className="plan-project-row" key={project.id}>
              <span className={`project-stage-mark stage-${project.stage}`} aria-hidden="true" />
              <span>
                <strong>{project.title}</strong>
                <small>{stageLabel(project.stage)} · {formatMinutes(planned)} of {formatMinutes(project.weeklyTargetMinutes)}</small>
                <i aria-hidden="true"><b style={{ width: `${progress}%` }} /></i>
              </span>
              <strong>{progress}%</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function operationFailure(
  action: Exclude<OperationAction, null>,
  status: PlanApiStatus,
  detail: string | null
): OperationState {
  return status === "conflict"
    ? { phase: "conflict", action, message: "Plan changed elsewhere", detail }
    : {
        phase: "error",
        action,
        message: action === "undo" ? "Plan could not be restored" : "Plan could not be saved",
        detail
      };
}

function copyPlan(plan: PlanDraft): PlanDraft {
  return { ...plan, week: { ...plan.week }, items: plan.items.map((item) => ({ ...item })) };
}

function projectMinutes(plan: PlanDraft, projectId: number): number {
  return plan.items
    .filter((item) => item.projectId === projectId)
    .reduce((total, item) => total + item.plannedMinutes, 0);
}

function loadPercent(metrics: PlanMetrics): number {
  return metrics.loadRatio === null ? 0 : Math.min(100, Math.max(0, Math.round(metrics.loadRatio * 100)));
}

function balanceLabel(status: PlanMetrics["status"]): string {
  if (status === "balanced") return "Balanced";
  if (status === "tight") return "Tight";
  if (status === "overloaded") return "Overloaded";
  return "Capacity needed";
}

function slackGuidance(status: PlanMetrics["status"]): string {
  if (status === "balanced") return "Buffer protected";
  if (status === "tight") return "Reduce one block";
  if (status === "overloaded") return "Plan exceeds capacity";
  return "Set weekly capacity";
}

function planCharacter(status: PlanMetrics["status"]): string {
  if (status === "balanced") return characterSteadyUrl;
  if (status === "unknown") return characterLoadingUrl;
  return characterWaitingUrl;
}

function operationIcon(phase: OperationPhase): "check" | "info" | "activity" {
  if (phase === "saved" || phase === "undone") return "check";
  if (phase === "saving" || phase === "undoing") return "activity";
  return "info";
}

function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  if (hours === 0) return `${sign}${rest}m`;
  return rest === 0 ? `${sign}${hours}h` : `${sign}${hours}h ${rest}m`;
}

function formatMinutesOrDash(minutes: number): string {
  return minutes > 0 ? formatMinutes(minutes) : "-";
}

function formatNullableMinutes(minutes: number | null): string {
  return minutes === null ? "-" : formatMinutes(minutes);
}

function formatSignedMinutes(minutes: number): string {
  return `${minutes > 0 ? "+" : ""}${formatMinutes(minutes)}`;
}

function stageLabel(stage: PlanWorkspace["projects"][number]["stage"]): string {
  if (stage === "wake_up") return "Wake-up";
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

function detailTitle(detail: PlanDetail | null): string {
  if (detail === "edit") return "Edit plan";
  if (detail === "suggestion") return "Adjustment";
  if (detail === "focus") return "Focus";
  if (detail === "slack") return "Slack";
  if (detail === "projects") return "Projects";
  return "Plan";
}
