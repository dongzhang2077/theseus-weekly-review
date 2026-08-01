import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AppWeekSource, FetchLike } from "../../shared/api/loadAppWeek";
import {
  deletePlan,
  loadPlanRecords,
  savePlanDraft,
  type PlanApiStatus
} from "../../shared/api/planApi";
import { loadTasks } from "../../shared/api/tasks";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { IconButton } from "../../shared/components/IconButton";
import { StateSurface } from "../../shared/components/StateSurface";
import type { TaskRecord } from "../../shared/domain/task";
import { Icon } from "../../shared/icons/Icon";
import {
  TaskWorkspace,
  type TaskLoadPhase
} from "../tasks/TaskWorkspace";
import {
  buildPlanProposal,
  calculatePlanMetrics,
  createPlanWorkspace,
  createUpcomingPlanSeed,
  dismissPlanSuggestion,
  formatPlanWeek,
  planSeedForTarget,
  planTargetWeekForDate,
  planWeekContainingDate,
  shiftPlanWeek,
  withPlanSuggestion,
  type PlanDateRange,
  type PlanDraft,
  type PlanItem,
  type PlanMetrics,
  type PlanSuggestion,
  type PlanWorkspace
} from "./planModel";

export type PlanDetail = "edit" | "suggestion" | "focus" | "slack" | "projects" | "tasks";
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
  accountToday?: string;
  apiBaseUrl?: string;
  entryRequest: {
    id: number;
    detail: PlanDetail;
    suggestion?: PlanSuggestion;
  } | null;
  onReview: () => void;
  onFocusItem?: (item: PlanItem, projectTitle: string | null) => void;
  onDetailOpenChange?: (open: boolean) => void;
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
  planData,
  reviewSource,
  accountToday,
  entryRequest,
  onFocusItem,
  onDetailOpenChange,
  fetchImpl
}: PlanScreenProps) {
  const hasLiveApi = Boolean(apiBaseUrl);
  const initialSeed = hasLiveApi && reviewSource !== "api"
    ? createUpcomingPlanSeed()
    : planData;
  const defaultTargetWeek = accountToday
    ? planTargetWeekForDate(accountToday)
    : initialSeed.targetWeek;
  const [targetWeek, setTargetWeek] = useState<PlanDateRange>(() => ({
    ...defaultTargetWeek
  }));
  const [workspace, setWorkspace] = useState<PlanWorkspace>(() => {
    const initialWorkspace = createPlanWorkspace(
      planSeedForTarget(initialSeed, defaultTargetWeek)
    );
    return entryRequest?.suggestion
      ? withPlanSuggestion(initialWorkspace, entryRequest.suggestion)
      : initialWorkspace;
  });
  const [loadPhase, setLoadPhase] = useState<LoadPhase>(hasLiveApi ? "loading" : "ready");
  const [taskLoadPhase, setTaskLoadPhase] = useState<TaskLoadPhase>(hasLiveApi ? "loading" : "ready");
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [taskReload, setTaskReload] = useState(0);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [operation, setOperation] = useState<OperationState>(idleOperation);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const [reload, setReload] = useState(0);
  const metrics = useMemo(() => calculatePlanMetrics(workspace.draft), [workspace.draft]);
  const proposal = useMemo(() => buildPlanProposal(workspace), [workspace]);
  const writeLocked =
    operation.phase === "saving" || operation.phase === "undoing";
  const applyLocked =
    writeLocked ||
    operation.phase === "conflict" ||
    metrics.capacityMinutes <= 0;
  const projectNames = useMemo(
    () => new Map(workspace.projects.map((project) => [project.id, project.title])),
    [workspace.projects]
  );
  const activeTaskCount = tasks.filter(
    (task) =>
      task.archivedAt === null &&
      (task.status === "open" || task.status === "in_progress")
  ).length;

  useEffect(() => {
    const baseSeed = hasLiveApi && reviewSource !== "api"
      ? createUpcomingPlanSeed()
      : planData;
    const seed = planSeedForTarget(baseSeed, targetWeek);
    if (!hasLiveApi) {
      const nextWorkspace = createPlanWorkspace(seed);
      setWorkspace(entryRequest?.suggestion
        ? withPlanSuggestion(nextWorkspace, entryRequest.suggestion)
        : nextWorkspace);
      setLoadPhase("ready");
      setOperation(idleOperation);
      setUndoSnapshot(null);
      return;
    }

    let ignore = false;
    setLoadPhase("loading");
    loadPlanRecords({ apiBaseUrl, fetchImpl }).then((result) => {
      if (ignore) return;
      if (result.status !== "ok" || !result.data) {
        setLoadPhase("error");
        return;
      }
      const nextWorkspace = createPlanWorkspace(seed, result.data);
      setWorkspace(entryRequest?.suggestion
        ? withPlanSuggestion(nextWorkspace, entryRequest.suggestion)
        : nextWorkspace);
      setLoadPhase("ready");
      setOperation(idleOperation);
      setUndoSnapshot(null);
    });

    return () => {
      ignore = true;
    };
  }, [
    apiBaseUrl,
    fetchImpl,
    hasLiveApi,
    planData,
    reload,
    reviewSource,
    targetWeek
  ]);

  useEffect(() => {
    if (!hasLiveApi) {
      setTasks([]);
      setTaskLoadPhase("ready");
      return;
    }
    let ignore = false;
    setTaskLoadPhase("loading");
    loadTasks({ apiBaseUrl, fetchImpl, includeArchived: true }).then((result) => {
      if (ignore) return;
      if (result.status === "ok" && result.data) {
        setTasks(result.data);
        setTaskLoadPhase("ready");
        return;
      }
      setTaskLoadPhase("error");
    });
    return () => {
      ignore = true;
    };
  }, [apiBaseUrl, fetchImpl, hasLiveApi, taskReload]);

  useEffect(() => {
    if (!entryRequest) return;
    if (entryRequest.suggestion) {
      setWorkspace((current) => withPlanSuggestion(current, entryRequest.suggestion as PlanSuggestion));
    }
    setDetail(entryRequest.detail);
  }, [entryRequest]);

  useEffect(() => {
    onDetailOpenChange?.(detail !== null && loadPhase === "ready");
  }, [detail, loadPhase, onDetailOpenChange]);

  useEffect(() => () => onDetailOpenChange?.(false), [onDetailOpenChange]);

  async function applySuggestion() {
    if (!proposal || applyLocked) return;
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
    setOperation({
      phase: "saved",
      action: "apply",
      message: "Plan saved and verified",
      detail: null
    });
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

    const result = await savePlanDraft({ apiBaseUrl, draft: nextDraft, fetchImpl });
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
    setOperation({
      phase: "saved",
      action: "manual",
      message: "Plan saved and verified",
      detail: null
    });
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
    const result = await deletePlan({ apiBaseUrl, planId, fetchImpl });
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

  function changeTargetWeek(nextWeek: PlanDateRange) {
    if (writeLocked) return;
    setDetail(null);
    setOperation(idleOperation);
    setUndoSnapshot(null);
    setTargetWeek({ ...nextWeek });
  }

  return (
    <section className="relative min-h-full overflow-y-auto bg-desk-paper pb-6 font-work text-desk-ink">
      <header className="sticky top-0 z-10 border-b border-desk-line bg-desk-raised/95 px-2 py-1.5 backdrop-blur-sm">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px_44px] items-center">
          <IconButton
            label="Previous target week"
            icon="chevronLeft"
            disabled={writeLocked}
            onClick={() => changeTargetWeek(shiftPlanWeek(targetWeek, -1))}
          />
          <label className="relative flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-paper px-1 text-sm font-bold focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-desk-ink">
            <span className="truncate">{formatPlanWeek(targetWeek)}</span>
            <Icon name="calendar" className="size-4 shrink-0 text-desk-muted" />
            <input
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
              type="date"
              aria-label="Choose target week"
              value={targetWeek.start}
              disabled={writeLocked}
              onChange={(event) => {
                const selected = planWeekContainingDate(event.target.value);
                if (selected) changeTargetWeek(selected);
              }}
            />
          </label>
          <IconButton
            label="Next target week"
            icon="chevronRight"
            disabled={writeLocked}
            onClick={() => changeTargetWeek(shiftPlanWeek(targetWeek, 1))}
          />
          <IconButton
            label={workspace.persistedPlan ? "Edit plan" : "New plan"}
            icon={workspace.persistedPlan ? "fileText" : "plus"}
            disabled={loadPhase !== "ready" || writeLocked}
            onClick={() => setDetail("edit")}
          />
        </div>
        {targetWeek.start !== defaultTargetWeek.start ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="min-h-7 rounded-full px-3 text-xs font-semibold text-desk-accent hover:bg-desk-accent-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink disabled:cursor-not-allowed disabled:opacity-50"
              disabled={writeLocked}
              onClick={() => changeTargetWeek(defaultTargetWeek)}
            >
              Next week
            </button>
          </div>
        ) : null}
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
          {metrics.capacityMinutes <= 0 ? (
            <section className="rounded-paper border border-desk-warn/40 bg-desk-warn-soft/45 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="m-0 text-sm font-bold">Capacity needed</h2>
                  <p className="m-0 mt-1 text-xs text-desk-muted">
                    {formatMinutes(metrics.plannedMinutes)} planned
                  </p>
                </div>
                <button
                  className="min-h-10 rounded-paper border border-desk-warn/30 bg-desk-raised px-3 text-sm font-bold text-desk-warn"
                  type="button"
                  onClick={() => setDetail("edit")}
                >
                  Set capacity
                </button>
              </div>
            </section>
          ) : (
            <button
              className={`rounded-paper border px-4 py-3 text-left transition-colors duration-150 ${balanceSurfaceClass(metrics.status)}`}
              type="button"
              aria-label={`Week balance: ${balanceLabel(metrics.status)}`}
              onClick={() => setDetail("slack")}
            >
              <span className="flex items-start justify-between gap-4">
                <span>
                  <strong className="block text-xl tabular-nums">
                    {formatMinutes(metrics.plannedMinutes)}
                  </strong>
                  <small className="text-xs text-desk-muted">planned</small>
                </span>
                <span className="text-right">
                  <strong className="block text-xl tabular-nums">
                    {formatMinutes(metrics.capacityMinutes)}
                  </strong>
                  <small className="text-xs text-desk-muted">capacity</small>
                </span>
              </span>
              <span className="mt-3 block h-2 overflow-hidden rounded-full bg-desk-sunk" aria-hidden="true">
                <span
                  className={`block h-full rounded-full transition-[width] duration-200 ${balanceFillClass(metrics.status)}`}
                  style={{ width: `${loadPercent(metrics)}%` }}
                />
              </span>
              <span className="mt-2 flex items-center justify-between gap-3 text-xs">
                <strong>{formatNullableMinutes(metrics.slackMinutes)} protected slack</strong>
                <span className="flex items-center gap-1 text-desk-muted">
                  {balanceLabel(metrics.status)}
                  <Icon name="chevronRight" className="size-4" />
                </span>
              </span>
            </button>
          )}

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

          {proposal ? (
            <section className="overflow-hidden rounded-paper border border-desk-warn/35 bg-desk-raised shadow-paper" aria-labelledby="plan-adjustment-title">
              <button
                className="block w-full border-0 bg-transparent p-4 text-left transition-colors duration-150 hover:bg-desk-warn-soft/25"
                type="button"
                aria-label={`Suggested adjustment: ${proposal.suggestion.title}`}
                onClick={() => setDetail("suggestion")}
              >
                <span className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-desk-warn">
                  <span className="flex items-center gap-2"><Icon name="route" className="size-4" /> Adjustment</span>
                  <Icon name="chevronRight" className="size-4" />
                </span>
                <strong className="mt-3 block text-lg leading-snug" id="plan-adjustment-title">{proposal.suggestion.title}</strong>
                <small className="mt-1 block font-semibold text-desk-muted">
                  {proposal.suggestion.projectTitle ?? "Flexible block"} · {formatSignedMinutes(proposal.suggestion.deltaMinutes)}
                </small>
              </button>
              <div className="flex justify-end border-t border-desk-line px-3 py-2">
                <button
                  className="min-h-10 rounded-paper border border-desk-accent/25 bg-desk-accent-soft px-5 text-sm font-bold text-desk-accent disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="Apply adjustment"
                  disabled={applyLocked}
                  onClick={() => void applySuggestion()}
                >
                  {operation.phase === "saving" ? "Saving" : "Apply"}
                </button>
              </div>
            </section>
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
          ) : !workspace.persistedPlan ? (
            <section className="rounded-paper border border-desk-line bg-desk-raised p-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="m-0 text-base font-bold">No plan yet</h2>
                <button className="min-h-10 rounded-paper border border-desk-accent/25 bg-desk-accent-soft px-4 text-sm font-bold text-desk-accent" type="button" onClick={() => setDetail("edit")}>New</button>
              </div>
            </section>
          ) : null}

          <section
            className="overflow-hidden rounded-paper border border-desk-line bg-desk-raised shadow-paper"
            aria-label="Plan content"
          >
            {workspace.draft.items.length > 0 ? (
              <PlanCollectionRow
                label="Plan blocks"
                meta={`${workspace.draft.items.length} · ${formatMinutes(metrics.plannedMinutes)}`}
                icon="layers"
                ariaLabel="Open plan blocks"
                onClick={() => setDetail("focus")}
              />
            ) : null}
            <PlanCollectionRow
              label="Tasks"
              meta={
                taskLoadPhase === "loading"
                  ? "Loading"
                  : taskLoadPhase === "error"
                    ? "Unavailable"
                    : `${activeTaskCount} active`
              }
              icon="target"
              ariaLabel="Open tasks"
              onClick={() => setDetail("tasks")}
            />
          </section>
        </div>
      ) : null}

      <DetailPanel title={detailTitle(detail)} open={detail !== null && loadPhase === "ready"} onBack={() => setDetail(null)}>
        {detail === "edit" ? (
          <PlanEditor draft={workspace.draft} projects={workspace.projects} tasks={tasks} operation={operation} onSave={saveManualPlan} />
        ) : null}
        {detail === "suggestion" ? (
          <SuggestionDetail
            workspace={workspace}
            operation={operation}
            applyDisabled={applyLocked}
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
            onEdit={() => setDetail("edit")}
            onProjects={() => setDetail("projects")}
            onFocusItem={onFocusItem}
          />
        ) : null}
        {detail === "slack" ? <SlackDetail metrics={metrics} /> : null}
        {detail === "projects" ? <ProjectsDetail workspace={workspace} /> : null}
        {detail === "tasks" ? (
          <TaskWorkspace
            apiBaseUrl={apiBaseUrl}
            fetchImpl={fetchImpl}
            phase={taskLoadPhase}
            tasks={tasks}
            projects={workspace.projects}
            onTasksChange={setTasks}
            onRetry={() => setTaskReload((value) => value + 1)}
          />
        ) : null}
      </DetailPanel>
    </section>
  );
}

