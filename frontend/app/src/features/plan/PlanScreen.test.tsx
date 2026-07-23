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
    expect(screen.getByRole("button", { name: "Apply adjustment" })).toHaveTextContent("Apply");
    expect(screen.getByRole("button", { name: "Open plan blocks" })).toHaveTextContent("3 blocks · 11h");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Suggested adjustment: Protect one restart block" }));
    const detail = screen.getByRole("dialog", { name: "Adjustment" });
    expect(within(detail).getByText("Before")).toBeInTheDocument();
    expect(within(detail).getByText("After")).toBeInTheDocument();
    expect(within(detail).getByText("3h")).toBeInTheDocument();

    fireEvent.click(within(detail).getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Sample adjustment applied")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Plan restored")).toBeInTheDocument();
  });

  it("opens the selected Signal adjustment instead of the global review suggestion", async () => {
    const onDetailOpenChange = vi.fn();
    renderPlan({
      onDetailOpenChange,
      entryRequest: {
        id: 10,
        detail: "suggestion",
        suggestion: {
          title: "Adjust Theseus frontend",
          reason: "Frontend stayed below plan.",
          kind: "reduce",
          projectId: 2,
          projectTitle: "Theseus frontend",
          deltaMinutes: -60
        }
      }
    });

    const detail = screen.getByRole("dialog", { name: "Adjustment" });
    expect(within(detail).getByText("Adjust Theseus frontend")).toBeInTheDocument();
    expect(within(detail).getByText("4h")).toBeInTheDocument();
    expect(within(detail).getByText("3h")).toBeInTheDocument();
    await waitFor(() => expect(onDetailOpenChange).toHaveBeenLastCalledWith(true));
  });

  it("applies the previewed adjustment directly from Level 1", async () => {
    renderPlan();

    fireEvent.click(screen.getByRole("button", { name: "Apply adjustment" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Sample adjustment applied");
    expect(screen.getByText("Adjustment applied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
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
    renderPlan({ apiBaseUrl: "http://127.0.0.1:8000", reviewSource: "api", fetchImpl });

    fireEvent.click(await screen.findByRole("button", { name: "Suggested adjustment: Protect one restart block" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Adjustment" })).getByRole("button", { name: "Apply" }));

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
    renderPlan({ apiBaseUrl: "http://127.0.0.1:8000", reviewSource: "api", fetchImpl });

    fireEvent.click(await screen.findByRole("button", { name: "Suggested adjustment: Protect one restart block" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Adjustment" })).getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Plan changed elsewhere");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.queryByText("Plan saved")).not.toBeInTheDocument();
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
    renderPlan({ apiBaseUrl: "http://127.0.0.1:8000", reviewSource: "api", fetchImpl });

    expect(await screen.findByText("Plan could not load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Suggested adjustment: Protect one restart block" })).toBeInTheDocument();
  });

  it("keeps a discoverable New plan editor without requiring Review", async () => {
    renderPlan();

    fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    const editor = screen.getByRole("dialog", { name: "Edit plan" });
    expect(within(editor).getByLabelText("Weekly capacity hours")).toHaveValue(30);
    expect(within(editor).getByTestId("plan-block-fields-1")).toHaveClass(
      "grid-cols-1",
      "min-[390px]:grid-cols-[minmax(0,1fr)_96px]"
    );
    expect(within(editor).getByLabelText("Plan block 1 project")).toHaveClass("w-full", "min-w-0", "max-w-full");
    expect(within(editor).getByLabelText("Plan block 1 duration")).toHaveClass("w-full", "min-w-0", "max-w-full");

    fireEvent.click(within(editor).getByRole("button", { name: "Add block" }));
    fireEvent.change(within(editor).getByLabelText("Plan block 4 title"), {
      target: { value: "Demo rehearsal" }
    });
    fireEvent.change(within(editor).getByLabelText("Plan block 4 duration"), {
      target: { value: "45" }
    });
    fireEvent.click(within(editor).getByRole("button", { name: "Save plan" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Sample plan updated");
    expect(screen.getByRole("button", { name: "Week balance: Balanced" })).toHaveTextContent("11h 45m");
  });

  it("creates a new target-week plan through the retained New entry", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      if (init.method === "GET" && input.endsWith("/weekly-plans")) return ok([reviewedPlan]);
      if (init.method === "GET" && input.endsWith("/projects")) return ok(projects);
      if (init.method === "POST") return ok(targetPlan, 201);
      return failed(500);
    };
    renderPlan({ apiBaseUrl: "http://127.0.0.1:8000", reviewSource: "api", fetchImpl });

    fireEvent.click(await screen.findByRole("button", { name: "New plan" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Edit plan" })).getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(calls.some((call) => call.init.method === "POST")).toBe(true));
    expect(await screen.findByRole("status")).toHaveTextContent("Plan updated");
    expect(screen.getByRole("button", { name: "Edit plan" })).toBeInTheDocument();
  });

  it("starts a planned block through the parent Focus callback", () => {
    const onFocusItem = vi.fn();
    renderPlan({ onFocusItem });

    expect(screen.queryByRole("button", { name: "Focus Design backend schema and API" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open plan blocks" }));
    fireEvent.click(screen.getByRole("button", { name: "Focus Design backend schema and API" }));
    expect(onFocusItem).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Design backend schema and API", plannedMinutes: 300 }),
      "Theseus backend"
    );
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
