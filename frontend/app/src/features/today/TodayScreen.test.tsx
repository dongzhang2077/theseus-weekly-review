import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import type { ApiTimeLogRead } from "../../shared/api/timeLogs";
import type { ActivityTimer, FocusSessionDraft } from "../../shared/domain/track";
import type { PlanProject } from "../../shared/domain/plan";
import { TodayScreen } from "./TodayScreen";

const projects: PlanProject[] = [
  {
    id: 1,
    title: "Theseus",
    stage: "sprint",
    status: "active",
    weeklyMinMinutes: 120,
    weeklyTargetMinutes: 300,
  },
  {
    id: 2,
    title: "Coursework",
    stage: "stable",
    status: "active",
    weeklyMinMinutes: 60,
    weeklyTargetMinutes: 180,
  },
];

const baseActivities: ActivityTimer[] = [
  {
    id: "implementation",
    activityId: 7,
    activityVersion: 1,
    projectId: 1,
    projectTitle: "Theseus",
    name: "Implementation",
    category: "Project",
    energy: "neutral",
    color: "#6f8f6b",
    todayDate: "2026-07-30",
    todaySeconds: 1800,
    sessionSeconds: 0,
    running: false,
    recommended: true,
  },
  {
    id: "reading",
    activityId: 8,
    activityVersion: 1,
    projectId: 2,
    projectTitle: "Coursework",
    name: "Reading",
    category: "Study",
    energy: "consume",
    color: "#7692aa",
    todayDate: "2026-07-30",
    todaySeconds: 1200,
    sessionSeconds: 0,
    running: false,
  },
];

const logs: ApiTimeLogRead[] = [
  timeLog(101, "2026-07-27", 1, 1800, "Monday build"),
  timeLog(102, "2026-07-29", 2, 2400, "Wednesday reading"),
  timeLog(103, "2026-07-30", 1, 3601, "Implementation"),
  timeLog(104, "2026-07-30", 2, 1200, "Reading"),
  timeLog(105, "2026-07-31", 1, 7200, "Future record"),
];

describe("TodayScreen", () => {
  it("opens exact persisted Day evidence without unrelated or future records", () => {
    renderToday();

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Time by project" })).toBeInTheDocument();
    expect(screen.getAllByText("1h 20m 1s")).toHaveLength(2);

    fireEvent.click(
      screen.getByRole("button", {
        name: /open theseus time records, 1h 0m 1s/i,
      })
    );
    const evidence = screen.getByRole("dialog", { name: "Theseus · Jul 30" });
    expect(within(evidence).getByText("Implementation")).toBeInTheDocument();
    expect(within(evidence).queryByText("Reading")).not.toBeInTheDocument();
    expect(within(evidence).queryByText("Future record")).not.toBeInTheDocument();
    expect(within(evidence).getByText("Record 103", { exact: false })).toBeInTheDocument();
  });

  it("navigates historical Day evidence without changing Current Focus", () => {
    renderToday();

    expect(screen.getByText("Implementation", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));

    expect(screen.getByText("Wed, Jul 29")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next day" })).not.toBeDisabled();
    expect(screen.getByText("Implementation", { selector: "span" })).toBeInTheDocument();
    expect(screen.getAllByText("40m")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByText("Thu, Jul 30")).toBeInTheDocument();
  });

  it("excludes future dates from the current Week and opens the selected day", () => {
    renderToday();

    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByText("Jul 27 – Aug 2")).toBeInTheDocument();
    const weekChart = screen
      .getByRole("heading", { name: "Recorded time by day" })
      .closest("section");
    expect(weekChart).not.toBeNull();
    expect(within(weekChart as HTMLElement).getAllByRole("button", { name: /time records/i }))
      .toHaveLength(4);
    expect(screen.getAllByLabelText(/unavailable/i)).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /jul 31 time records/i })).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /open wed, jul 29 time records, 40m/i,
      })
    );
    const evidence = screen.getByRole("dialog", { name: "Wed, Jul 29 time records" });
    expect(within(evidence).getByText("Wednesday reading")).toBeInTheDocument();
    expect(within(evidence).queryByText("Monday build")).not.toBeInTheDocument();
  });

  it("shows a truthful sparse Month state before the density gate", () => {
    renderToday();

    fireEvent.click(screen.getByRole("button", { name: "Month" }));

    expect(screen.getByText("July 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recorded time intensity" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "More days are needed" }))
      .toBeInTheDocument();
    expect(screen.getByText("Record time on 7 days to show a monthly pattern."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  it("navigates and opens exact Month evidence after the density gate", () => {
    const monthLogs = Array.from({ length: 7 }, (_, index) =>
      timeLog(
        201 + index,
        `2026-07-${String(20 + index).padStart(2, "0")}`,
        index % 2 === 0 ? 1 : 2,
        (index + 1) * 3_600,
        `Month record ${index + 1}`
      )
    );
    renderToday({ timeLogs: monthLogs });

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByLabelText("Monthly recorded time calendar")).toBeInTheDocument();
    expect(screen.getByText("Low <2h")).toBeInTheDocument();
    expect(screen.getByText("Med 2–6h")).toBeInTheDocument();
    expect(screen.getByText("High 6h+")).toBeInTheDocument();

    const july24 = screen.getByRole("button", {
      name: /open fri, jul 24 time records, 5h 0m, medium intensity/i,
    });
    const july25 = screen.getByRole("button", {
      name: /open sat, jul 25 time records, 6h 0m, high intensity/i,
    });
    july24.focus();
    fireEvent.keyDown(july24, { key: "ArrowRight" });
    expect(july25).toHaveFocus();

    fireEvent.click(july24);
    const evidence = screen.getByRole("dialog", { name: "Fri, Jul 24 time records" });
    expect(within(evidence).getByText("Month record 5")).toBeInTheDocument();
    expect(within(evidence).queryByText("Month record 4")).not.toBeInTheDocument();
    expect(within(evidence).getByText("Record 205", { exact: false })).toBeInTheDocument();

    fireEvent.click(within(evidence).getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("June 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).not.toBeDisabled();
  });

  it("opens the protected Tracker with one explicit Start control and a read-only timer", () => {
    renderToday();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open Focus tracker for Implementation",
      })
    );
    expect(screen.getByRole("heading", { name: "Focus" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Start focus activity" })).toHaveLength(1);
    expect(screen.getByRole("timer", { name: /current focus duration/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Today" }));
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
  });

  it("starts the foreground Activity through the durable FocusSession API", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      response(true, 201, runningFocusSession())
    );
    renderToday({ fetchImpl });

    fireEvent.click(screen.getByRole("button", { name: "Start Implementation" }));

    expect(await screen.findByRole("button", { name: "End Implementation" })).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("http://127.0.0.1:8000/focus-sessions");
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body))).toEqual({
      activity_id: 7,
    });
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({
      "Content-Type": "application/json",
      "Idempotency-Key": expect.stringMatching(/^focus-start-/),
    });
    expect(screen.getByText(/Theseus · Focus/)).toBeInTheDocument();
  });
});

