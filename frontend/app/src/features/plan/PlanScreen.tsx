import { useEffect, useMemo, useState } from "react";
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
  type PlanMetrics,
  type PlanWorkspace
} from "./planModel";

export type PlanDetail = "suggestion" | "focus" | "slack" | "projects";
type LoadPhase = "loading" | "ready" | "error";
type OperationPhase = "idle" | "saving" | "saved" | "conflict" | "error" | "undoing" | "undone";
type OperationAction = "apply" | "undo" | null;

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
    else void applySuggestion();
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
              {operation.phase === "error" ? (
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
          <FocusDetail workspace={workspace} projectNames={projectNames} onReview={onReview} />
        ) : null}
        {detail === "slack" ? <SlackDetail metrics={metrics} /> : null}
        {detail === "projects" ? <ProjectsDetail workspace={workspace} /> : null}
      </DetailPanel>
    </section>
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
  onReview
}: {
  workspace: PlanWorkspace;
  projectNames: Map<number, string>;
  onReview: () => void;
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
  return (
    <div className="plan-item-list">
      {items.map((item, index) => (
        <div className="plan-item-row" key={item.id ?? `${item.title}-${index}`}>
          <span className="plan-item-priority">{item.priority}</span>
          <span><strong>{item.title}</strong><small>{item.projectId ? projectNames.get(item.projectId) ?? "Project" : "Flexible"}</small></span>
          <strong>{formatMinutes(item.plannedMinutes)}</strong>
        </div>
      ))}
    </div>
  );
}

function SlackDetail({ metrics }: { metrics: PlanMetrics }) {
  return (
    <div className="detail-stack">
      <span className={`status-chip plan-status-${metrics.status}`}>{balanceLabel(metrics.status)}</span>
      <h2>{formatNullableMinutes(metrics.slackMinutes)} slack</h2>
      <dl className="evidence-list">
        <div><dt>Planned</dt><dd>{formatMinutes(metrics.plannedMinutes)}</dd></div>
        <div><dt>Capacity</dt><dd>{formatMinutesOrDash(metrics.capacityMinutes)}</dd></div>
        <div><dt>Target buffer</dt><dd>{formatNullableMinutes(metrics.requiredSlackMinutes)}</dd></div>
      </dl>
    </div>
  );
}

function ProjectsDetail({ workspace }: { workspace: PlanWorkspace }) {
  if (workspace.projects.length === 0) {
    return <StateSurface icon="folder" title="No projects linked yet" />;
  }
  return (
    <div className="plan-project-list">
      {workspace.projects.map((project) => (
        <div className="plan-project-row" key={project.id}>
          <span className={`project-stage-mark stage-${project.stage}`} aria-hidden="true" />
          <span><strong>{project.title}</strong><small>{stageLabel(project.stage)}</small></span>
          <strong>{formatMinutes(projectMinutes(workspace.draft, project.id))}</strong>
        </div>
      ))}
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
  if (detail === "suggestion") return "Adjustment";
  if (detail === "focus") return "Focus";
  if (detail === "slack") return "Slack";
  if (detail === "projects") return "Projects";
  return "Plan";
}
