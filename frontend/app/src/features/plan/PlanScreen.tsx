import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
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

  async function saveManualPlan(nextDraft: PlanDraft): Promise<boolean> {
    if (operation.phase === "saving" || operation.phase === "undoing") return false;
    const snapshot: UndoSnapshot = {
      before: workspace.persistedPlan ? copyPlan(workspace.persistedPlan) : null,
      baseline: copyPlan(workspace.draft),
      appliedPlanId: null
    };
    setOperation({ phase: "saving", action: "manual", message: "Saving plan", detail: null });

    if (!hasLiveApi) {
      const savedDraft = copyPlan(nextDraft);
      setWorkspace((current) => ({
        ...current,
        draft: savedDraft,
        persistedPlan: savedDraft
      }));
      setUndoSnapshot(snapshot);
      setOperation({ phase: "saved", action: "manual", message: "Sample plan updated", detail: null });
      setDetail(null);
      return true;
    }

    const result = await savePlanDraft({ apiBaseUrl, userId, draft: nextDraft, fetchImpl });
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
    setOperation({ phase: "saved", action: "manual", message: "Plan updated", detail: null });
    setDetail(null);
    return true;
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
    else if (operation.action === "apply") void applySuggestion();
  }

  return (
    <section className="relative min-h-full overflow-y-auto bg-desk-paper pb-6 font-work text-desk-ink">
      <header className="grid h-[52px] grid-cols-[44px_1fr_44px] items-center border-b border-desk-line bg-desk-raised/90 px-3">
        <span aria-hidden="true" />
        <h1 className="m-0 truncate text-center text-[17px] font-bold">{formatPlanWeek(workspace.draft.week)}</h1>
        <button
          className="grid size-10 place-items-center rounded-full border-0 bg-transparent text-desk-muted hover:bg-desk-sunk"
          type="button"
          aria-label="Edit plan"
          onClick={() => setDetail("edit")}
        >
          <Icon name="plus" className="size-5" />
        </button>
      </header>

      {loadPhase === "loading" ? (
        <div className="min-h-[560px]"><StateSurface icon="calendar" title="Loading plan" /></div>
      ) : null}

      {loadPhase === "error" ? (
        <div className="min-h-[560px]">
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
        <div className="mx-auto grid w-full gap-4 px-4 py-4">
          <div className="flex flex-col gap-4">
            <button
              className={`rounded-paper border p-4 text-left shadow-paper transition-colors duration-150 ${balanceSurfaceClass(metrics.status)}`}
              type="button"
              aria-label={`Week balance: ${balanceLabel(metrics.status)}`}
              onClick={() => setDetail("slack")}
            >
              <span className="flex items-center justify-between gap-3">
                <span>
                  <small className="block text-xs font-bold uppercase tracking-wide text-desk-muted">Week balance</small>
                  <strong className="mt-1 block text-xl">{balanceLabel(metrics.status)}</strong>
                </span>
                <Icon name="chevronRight" className="size-5 text-desk-muted" />
              </span>
              <span className="mt-4 block h-1.5 overflow-hidden rounded-full bg-desk-sunk" aria-hidden="true">
                <span
                  className={`block h-full rounded-full transition-[width] duration-200 ${balanceFillClass(metrics.status)}`}
                  style={{ width: `${loadPercent(metrics)}%` }}
                />
              </span>
              <span className="mt-4 grid grid-cols-3 divide-x divide-desk-line">
                <Metric label="Planned" value={formatMinutes(metrics.plannedMinutes)} />
                <Metric label="Capacity" value={formatMinutesOrDash(metrics.capacityMinutes)} />
                <Metric label="Slack" value={formatNullableMinutes(metrics.slackMinutes)} />
              </span>
            </button>

            {operation.phase !== "idle" ? (
              <div
                className={`flex min-h-11 items-center gap-2 rounded-paper px-3 py-2 text-sm font-semibold ${operationSurfaceClass(operation.phase)}`}
                role={operation.phase === "error" || operation.phase === "conflict" ? "alert" : "status"}
                title={operation.detail ?? undefined}
              >
                <Icon name={operationIcon(operation.phase)} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">{operation.message}</span>
                {operation.phase === "saved" && undoSnapshot && detail !== "suggestion" ? (
                  <button className="rounded-paper border-0 bg-transparent px-2 py-1 font-bold underline-offset-2 hover:underline" type="button" onClick={() => void undoAdjustment()}>Undo</button>
                ) : null}
                {operation.phase === "error" && operation.action !== "manual" ? (
                  <button className="rounded-paper border-0 bg-transparent px-2 py-1 font-bold underline-offset-2 hover:underline" type="button" onClick={retryOperation}>Retry</button>
                ) : null}
                {operation.phase === "conflict" ? (
                  <button className="rounded-paper border-0 bg-transparent px-2 py-1 font-bold underline-offset-2 hover:underline" type="button" onClick={() => setReload((value) => value + 1)}>Reload</button>
                ) : null}
              </div>
            ) : null}

            {workspace.draft.items.length > 0 ? (
              <section aria-labelledby="planned-blocks-title">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="m-0 text-sm font-bold" id="planned-blocks-title">Plan blocks</h2>
                  <button className="border-0 bg-transparent text-xs font-bold text-desk-accent" type="button" onClick={() => setDetail("focus")}>View all</button>
                </div>
                <div className="divide-y divide-desk-line border-y border-desk-line">
                  {[...workspace.draft.items]
                    .sort((left, right) => left.priority - right.priority)
                    .slice(0, 3)
                    .map((item, index) => (
                      <button
                        className="grid min-h-14 w-full grid-cols-[28px_1fr_auto] items-center gap-3 border-0 bg-transparent py-2 text-left hover:bg-desk-sunk disabled:cursor-default"
                        type="button"
                        key={item.id ?? `${item.title}-${index}`}
                        aria-label={`Focus ${item.title}`}
                        disabled={!onFocusItem}
                        onClick={() => onFocusItem?.(item, item.projectId ? projectNames.get(item.projectId) ?? null : null)}
                      >
                        <span className="grid size-7 place-items-center rounded-full bg-desk-sunk text-xs font-bold text-desk-muted">{item.priority}</span>
                        <span className="min-w-0">
                          <strong className="block truncate text-sm">{item.title}</strong>
                          <small className="block truncate text-desk-muted">{item.projectId ? projectNames.get(item.projectId) ?? "Project" : "Flexible"}</small>
                        </span>
                        <span className="flex items-center gap-2 font-bold">
                          {formatMinutes(item.plannedMinutes)}
                          {onFocusItem ? <Icon name="play" className="size-4 text-desk-accent" /> : null}
                        </span>
                      </button>
                    ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            {proposal ? (
              <button
                className="rounded-paper border border-desk-line bg-desk-raised p-4 text-left shadow-paper transition-colors duration-150 hover:border-desk-warn"
                type="button"
                aria-label={`Suggested adjustment: ${proposal.suggestion.title}`}
                onClick={() => setDetail("suggestion")}
              >
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-desk-warn">
                  <Icon name="route" className="size-4" /> Suggested adjustment
                </span>
                <strong className="mt-3 block text-lg leading-snug">{proposal.suggestion.title}</strong>
                <small className="mt-1 block font-semibold text-desk-muted">
                  {proposal.suggestion.projectTitle ?? "Flexible block"} · {formatSignedMinutes(proposal.suggestion.deltaMinutes)}
                </small>
                <p className="mt-3 line-clamp-2 text-sm leading-5 text-desk-muted">{proposal.suggestion.reason}</p>
                <span className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-paper bg-desk-sunk px-3 py-2 text-center text-xs">
                  <span><small className="block text-desk-muted">Before</small><strong>{formatMinutes(proposal.beforeMetrics.plannedMinutes)}</strong></span>
                  <Icon name="chevronRight" className="size-4 text-desk-subtle" />
                  <span><small className="block text-desk-muted">After</small><strong>{formatMinutes(proposal.afterMetrics.plannedMinutes)}</strong></span>
                </span>
              </button>
            ) : workspace.suggestionStatus === "applied" ? (
              <button className="flex min-h-14 items-center gap-3 rounded-paper border border-desk-line bg-desk-accent-soft px-3 text-left text-desk-accent" type="button" onClick={() => setDetail("suggestion")}>
                <Icon name="check" className="size-5" />
                <span className="flex-1"><strong className="block text-sm">Adjustment applied</strong><small>Saved in this week</small></span>
                <Icon name="chevronRight" className="size-4" />
              </button>
            ) : workspace.suggestionStatus === "dismissed" && workspace.suggestion ? (
              <button className="flex min-h-14 items-center gap-3 rounded-paper border border-desk-line bg-desk-raised px-3 text-left" type="button" onClick={() => setDetail("suggestion")}>
                <Icon name="x" className="size-5 text-desk-muted" />
                <span className="flex-1"><strong className="block text-sm">Suggestion dismissed</strong><small className="text-desk-muted">Restore when useful</small></span>
                <Icon name="chevronRight" className="size-4 text-desk-muted" />
              </button>
            ) : (
              <section className="rounded-paper border border-desk-line bg-desk-raised p-4">
                <h2 className="m-0 text-base font-bold">Set this week up</h2>
                <p className="mt-1 text-sm text-desk-muted">Start manually or review last week first.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="min-h-10 rounded-paper border-0 bg-desk-accent px-3 text-sm font-bold text-white" type="button" onClick={() => setDetail("edit")}>Edit plan</button>
                  <button className="min-h-10 rounded-paper border border-desk-line bg-transparent px-3 text-sm font-bold text-desk-muted" type="button" onClick={onReview}>Open review</button>
                </div>
              </section>
            )}

            <div className="grid grid-cols-3 gap-2" aria-label="Plan actions">
              <PlanAction icon="plus" label="Edit plan" onClick={() => setDetail("edit")} />
              <PlanAction icon="target" label="Focus" onClick={() => setDetail("focus")} />
              <PlanAction icon="folder" label="Projects" onClick={() => setDetail("projects")} />
            </div>
          </div>
        </div>
      ) : null}

      <DetailPanel title={detailTitle(detail)} open={detail !== null && loadPhase === "ready"} onBack={() => setDetail(null)}>
        {detail === "edit" ? (
          <PlanEditor draft={workspace.draft} projects={workspace.projects} operation={operation} onSave={saveManualPlan} />
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
          <FocusDetail workspace={workspace} projectNames={projectNames} onReview={onReview} onFocusItem={onFocusItem} />
        ) : null}
        {detail === "slack" ? <SlackDetail metrics={metrics} /> : null}
        {detail === "projects" ? <ProjectsDetail workspace={workspace} /> : null}
      </DetailPanel>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="px-2 first:pl-0 last:pr-0">
      <small className="block text-xs text-desk-muted">{label}</small>
      <strong className="mt-1 block tabular-nums text-base">{value}</strong>
    </span>
  );
}

function PlanAction({
  icon,
  label,
  onClick
}: {
  icon: "plus" | "target" | "folder";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-paper border border-desk-line bg-desk-raised px-2 text-xs font-bold text-desk-muted transition-colors duration-150 hover:bg-desk-sunk hover:text-desk-ink"
      type="button"
      onClick={onClick}
    >
      <Icon name={icon} className="size-5" />
      <span>{label}</span>
    </button>
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
  const invalidItems = editor.items.some((item) => !item.title.trim() || item.plannedMinutes <= 0);
  const canSave = editor.capacityMinutes > 0 && !invalidItems && operation.phase !== "saving";
  const plannedMinutes = editor.items.reduce((total, item) => total + item.plannedMinutes, 0);

  function updateItem(index: number, patch: Partial<PlanItem>) {
    setEditor((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    }));
  }

  function addItem() {
    const project = projects.find((item) => item.status === "active") ?? projects[0] ?? null;
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
    <form className="grid gap-5" onSubmit={submit}>
      <section className="rounded-paper bg-desk-sunk p-3">
        <div className="flex items-center justify-between gap-4">
          <span>
            <small className="block text-xs font-bold uppercase tracking-wide text-desk-muted">Planned</small>
            <strong className="mt-1 block text-lg">{formatMinutes(plannedMinutes)}</strong>
          </span>
          <span className="text-right">
            <small className="block text-xs font-bold uppercase tracking-wide text-desk-muted">Remaining</small>
            <strong className="mt-1 block text-lg">{formatMinutes(Math.max(0, editor.capacityMinutes - plannedMinutes))}</strong>
          </span>
        </div>
      </section>

      <label className="grid gap-1 text-sm font-semibold">
        <span>Weekly capacity</span>
        <span className="flex items-center rounded-paper border border-desk-line bg-desk-raised px-3">
          <input
            className="min-h-11 min-w-0 flex-1 border-0 bg-transparent outline-none"
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
          <span className="text-sm text-desk-muted">hours</span>
        </span>
      </label>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="m-0 text-sm font-bold">Plan blocks</h2>
            <p className="m-0 text-xs text-desk-muted">Task, project, duration</p>
          </div>
          <button className="inline-flex min-h-9 items-center gap-1 rounded-paper border border-desk-line bg-desk-raised px-3 text-sm font-bold text-desk-muted" type="button" onClick={addItem}>
            <Icon name="plus" className="size-4" /> Add block
          </button>
        </div>
        <div className="grid gap-3">
          {editor.items.map((item, index) => (
            <section className="rounded-paper border border-desk-line bg-desk-raised p-3" key={item.id ?? `new-${index}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong className="text-sm">Block {index + 1}</strong>
                <button className="grid size-8 place-items-center rounded-full border-0 bg-transparent text-desk-danger hover:bg-desk-danger-soft" type="button" aria-label={`Remove ${item.title || "block"}`} onClick={() => removeItem(index)}>
                  <Icon name="trash" className="size-4" />
                </button>
              </div>
              <div className="grid gap-3">
                <label className="grid gap-1 text-xs font-semibold text-desk-muted">
                  <span>Title</span>
                  <input
                    className="min-h-10 rounded-paper border border-desk-line bg-desk-paper px-3 text-sm text-desk-ink"
                    aria-label={`Plan block ${index + 1} title`}
                    value={item.title}
                    onChange={(event) => updateItem(index, { title: event.currentTarget.value })}
                  />
                </label>
                <div className="grid grid-cols-[1fr_110px] gap-3">
                  <label className="grid gap-1 text-xs font-semibold text-desk-muted">
                    <span>Project</span>
                    <select
                      className="min-h-10 rounded-paper border border-desk-line bg-desk-paper px-2 text-sm text-desk-ink"
                      aria-label={`Plan block ${index + 1} project`}
                      value={item.projectId ?? ""}
                      onChange={(event) => updateItem(index, {
                        projectId: event.currentTarget.value ? Number(event.currentTarget.value) : null
                      })}
                    >
                      <option value="">Flexible</option>
                      {projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-desk-muted">
                    <span>Minutes</span>
                    <input
                      className="min-h-10 rounded-paper border border-desk-line bg-desk-paper px-3 text-sm text-desk-ink"
                      aria-label={`Plan block ${index + 1} duration`}
                      min="5"
                      step="5"
                      type="number"
                      value={item.plannedMinutes}
                      onChange={(event) => updateItem(index, { plannedMinutes: Math.max(0, Number(event.currentTarget.value)) })}
                    />
                  </label>
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>

      {operation.phase === "error" && operation.action === "manual" ? (
        <p className="m-0 rounded-paper bg-desk-danger-soft px-3 py-2 text-sm font-semibold text-desk-danger" role="alert">
          {operation.message}. Check the plan and try again.
        </p>
      ) : null}
      <button className="min-h-11 rounded-paper border-0 bg-desk-accent px-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-desk-sunk disabled:text-desk-subtle" type="submit" disabled={!canSave}>
        {operation.phase === "saving" && operation.action === "manual" ? "Saving" : "Save plan"}
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
      <div className="grid gap-4">
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
    <div className="grid gap-4">
      <span className="w-fit rounded-full bg-desk-warn-soft px-3 py-1 text-xs font-bold text-desk-warn">Suggested</span>
      <div>
        <h2 className="m-0 text-xl font-bold leading-snug">{proposal.suggestion.title}</h2>
        <p className="mt-2 text-sm leading-6 text-desk-muted">{proposal.suggestion.reason}</p>
      </div>
      <div className="overflow-hidden rounded-paper border border-desk-line" aria-label="Plan change">
        <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] gap-2 bg-desk-sunk px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-desk-muted">
          <span /><span>Before</span><span>After</span>
        </div>
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
      <div className="grid grid-cols-2 gap-2">
        <button
          className="min-h-11 rounded-paper border-0 bg-desk-accent px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={operation.phase === "saving" || operation.phase === "undoing"}
          onClick={onApply}
        >
          {operation.phase === "saving" ? "Saving" : "Apply"}
        </button>
        <button
          className="min-h-11 rounded-paper border border-desk-line bg-desk-raised px-4 font-bold text-desk-muted disabled:cursor-not-allowed disabled:opacity-50"
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
  return (
    <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-t border-desk-line px-3 py-2 text-right text-sm">
      <strong className="truncate text-left">{label}</strong>
      <span className="tabular-nums text-desk-muted">{before}</span>
      <span className="tabular-nums font-bold text-desk-accent">{after}</span>
    </div>
  );
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
  return (
    <div className="divide-y divide-desk-line border-y border-desk-line">
      {items.map((item, index) => (
        <button
          className="grid min-h-14 w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-0 bg-transparent py-2 text-left hover:bg-desk-sunk disabled:cursor-default"
          type="button"
          key={item.id ?? `${item.title}-${index}`}
          aria-label={`Focus ${item.title}`}
          disabled={!onFocusItem}
          onClick={() => onFocusItem?.(item, item.projectId ? projectNames.get(item.projectId) ?? null : null)}
        >
          <span className="grid size-7 place-items-center rounded-full bg-desk-sunk text-xs font-bold text-desk-muted">{item.priority}</span>
          <span className="min-w-0">
            <strong className="block truncate text-sm">{item.title}</strong>
            <small className="block truncate text-desk-muted">{item.projectId ? projectNames.get(item.projectId) ?? "Project" : "Flexible"}</small>
          </span>
          <span className="flex items-center gap-2 font-bold">
            {formatMinutes(item.plannedMinutes)}
            {onFocusItem ? <Icon name="play" className="size-4 text-desk-accent" /> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

function SlackDetail({ metrics }: { metrics: PlanMetrics }) {
  return (
    <div className="grid gap-4">
      <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${balanceChipClass(metrics.status)}`}>{balanceLabel(metrics.status)}</span>
      <h2 className="m-0 text-2xl font-bold">{formatNullableMinutes(metrics.slackMinutes)} slack</h2>
      <dl className="divide-y divide-desk-line border-y border-desk-line">
        <DetailMetric label="Planned" value={formatMinutes(metrics.plannedMinutes)} />
        <DetailMetric label="Capacity" value={formatMinutesOrDash(metrics.capacityMinutes)} />
        <DetailMetric label="Target buffer" value={formatNullableMinutes(metrics.requiredSlackMinutes)} />
      </dl>
    </div>
  );
}

function ProjectsDetail({ workspace }: { workspace: PlanWorkspace }) {
  if (workspace.projects.length === 0) {
    return <StateSurface icon="folder" title="No projects linked yet" />;
  }
  return (
    <div className="divide-y divide-desk-line border-y border-desk-line">
      {workspace.projects.map((project) => (
        <div className="grid min-h-14 grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-3 py-2" key={project.id}>
          <span className={`h-8 w-1.5 rounded-full ${stageMarkClass(project.stage)}`} aria-hidden="true" />
          <span className="min-w-0">
            <strong className="block truncate text-sm">{project.title}</strong>
            <small className="block text-desk-muted">{stageLabel(project.stage)}</small>
          </span>
          <strong className="tabular-nums">{formatMinutes(projectMinutes(workspace.draft, project.id))}</strong>
        </div>
      ))}
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-desk-muted">{label}</dt>
      <dd className="m-0 tabular-nums font-bold">{value}</dd>
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

function balanceSurfaceClass(status: PlanMetrics["status"]): string {
  if (status === "overloaded") return "border-desk-danger/40 bg-desk-danger-soft/45";
  if (status === "tight") return "border-desk-warn/40 bg-desk-warn-soft/45";
  if (status === "balanced") return "border-desk-accent/35 bg-desk-accent-soft/45";
  return "border-desk-line bg-desk-raised";
}

function balanceFillClass(status: PlanMetrics["status"]): string {
  if (status === "overloaded") return "bg-desk-danger";
  if (status === "tight") return "bg-desk-warn";
  if (status === "balanced") return "bg-desk-accent";
  return "bg-desk-subtle";
}

function balanceChipClass(status: PlanMetrics["status"]): string {
  if (status === "overloaded") return "bg-desk-danger-soft text-desk-danger";
  if (status === "tight") return "bg-desk-warn-soft text-desk-warn";
  if (status === "balanced") return "bg-desk-accent-soft text-desk-accent";
  return "bg-desk-sunk text-desk-muted";
}

function stageMarkClass(stage: PlanWorkspace["projects"][number]["stage"]): string {
  if (stage === "stable") return "bg-desk-accent";
  if (stage === "startup" || stage === "sprint") return "bg-desk-evidence";
  if (stage === "wake_up") return "bg-desk-warn";
  return "bg-desk-danger";
}

function operationSurfaceClass(phase: OperationPhase): string {
  if (phase === "error" || phase === "conflict") return "bg-desk-danger-soft text-desk-danger";
  if (phase === "saved" || phase === "undone") return "bg-desk-accent-soft text-desk-accent";
  return "bg-desk-evidence-soft text-desk-evidence";
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
  if (detail === "edit") return "Edit plan";
  if (detail === "suggestion") return "Adjustment";
  if (detail === "focus") return "Focus";
  if (detail === "slack") return "Slack";
  if (detail === "projects") return "Projects";
  return "Plan";
}
