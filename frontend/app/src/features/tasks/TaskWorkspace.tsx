import { useState } from "react";
import type { FormEvent } from "react";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import { createTask, updateTask } from "../../shared/api/tasks";
import { IconButton } from "../../shared/components/IconButton";
import { StateSurface } from "../../shared/components/StateSurface";
import { Icon } from "../../shared/icons/Icon";
import type { PlanProject } from "../../shared/domain/plan";
import type {
  TaskCreateDraft,
  TaskRecord,
  TaskStatus,
  TaskUpdateDraft
} from "../../shared/domain/task";

export type TaskLoadPhase = "loading" | "ready" | "error";
type TaskFilter = "active" | "done" | "archive";
type TaskSelection = number | "new" | null;
type TaskOperation = "idle" | "saving" | "saved" | "conflict" | "error";

interface TaskWorkspaceProps {
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
  phase: TaskLoadPhase;
  tasks: TaskRecord[];
  projects: PlanProject[];
  onTasksChange: (tasks: TaskRecord[]) => void;
  onRetry: () => void;
}

export function TaskWorkspace({
  apiBaseUrl,
  fetchImpl,
  phase,
  tasks,
  projects,
  onTasksChange,
  onRetry
}: TaskWorkspaceProps) {
  const [selection, setSelection] = useState<TaskSelection>(null);
  const [filter, setFilter] = useState<TaskFilter>("active");
  const [operation, setOperation] = useState<TaskOperation>("idle");
  const [message, setMessage] = useState("");
  const selected = typeof selection === "number"
    ? tasks.find((task) => task.id === selection) ?? null
    : null;

  function finishMutation(task: TaskRecord, created: boolean) {
    onTasksChange(
      created
        ? [...tasks, task]
        : tasks.map((item) => item.id === task.id ? task : item)
    );
    setSelection(null);
    setOperation("saved");
    setMessage(created ? "Task created" : "Task saved");
  }

  async function saveNew(draft: TaskCreateDraft) {
    setOperation("saving");
    setMessage("");
    const result = await createTask({ apiBaseUrl, fetchImpl, draft });
    if (result.status === "ok" && result.data) {
      finishMutation(result.data, true);
      return;
    }
    setOperation("error");
    setMessage(result.error ?? "Task could not be created");
  }

  async function saveExisting(task: TaskRecord, draft: TaskUpdateDraft) {
    setOperation("saving");
    setMessage("");
    const result = await updateTask({
      apiBaseUrl,
      fetchImpl,
      taskId: task.id,
      draft
    });
    if (result.status === "ok" && result.data) {
      finishMutation(result.data, false);
      return;
    }
    if (result.status === "conflict" && result.current) {
      onTasksChange(
        tasks.map((item) => item.id === result.current?.id ? result.current : item)
      );
      setOperation("conflict");
      setMessage("Task changed. Review the latest version.");
      return;
    }
    setOperation("error");
    setMessage(result.error ?? "Task could not be saved");
  }

  if (phase === "loading") {
    return <StateSurface icon="target" title="Loading tasks" />;
  }
  if (phase === "error") {
    return (
      <StateSurface
        icon="info"
        title="Tasks could not load"
        actionLabel="Retry"
        actionIcon="activity"
        onAction={onRetry}
      />
    );
  }

  if (selection === "new") {
    if (projects.length === 0) {
      return (
        <div className="grid gap-4">
          <WorkspaceBack onClick={() => setSelection(null)} />
          <StateSurface icon="folder" title="Create a Project first" />
        </div>
      );
    }
    return (
      <div className="grid gap-4">
        <WorkspaceBack onClick={() => setSelection(null)} />
        <TaskForm
          key="new-task"
          projects={projects}
          operation={operation}
          message={message}
          onCreate={saveNew}
        />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="grid gap-4">
        <WorkspaceBack onClick={() => setSelection(null)} />
        <TaskForm
          key={`${selected.id}-${selected.version}`}
          projects={projects}
          task={selected}
          operation={operation}
          message={message}
          onUpdate={(draft) => saveExisting(selected, draft)}
        />
      </div>
    );
  }

  const visible = tasks.filter((task) => {
    if (filter === "archive") return task.archivedAt !== null;
    if (task.archivedAt !== null) return false;
    return filter === "active"
      ? task.status === "open" || task.status === "in_progress"
      : task.status === "completed" || task.status === "cancelled";
  });
  const projectNames = new Map(projects.map((project) => [project.id, project.title]));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-grid grid-cols-3 rounded-paper bg-desk-sunk p-1" aria-label="Task filter">
          {(["active", "done", "archive"] as const).map((value) => (
            <button
              className={`min-h-9 rounded-[0.55rem] border-0 px-3 text-xs font-bold capitalize ${
                filter === value
                  ? "bg-desk-raised text-desk-ink shadow-paper"
                  : "bg-transparent text-desk-muted"
              }`}
              type="button"
              aria-pressed={filter === value}
              key={value}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <IconButton label="New task" icon="plus" onClick={() => {
          setOperation("idle");
          setMessage("");
          setSelection("new");
        }} />
      </div>

      {operation === "saved" ? (
        <div className="flex min-h-10 items-center gap-2 rounded-paper bg-desk-accent-soft px-3 text-sm font-semibold text-desk-accent" role="status">
          <Icon name="check" className="size-4" />
          {message}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <StateSurface
          icon="target"
          title={filter === "active" ? "No active tasks" : filter === "done" ? "No finished tasks" : "No archived tasks"}
          actionLabel={filter === "active" ? "New" : undefined}
          actionIcon={filter === "active" ? "plus" : undefined}
          onAction={filter === "active" ? () => setSelection("new") : undefined}
        />
      ) : (
        <div className="divide-y divide-desk-line border-y border-desk-line">
          {visible.map((task) => (
            <button
              className="grid min-h-16 w-full grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-3 border-0 bg-transparent py-2 text-left hover:bg-desk-sunk"
              type="button"
              key={task.id}
              aria-label={`Open task ${task.title}`}
              onClick={() => {
                setOperation("idle");
                setMessage("");
                setSelection(task.id);
              }}
            >
              <span className={`h-9 w-1.5 rounded-full ${taskMarkClass(task)}`} aria-hidden="true" />
              <span className="min-w-0">
                <strong className="block line-clamp-2 text-sm leading-5">{task.title}</strong>
                <small className="mt-0.5 block truncate text-desk-muted">
                  {projectNames.get(task.projectId) ?? "Project"}
                  {task.dueDate ? ` · ${formatDueDate(task.dueDate)}` : ""}
                </small>
              </span>
              <span className="flex items-center gap-2">
                <small className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold ${taskChipClass(task)}`}>
                  {taskStatusLabel(task)}
                </small>
                <Icon name="chevronRight" className="size-4 text-desk-muted" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceBack({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-desk-line pb-3">
      <IconButton label="Back to tasks" icon="chevronLeft" onClick={onClick} />
      <strong className="text-sm">Tasks</strong>
    </div>
  );
}

function TaskForm({
  projects,
  task,
  operation,
  message,
  onCreate,
  onUpdate
}: {
  projects: PlanProject[];
  task?: TaskRecord;
  operation: TaskOperation;
  message: string;
  onCreate?: (draft: TaskCreateDraft) => Promise<void>;
  onUpdate?: (draft: TaskUpdateDraft) => Promise<void>;
}) {
  const project = projects.find((item) => item.id === task?.projectId) ?? projects[0];
  const [projectId, setProjectId] = useState(task?.projectId ?? project?.id ?? 0);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState(task?.priority ?? 3);
  const [estimate, setEstimate] = useState(task?.estimatedMinutes?.toString() ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "open");
  const saving = operation === "saving";
  const canSave = title.trim().length > 0 && projectId > 0 && !saving;
  const statuses = task ? availableStatuses(task.status) : ["open" as const];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    const estimatedMinutes = estimate ? Math.max(1, Number(estimate)) : null;
    if (task && onUpdate) {
      void onUpdate({
        expectedVersion: task.version,
        title: title.trim(),
        description: description.trim(),
        priority,
        estimatedMinutes,
        dueDate: dueDate || null,
        status
      });
      return;
    }
    if (onCreate) {
      void onCreate({
        projectId,
        title: title.trim(),
        description: description.trim(),
        priority,
        estimatedMinutes,
        dueDate: dueDate || null
      });
    }
  }

  function toggleArchive() {
    if (!task || !onUpdate || saving) return;
    void onUpdate({
      expectedVersion: task.version,
      archived: task.archivedAt === null
    });
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit}>
      {operation === "conflict" || operation === "error" ? (
        <p className="m-0 rounded-paper bg-desk-danger-soft px-3 py-2 text-sm font-semibold text-desk-danger" role="alert">
          {message}
        </p>
      ) : null}

      <label className="grid min-w-0 gap-1 text-sm font-semibold">
        <span>Project</span>
        {task ? (
          <span className="min-h-11 rounded-paper bg-desk-sunk px-3 py-3 text-desk-muted">
            {project?.title ?? "Project"}
          </span>
        ) : (
          <select
            className="min-h-11 w-full min-w-0 rounded-paper border border-desk-line bg-desk-raised px-3 text-desk-ink"
            aria-label="Task project"
            value={projectId}
            onChange={(event) => setProjectId(Number(event.currentTarget.value))}
          >
            {projects.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select>
        )}
      </label>

      <label className="grid min-w-0 gap-1 text-sm font-semibold">
        <span>Title</span>
        <input
          className="min-h-11 w-full min-w-0 rounded-paper border border-desk-line bg-desk-raised px-3"
          aria-label="Task title"
          maxLength={240}
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
      </label>

      <label className="grid min-w-0 gap-1 text-sm font-semibold">
        <span>Detail</span>
        <textarea
          className="min-h-20 w-full min-w-0 resize-y rounded-paper border border-desk-line bg-desk-raised px-3 py-2"
          aria-label="Task detail"
          maxLength={4000}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          <span>Minutes</span>
          <input
            className="min-h-11 w-full min-w-0 rounded-paper border border-desk-line bg-desk-raised px-3"
            aria-label="Task estimate"
            min="1"
            step="1"
            type="number"
            value={estimate}
            onChange={(event) => setEstimate(event.currentTarget.value)}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          <span>Priority</span>
          <input
            className="min-h-11 w-full min-w-0 rounded-paper border border-desk-line bg-desk-raised px-3"
            aria-label="Task priority"
            min="1"
            type="number"
            value={priority}
            onChange={(event) => setPriority(Math.max(1, Number(event.currentTarget.value)))}
          />
        </label>
      </div>

      <label className="grid min-w-0 gap-1 text-sm font-semibold">
        <span>Due</span>
        <input
          className="min-h-11 w-full min-w-0 rounded-paper border border-desk-line bg-desk-raised px-3"
          aria-label="Task due date"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.currentTarget.value)}
        />
      </label>

      {task ? (
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          <span>Status</span>
          <select
            className="min-h-11 w-full min-w-0 rounded-paper border border-desk-line bg-desk-raised px-3 text-desk-ink"
            aria-label="Task status"
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value as TaskStatus)}
          >
            {statuses.map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}
          </select>
        </label>
      ) : null}

      <div className={`grid gap-2 ${task ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          className="min-h-11 rounded-paper border border-desk-accent/25 bg-desk-accent-soft px-4 font-bold text-desk-accent disabled:cursor-not-allowed disabled:bg-desk-sunk disabled:text-desk-subtle"
          type="submit"
          disabled={!canSave}
        >
          {saving ? "Saving" : task ? "Save" : "Create"}
        </button>
        {task ? (
          <button
            className="min-h-11 rounded-paper border border-desk-line bg-desk-raised px-4 font-bold text-desk-muted disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={saving}
            onClick={toggleArchive}
          >
            {task.archivedAt ? "Restore" : "Archive"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function availableStatuses(status: TaskStatus): TaskStatus[] {
  if (status === "open") return ["open", "in_progress", "completed", "cancelled"];
  if (status === "in_progress") return ["in_progress", "open", "completed", "cancelled"];
  if (status === "completed") return ["completed", "in_progress"];
  return ["cancelled", "open"];
}

function taskStatusLabel(task: TaskRecord): string {
  return task.archivedAt ? "Archived" : statusLabel(task.status);
}

function statusLabel(status: TaskStatus): string {
  if (status === "in_progress") return "Doing";
  if (status === "completed") return "Done";
  if (status === "cancelled") return "Stopped";
  return "Open";
}

function taskMarkClass(task: TaskRecord): string {
  if (task.archivedAt) return "bg-desk-subtle";
  if (task.status === "completed") return "bg-desk-accent";
  if (task.status === "cancelled") return "bg-desk-danger";
  if (task.status === "in_progress") return "bg-desk-evidence";
  return "bg-desk-warn";
}

function taskChipClass(task: TaskRecord): string {
  if (task.archivedAt) return "bg-desk-sunk text-desk-muted";
  if (task.status === "completed") return "bg-desk-accent-soft text-desk-accent";
  if (task.status === "cancelled") return "bg-desk-danger-soft text-desk-danger";
  if (task.status === "in_progress") return "bg-desk-evidence-soft text-desk-evidence";
  return "bg-desk-warn-soft text-desk-warn";
}

function formatDueDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}
