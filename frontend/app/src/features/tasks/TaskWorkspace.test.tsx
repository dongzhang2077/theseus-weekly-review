import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import type { TaskRecord } from "../../shared/domain/task";
import { TaskWorkspace } from "./TaskWorkspace";

const projects = [
  {
    id: 3,
    title: "Final report",
    stage: "sprint" as const,
    status: "active" as const,
    weeklyMinMinutes: 120,
    weeklyTargetMinutes: 300
  }
];

const task: TaskRecord = {
  id: 21,
  userId: 7,
  projectId: 3,
  title: "Draft findings",
  description: "",
  status: "open",
  priority: 1,
  estimatedMinutes: 120,
  dueDate: "2026-08-01",
  createdSource: "user",
  completedAt: null,
  archivedAt: null,
  version: 1,
  createdAt: "2026-07-22T12:00:00Z",
  updatedAt: "2026-07-22T12:00:00Z"
};

describe("TaskWorkspace", () => {
  it("creates a Task in a focused Level 3 form", async () => {
    const onTasksChange = vi.fn();
    let requestBody: Record<string, unknown> = {};
    renderWorkspace({
      tasks: [],
      onTasksChange,
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init.body));
        return ok(apiTask(task), 201);
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Draft findings" }
    });
    fireEvent.change(screen.getByLabelText("Task estimate"), {
      target: { value: "120" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onTasksChange).toHaveBeenCalledWith([task]));
    expect(requestBody).toMatchObject({
      project_id: 3,
      title: "Draft findings",
      estimated_minutes: 120
    });
    expect(requestBody).not.toHaveProperty("created_source");
  });

  it("updates lifecycle status and uses the loaded version", async () => {
    const onTasksChange = vi.fn();
    let requestBody: Record<string, unknown> = {};
    const completed = {
      ...task,
      status: "completed" as const,
      completedAt: "2026-07-22T13:00:00Z",
      version: 2
    };
    renderWorkspace({
      tasks: [task],
      onTasksChange,
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init.body));
        return ok(apiTask(completed));
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "Open task Draft findings" }));
    fireEvent.change(screen.getByLabelText("Task status"), {
      target: { value: "completed" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onTasksChange).toHaveBeenCalledWith([completed]));
    expect(requestBody).toMatchObject({
      expected_version: 1,
      status: "completed"
    });
  });

  it("refreshes the editor from a version conflict instead of overwriting", async () => {
    const current = { ...task, title: "Current title", version: 2 };
    const Harness = () => {
      const [tasks, setTasks] = useState([task]);
      return (
        <TaskWorkspace
          apiBaseUrl="http://127.0.0.1:8000"
          phase="ready"
          tasks={tasks}
          projects={projects}
          onTasksChange={setTasks}
          onRetry={vi.fn()}
          fetchImpl={async () => ({
            ok: false,
            status: 409,
            json: async () => ({
              detail: {
                code: "version_conflict",
                message: "The task changed after it was loaded",
                current: apiTask(current)
              }
            })
          })}
        />
      );
    };
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Open task Draft findings" }));
    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Stale title" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Review the latest version");
    expect(screen.getByLabelText("Task title")).toHaveValue("Current title");
  });

  it("archives and restores through reversible one-word actions", async () => {
    const archived = {
      ...task,
      archivedAt: "2026-07-22T13:00:00Z",
      version: 2
    };
    const Harness = () => {
      const [tasks, setTasks] = useState([task]);
      return (
        <TaskWorkspace
          apiBaseUrl="http://127.0.0.1:8000"
          phase="ready"
          tasks={tasks}
          projects={projects}
          onTasksChange={setTasks}
          onRetry={vi.fn()}
          fetchImpl={async () => ok(apiTask(archived))}
        />
      );
    };
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Open task Draft findings" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Task saved");
    fireEvent.click(screen.getByRole("button", { name: "archive" }));
    expect(screen.getByRole("button", { name: "Open task Draft findings" })).toHaveTextContent("Archived");
  });
});

function renderWorkspace(
  overrides: Partial<React.ComponentProps<typeof TaskWorkspace>> = {}
) {
  render(
    <TaskWorkspace
      apiBaseUrl="http://127.0.0.1:8000"
      phase="ready"
      tasks={[task]}
      projects={projects}
      onTasksChange={vi.fn()}
      onRetry={vi.fn()}
      {...overrides}
    />
  );
}

function apiTask(value: TaskRecord) {
  return {
    id: value.id,
    user_id: value.userId,
    project_id: value.projectId,
    title: value.title,
    description: value.description,
    status: value.status,
    priority: value.priority,
    estimated_minutes: value.estimatedMinutes,
    due_date: value.dueDate,
    created_source: value.createdSource,
    completed_at: value.completedAt,
    archived_at: value.archivedAt,
    version: value.version,
    created_at: value.createdAt,
    updated_at: value.updatedAt
  };
}

function ok(data: unknown, status = 200): ReturnType<FetchLike> {
  return Promise.resolve({ ok: true, status, json: async () => data });
}