function renderToday(options: {
  fetchImpl?: FetchLike;
  activities?: ActivityTimer[];
  timeLogs?: ApiTimeLogRead[];
} = {}) {
  const fetchImpl = options.fetchImpl ?? vi.fn<FetchLike>();

  function Harness() {
    const [activities, setActivities] = useState(options.activities ?? baseActivities);
    const [timeLogs, setTimeLogs] = useState(options.timeLogs ?? logs);
    const [foregroundActivityId, setForegroundActivityId] = useState<string | null>(null);
    const [sessionDrafts, setSessionDrafts] = useState<Record<string, FocusSessionDraft>>({});

    return (
      <TodayScreen
        apiBaseUrl="http://127.0.0.1:8000"
        timeZone="America/Los_Angeles"
        todayDate="2026-07-30"
        fetchImpl={fetchImpl}
        track={{ activities }}
        activities={activities}
        projects={projects}
        timeLogs={timeLogs}
        onRetryHistory={vi.fn()}
        onActivitiesChange={setActivities}
        onTimeLogsChange={setTimeLogs}
        sessionDrafts={sessionDrafts}
        onSessionDraftChange={(activityId, draft) =>
          setSessionDrafts((current) => {
            const next = { ...current };
            if (draft) next[activityId] = draft;
            else delete next[activityId];
            return next;
          })
        }
        onResultModalChange={vi.fn()}
        onSessionSaved={vi.fn()}
        foregroundActivityId={foregroundActivityId}
        onForegroundActivityChange={setForegroundActivityId}
        onTrackerOpenChange={vi.fn()}
      />
    );
  }

  return render(<Harness />);
}

function response(ok: boolean, status: number, payload: unknown) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

function runningFocusSession() {
  return {
    id: 901,
    user_id: 1,
    activity_id: 7,
    task_id: null,
    project_id: 1,
    activity_name: "Implementation",
    activity_type: "neutral",
    type_source: "user_selected",
    task_title: null,
    timezone: "America/Los_Angeles",
    status: "running",
    accumulated_seconds: 0,
    current_run_started_at: "2026-07-30T18:00:00Z",
    elapsed_seconds: 0,
    version: 1,
    started_at: "2026-07-30T18:00:00Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2026-07-30T18:00:00Z",
    updated_at: "2026-07-30T18:00:00Z",
  };
}

function timeLog(
  id: number,
  date: string,
  projectId: number | null,
  durationSeconds: number,
  activityName: string
): ApiTimeLogRead {
  return {
    id,
    user_id: 1,
    project_id: projectId,
    date,
    duration_minutes: Math.floor(durationSeconds / 60),
    duration_seconds: durationSeconds,
    activity_name: activityName,
    activity_type: "neutral",
    type_source: "user_selected",
    note: "",
    version: 1,
    deleted_at: null,
    created_at: `${date}T10:00:00Z`,
    updated_at: `${date}T10:00:00Z`,
  };
}
