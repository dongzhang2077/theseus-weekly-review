import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import { demoWeek } from "../../shared/demo/demoWeek";
import { PlanScreen } from "./PlanScreen";

const reviewedPlan = apiPlan({
  id: 1,
  weekStart: "2026-06-08",
  weekEnd: "2026-06-14",
  items: [
    apiItem(1, 1, 1, "Backend block", 300, 1),
    apiItem(2, 1, 2, "Frontend block", 240, 2),
    apiItem(3, 1, 3, "Resume block", 120, 3)
  ]
});

const targetPlan = apiPlan({
  id: 2,
  weekStart: "2026-06-15",
  weekEnd: "2026-06-21",
  items: [
    apiItem(4, 2, 1, "Backend block", 300, 1),
    apiItem(5, 2, 2, "Frontend block", 240, 2),
    apiItem(6, 2, 3, "Resume block", 180, 3)
  ]
});

const projects = demoWeek.plan.projects.map((project) => ({
  id: project.id,
  title: project.title,
  stage: project.stage,
  status: project.status,
  weekly_min_minutes: project.weeklyMinMinutes,
  weekly_target_minutes: project.weeklyTargetMinutes
}));

describe("PlanScreen", () => {
  it("shows real balance values and a before/after adjustment without setup forms", async () => {
    renderPlan();

    expect(screen.getByRole("button", { name: "Week balance: Balanced" })).toHaveTextContent("11h");
    expect(screen.getByRole("button", { name: "Suggested adjustment: Protect one restart block" })).toHaveTextContent(
      "Resume and applications · +1h"
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Suggested adjustment: Protect one restart block" }));
    const detail = screen.getByRole("region", { name: "Adjustment" });
    expect(within(detail).getByText("Before")).toBeInTheDocument();
    expect(within(detail).getByText("After")).toBeInTheDocument();
    expect(within(detail).getByText("3h")).toBeInTheDocument();

    fireEvent.click(within(detail).getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Sample adjustment applied")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Plan restored")).toBeInTheDocument();
  });

  it("persists a new target-week plan and deletes it on Undo", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      if (init.method === "GET" && input.endsWith("/weekly-plans")) {
        return ok([reviewedPlan]);
      }
      if (init.method === "GET" && input.endsWith("/projects")) {
        return ok(projects);
      }
      if (init.method === "POST") return ok(targetPlan, 201);
      if (init.method === "DELETE") return ok({}, 204);
      return failed(500);
    };
    renderPlan({ apiBaseUrl: "http://127.0.0.1:8000", userId: 7, reviewSource: "api", fetchImpl });

    fireEvent.click(await screen.findByRole("button", { name: "Suggested adjustment: Protect one restart block" }));
    fireEvent.click(within(screen.getByRole("region", { name: "Adjustment" })).getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(calls.some((call) => call.init.method === "POST")).toBe(true));
    const createCall = calls.find((call) => call.init.method === "POST");
    expect(JSON.parse(String(createCall?.init.body))).toMatchObject({
      week_start: "2026-06-15",
      week_end: "2026-06-21",
      items: expect.arrayContaining([
        expect.objectContaining({ project_id: 3, planned_minutes: 180 })
      ])
    });
    expect(await screen.findByText("Plan saved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(calls.some((call) => call.init.method === "DELETE")).toBe(true));
    expect(calls.find((call) => call.init.method === "DELETE")?.input).toBe(
      "http://127.0.0.1:8000/weekly-plans/2"
    );
    expect(await screen.findByText("Plan restored")).toBeInTheDocument();
  });

  it("shows conflict as a reload state instead of claiming the plan was saved", async () => {
    const fetchImpl: FetchLike = async (input, init) => {
      if (init.method === "GET" && input.endsWith("/weekly-plans")) return ok([reviewedPlan]);
      if (init.method === "GET" && input.endsWith("/projects")) return ok(projects);
      return failed(409);
    };
    renderPlan({ apiBaseUrl: "http://127.0.0.1:8000", userId: 7, reviewSource: "api", fetchImpl });

    fireEvent.click(await screen.findByRole("button", { name: "Suggested adjustment: Protect one restart block" }));
    fireEvent.click(within(screen.getByRole("region", { name: "Adjustment" })).getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Plan changed elsewhere");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.queryByText("Plan saved")).not.toBeInTheDocument();
  });

  it("adds a project-linked plan block and carries it into Focus", async () => {
    const onFocusItem = vi.fn();
    renderPlan({ onFocusItem });

    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }));
    const editor = screen.getByRole("region", { name: "Edit plan" });
    fireEvent.click(within(editor).getByRole("button", { name: "Add block" }));

    fireEvent.change(within(editor).getByLabelText("Plan block 4 title"), {
      target: { value: "Design review block" }
    });
    fireEvent.change(within(editor).getByLabelText("Plan block 4 project"), {
      target: { value: "2" }
    });
    fireEvent.change(within(editor).getByLabelText("Plan block 4 duration"), {
      target: { value: "45" }
    });
    fireEvent.click(within(editor).getByRole("button", { name: "Save plan" }));

    expect(await screen.findByText("Plan updated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Week balance: Balanced" })).toHaveTextContent("11h 45m");

    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    const focusDetail = screen.getByRole("region", { name: "Focus" });
    fireEvent.click(within(focusDetail).getByRole("button", { name: "Focus Design review block" }));

    expect(onFocusItem).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 2,
        title: "Design review block",
        plannedMinutes: 45,
        priority: 4
      }),
      "Theseus frontend"
    );
  });

  it("offers Retry when live plan data cannot load", async () => {
    let shouldFail = true;
    const fetchImpl: FetchLike = async (input, init) => {
      if (init.method === "GET" && input.endsWith("/weekly-plans")) {
        if (shouldFail) {
          shouldFail = false;
          return failed(500);
        }
        return ok([reviewedPlan]);
      }
      return ok(projects);
    };
    renderPlan({ apiBaseUrl: "http://127.0.0.1:8000", userId: 7, reviewSource: "api", fetchImpl });

    expect(await screen.findByText("Plan could not load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Suggested adjustment: Protect one restart block" })).toBeInTheDocument();
  });
});

function renderPlan(overrides: Partial<React.ComponentProps<typeof PlanScreen>> = {}) {
  return render(
    <PlanScreen
      planData={demoWeek.plan}
      reviewSource="demo"
      entryRequest={null}
      onReview={vi.fn()}
      {...overrides}
    />
  );
}

function apiPlan({
  id,
  weekStart,
  weekEnd,
  items
}: {
  id: number;
  weekStart: string;
  weekEnd: string;
  items: ReturnType<typeof apiItem>[];
}) {
  return {
    id,
    user_id: 7,
    week_start: weekStart,
    week_end: weekEnd,
    planned_capacity_minutes: 1800,
    slack_target_percent: 20,
    items,
    note: "Demo plan",
    created_at: "2026-07-15T12:00:00",
    updated_at: "2026-07-15T12:00:00"
  };
}

function apiItem(
  id: number,
  planId: number,
  projectId: number,
  title: string,
  minutes: number,
  priority: number
) {
  return {
    id,
    weekly_plan_id: planId,
    project_id: projectId,
    title,
    planned_minutes: minutes,
    priority,
    is_completed: false,
    created_at: "2026-07-15T12:00:00",
    updated_at: "2026-07-15T12:00:00"
  };
}

function ok(data: unknown, status = 200) {
  return { ok: true, status, json: async () => data };
}

function failed(status: number) {
  return { ok: false, status, json: async () => ({}) };
}