function PlanCollectionRow({
  label,
  meta,
  icon,
  ariaLabel,
  onClick
}: {
  label: string;
  meta: string;
  icon: "layers" | "target";
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      className="grid min-h-14 w-full grid-cols-[32px_minmax(0,1fr)_auto_auto] items-center gap-3 border-0 border-b border-desk-line bg-transparent px-4 text-left last:border-b-0 hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-desk-ink"
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className="grid size-8 place-items-center rounded-full bg-desk-sunk text-desk-muted">
        <Icon name={icon} className="size-4" />
      </span>
      <strong className="min-w-0 text-sm">{label}</strong>
      <span className="text-sm tabular-nums text-desk-muted">{meta}</span>
      <Icon name="chevronRight" className="size-4 text-desk-subtle" />
    </button>
  );
}

function PlanEditor({
  draft,
  projects,
  tasks,
  operation,
  onSave
}: {
  draft: PlanDraft;
  projects: PlanWorkspace["projects"];
  tasks: TaskRecord[];
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
          taskId: null,
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
    <form className="grid min-w-0 gap-5 overflow-x-clip" onSubmit={submit}>
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

      <label className="grid min-w-0 gap-1 text-sm font-semibold">
        <span>Weekly capacity</span>
        <span className="flex min-w-0 items-center rounded-paper border border-desk-line bg-desk-raised px-3">
          <input
            className="min-h-11 min-w-0 flex-1 border-0 bg-transparent outline-none"
            aria-label="Weekly capacity hours"
            min="0.5"
            step="0.5"
            type="number"
            value={editor.capacityMinutes / 60}
            onChange={(event) => {
              const capacityHours = event.currentTarget.valueAsNumber;
              const capacityMinutes = Number.isFinite(capacityHours)
                ? Math.max(0, Math.round(capacityHours * 60))
                : 0;
              setEditor((current) => ({
                ...current,
                capacityMinutes
              }));
            }}
          />
          <span className="text-sm text-desk-muted">hours</span>
        </span>
      </label>

      <section className="min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="m-0 text-sm font-bold">Plan blocks</h2>
            <p className="m-0 text-xs text-desk-muted">Task, project, duration</p>
          </div>
          <button className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-paper border border-desk-line bg-desk-raised px-3 text-sm font-bold text-desk-muted" type="button" onClick={addItem}>
            <Icon name="plus" className="size-4" /> Add block
          </button>
        </div>
        <div className="grid min-w-0 gap-3">
          {editor.items.map((item, index) => (
            <section className="min-w-0 rounded-paper border border-desk-line bg-desk-raised p-3" key={item.id ?? `new-${index}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong className="text-sm">Block {index + 1}</strong>
                <button className="grid size-8 place-items-center rounded-full border-0 bg-transparent text-desk-danger hover:bg-desk-danger-soft" type="button" aria-label={`Remove ${item.title || "block"}`} onClick={() => removeItem(index)}>
                  <Icon name="trash" className="size-4" />
                </button>
              </div>
              <div className="grid min-w-0 gap-3">
                <label className="grid min-w-0 gap-1 text-xs font-semibold text-desk-muted">
                  <span>Task</span>
                  <select
                    className="min-h-10 w-full min-w-0 max-w-full rounded-paper border border-desk-line bg-desk-paper px-2 text-sm text-desk-ink"
                    aria-label={`Plan block ${index + 1} task`}
                    value={item.taskId ?? ""}
                    onChange={(event) => {
                      const taskId = event.currentTarget.value
                        ? Number(event.currentTarget.value)
                        : null;
                      const task = tasks.find((candidate) => candidate.id === taskId);
                      updateItem(index, task
                        ? {
                            taskId: task.id,
                            projectId: task.projectId,
                            title: task.title
                          }
                        : { taskId: null });
                    }}
                  >
                    <option value="">Ad hoc</option>
                    {item.taskId && !tasks.some((task) => task.id === item.taskId) ? (
                      <option value={item.taskId}>Linked task #{item.taskId}</option>
                    ) : null}
                    {tasks
                      .filter((task) =>
                        task.id === item.taskId ||
                        (
                          task.archivedAt === null &&
                          (task.status === "open" || task.status === "in_progress")
                        )
                      )
                      .map((task) => (
                        <option value={task.id} key={task.id}>{task.title}</option>
                      ))}
                  </select>
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-semibold text-desk-muted">
                  <span>Title</span>
                  <input
                    className="min-h-10 w-full min-w-0 max-w-full rounded-paper border border-desk-line bg-desk-paper px-3 text-sm text-desk-ink"
                    aria-label={`Plan block ${index + 1} title`}
                    value={item.title}
                    onChange={(event) => updateItem(index, { title: event.currentTarget.value })}
                  />
                </label>
                <div
                  className="grid min-w-0 grid-cols-1 gap-3 min-[390px]:grid-cols-[minmax(0,1fr)_96px]"
                  data-testid={`plan-block-fields-${index + 1}`}
                >
                  <label className="grid min-w-0 gap-1 text-xs font-semibold text-desk-muted">
                    <span>Project</span>
                    <select
                      className="min-h-10 w-full min-w-0 max-w-full rounded-paper border border-desk-line bg-desk-paper px-2 text-sm text-desk-ink"
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
                  <label className="grid min-w-0 gap-1 text-xs font-semibold text-desk-muted">
                    <span>Minutes</span>
                    <input
                      className="min-h-10 w-full min-w-0 max-w-full rounded-paper border border-desk-line bg-desk-paper px-3 text-sm text-desk-ink"
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
  applyDisabled,
  onApply,
  onDismiss,
  onRestore,
  canUndo,
  onUndo
}: {
  workspace: PlanWorkspace;
  operation: OperationState;
  applyDisabled: boolean;
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
          disabled={applyDisabled}
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
  onEdit,
  onProjects,
  onFocusItem
}: {
  workspace: PlanWorkspace;
  projectNames: Map<number, string>;
  onEdit: () => void;
  onProjects: () => void;
  onFocusItem?: (item: PlanItem, projectTitle: string | null) => void;
}) {
  const items = [...workspace.draft.items].sort((a, b) => a.priority - b.priority);
  if (items.length === 0) {
    return (
      <StateSurface
        icon="target"
        title="No focus block yet"
        actionLabel="New"
        actionIcon="plus"
        onAction={onEdit}
      />
    );
  }
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-desk-muted">{items.length} blocks</span>
        <div className="flex items-center gap-2">
          <button className="min-h-9 rounded-paper border border-desk-line bg-desk-raised px-3 text-sm font-bold text-desk-muted" type="button" onClick={onProjects}>Projects</button>
          <button className="min-h-9 rounded-paper border border-desk-accent/25 bg-desk-accent-soft px-3 text-sm font-bold text-desk-accent" type="button" onClick={onEdit}>Edit</button>
        </div>
      </div>
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
        message: action === "undo" ? "Plan could not be restored" : "Plan was not saved",
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
  if (detail === "tasks") return "Tasks";
  return "Plan";
}
