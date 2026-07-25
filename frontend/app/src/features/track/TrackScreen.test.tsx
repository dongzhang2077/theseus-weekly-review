import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import type { ApiTimeLogRead } from "../../shared/api/timeLogs";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import { demoWeek } from "../../shared/demo/demoWeek";
import type { FocusSessionDraft } from "../../shared/domain/track";
import { TrackScreen } from "./TrackScreen";

describe("TrackScreen", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("restores the quiet midterm Level 1 timer hierarchy", () => {
    render(<TrackScreen track={demoWeek.track} />);

    const currentFocus = screen.getByRole("region", { name: "Current focus" });
    expect(within(currentFocus).getByText("Frontend build block")).toBeInTheDocument();
    expect(within(currentFocus).getByText("Recommended now")).toBeInTheDocument();
    expect(within(currentFocus).getByText("00:00:00")).toBeInTheDocument();
    expect(within(currentFocus).getByText("Today total")).toBeInTheDocument();
    expect(within(currentFocus).getByText("2h 46m")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Start focus activity" })).toHaveLength(3);
    expect(screen.queryByText(/sample recommendation/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByText(/session target/i)).not.toBeInTheDocument();
  });

  it("opens the midterm Today sheet with grouped activities and right-aligned totals", () => {
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
    const chooser = screen.getByRole("dialog", { name: "Activities" });
    expect(within(chooser).getByRole("heading", { name: "Project" })).toBeInTheDocument();
    expect(within(chooser).getByRole("heading", { name: "Study" })).toBeInTheDocument();
    expect(within(chooser).getByRole("heading", { name: "Health" })).toBeInTheDocument();
    const frontendActivity = within(chooser).getByRole("button", {
      name: "Start Frontend build block"
    });
    expect(within(frontendActivity).getByText("42m")).toBeInTheDocument();
    expect(
      within(within(chooser).getByRole("button", { name: "Start Backend polish" })).getByText(
        "24m"
      )
    ).toBeInTheDocument();
  });

  it("selects and starts an activity by tapping its row", () => {
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
    const chooser = screen.getByRole("dialog", { name: "Activities" });
    fireEvent.click(within(chooser).getByRole("button", { name: "Start Backend polish" }));
    fireEvent.click(within(chooser).getByRole("button", { name: "Close" }));
    const currentFocus = screen.getByRole("region", { name: "Current focus" });
    expect(currentFocus).toHaveTextContent("Backend polish");
    expect(currentFocus).toHaveTextContent("Project");
    expect(screen.getAllByRole("button", { name: "End focus activity" })).toHaveLength(3);
  });

  it("starts a durable FocusSession before showing the Activity as running", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      response(true, 201, runningFocusSession())
    );
    const track: AppWeekViewModel["track"] = {
      activities: demoWeek.track.activities.map((activity, index) =>
        index === 0
          ? {
              ...activity,
              activityId: 7,
              activityVersion: 1
            }
          : activity
      )
    };
    render(
      <TrackScreen
        apiBaseUrl="http://127.0.0.1:8000"
        fetchImpl={fetchImpl}
        track={track}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Start focus activity" })[0]);

    expect(await screen.findAllByRole("button", { name: "End focus activity" })).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8000/focus-sessions"
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      activity_id: 7
    });
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
      "Content-Type": "application/json",
      "Idempotency-Key": expect.stringMatching(/^focus-start-/)
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("runs multiple activities independently and ends the selected session on its next tap", () => {
    vi.useFakeTimers();
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Start focus activity" })[0]);
    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
    const chooser = screen.getByRole("dialog", { name: "Activities" });
    expect(
      within(within(chooser).getByRole("button", { name: "End Frontend build block" })).getByText(
        "00:01"
      )
    ).toBeInTheDocument();
    fireEvent.click(within(chooser).getByRole("button", { name: "Start Backend polish" }));
    expect(within(chooser).getByRole("button", { name: "End Frontend build block" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(chooser).getByRole("button", { name: "End Backend polish" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    act(() => vi.advanceTimersByTime(2_000));
    fireEvent.click(within(chooser).getByRole("button", { name: "End Backend polish" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
    const reopenedChooser = screen.getByRole("dialog", { name: "Activities" });
    expect(
      within(reopenedChooser).getByRole("button", { name: "Start Backend polish" })
    ).toBeInTheDocument();
    expect(
      within(within(reopenedChooser).getByRole("button", { name: "End Frontend build block" })).getByText(
        "00:03"
      )
    ).toBeInTheDocument();
  });

  it("keeps the session target and goal local to this view", () => {
    const fetchImpl = vi.fn<FetchLike>();
    const { unmount } = render(
      <TrackScreen apiBaseUrl="http://127.0.0.1:8000" fetchImpl={fetchImpl} track={demoWeek.track} />
    );

    openSessionSetup();
    const setup = screen.getByRole("dialog", { name: "Session setup" });
    fireEvent.click(within(setup).getByRole("button", { name: "45 minute target" }));
    fireEvent.change(within(setup).getByLabelText("Goal for this session (optional)"), {
      target: { value: "Complete the mobile focus layout" }
    });
    fireEvent.click(within(setup).getByRole("button", { name: "Save" }));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Current focus" })).toHaveTextContent("00:45:00");
    openSessionSetup();
    expect(screen.getByRole("button", { name: "45 minute target" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByLabelText("Goal for this session (optional)")).toHaveValue(
      "Complete the mobile focus layout"
    );

    unmount();
    render(<TrackScreen track={demoWeek.track} />);
    openSessionSetup();
    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("adds an Activity only after the durable API save succeeds", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      response(true, 201, {
        id: 7,
        user_id: 1,
        project_id: 11,
        name: "Focused writing",
        description: "Draft the findings",
        activity_type: "consuming",
        type_source: "user_selected",
        version: 1,
        created_at: "2026-07-22T20:00:00Z",
        updated_at: "2026-07-22T20:00:00Z"
      })
    );
    render(
      <TrackScreen
        apiBaseUrl="http://127.0.0.1:8000"
        fetchImpl={fetchImpl}
        track={{ activities: [] }}
        projects={[
          {
            id: 11,
            title: "Final report",
            stage: "sprint",
            status: "active",
            weeklyMinMinutes: 120,
            weeklyTargetMinutes: 300
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add a quick activity" }));
    const form = screen.getByRole("dialog", { name: "New activity" });
    fireEvent.change(within(form).getByLabelText("Activity name"), {
      target: { value: "Focused writing" }
    });
    fireEvent.change(within(form).getByLabelText("Activity project"), {
      target: { value: "11" }
    });
    fireEvent.click(within(form).getByRole("button", { name: "Focused" }));
    fireEvent.change(within(form).getByLabelText("Note"), {
      target: { value: "Draft the findings" }
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Activity saved");
    expect(screen.getByRole("region", { name: "Current focus" })).toHaveTextContent(
      "Focused writing"
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body))).toEqual({
      project_id: 11,
      name: "Focused writing",
      description: "Draft the findings",
      activity_type: "consuming"
    });
  });

  it("uses the same pencil to promote a contextual Activity into a durable Activity", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      response(true, 201, {
        id: 12,
        user_id: 1,
        project_id: null,
        name: "Frontend build block",
        description: "",
        activity_type: "consuming",
        type_source: "user_selected",
        version: 1,
        created_at: "2026-07-25T14:00:00Z",
        updated_at: "2026-07-25T14:00:00Z"
      })
    );
    render(
      <TrackScreen
        apiBaseUrl="http://127.0.0.1:8000"
        fetchImpl={fetchImpl}
        track={demoWeek.track}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Activity detail" }));
    const contextualDetail = screen.getByRole("dialog", {
      name: "Frontend build block"
    });
    const editAction = within(contextualDetail).getByRole("button", { name: "Edit activity" });
    fireEvent.click(editAction);
    const saveForm = screen.getByRole("dialog", { name: "Save activity" });
    expect(within(saveForm).getByLabelText("Activity name")).toHaveValue(
      "Frontend build block"
    );
    fireEvent.click(within(saveForm).getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Activity saved");
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body))).toMatchObject({
      name: "Frontend build block",
      activity_type: "consuming"
    });

    fireEvent.click(screen.getByRole("button", { name: "Activity detail" }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Frontend build block" })
      ).getByRole("button", { name: "Edit activity" })
    );
    expect(screen.getByRole("dialog", { name: "Edit activity" })).toBeInTheDocument();
  });

  it("keeps the Activity draft visible after a save failure and allows retry", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(
        response(false, 503, {
          detail: { message: "Activity storage is unavailable" }
        })
      )
      .mockResolvedValueOnce(
        response(true, 201, {
          id: 9,
          user_id: 1,
          project_id: null,
          name: "Inbox cleanup",
          description: "",
          activity_type: "neutral",
          type_source: "user_selected",
          version: 1,
          created_at: "2026-07-22T20:00:00Z",
          updated_at: "2026-07-22T20:00:00Z"
        })
      );
    render(
      <TrackScreen
        apiBaseUrl="http://127.0.0.1:8000"
        fetchImpl={fetchImpl}
        track={{ activities: [] }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add a quick activity" }));
    const form = screen.getByRole("dialog", { name: "New activity" });
    fireEvent.change(within(form).getByLabelText("Activity name"), {
      target: { value: "Inbox cleanup" }
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "Activity storage is unavailable"
    );
    expect(within(form).getByLabelText("Activity name")).toHaveValue("Inbox cleanup");
    fireEvent.click(within(form).getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Activity saved");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("restores the session setup when Focus is unmounted during tab navigation", () => {
    render(<SessionDraftHarness />);

    openSessionSetup();
    const setup = screen.getByRole("dialog", { name: "Session setup" });
    fireEvent.click(within(setup).getByRole("button", { name: "45 minute target" }));
    fireEvent.change(within(setup).getByLabelText("Goal for this session (optional)"), {
      target: { value: "Keep the tab handoff stable" }
    });
    fireEvent.click(within(setup).getByRole("button", { name: "Save" }));

    fireEvent.click(screen.getByRole("button", { name: "Leave Focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Return to Focus" }));

    openSessionSetup();
    expect(screen.getByRole("button", { name: "45 minute target" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByLabelText("Goal for this session (optional)")).toHaveValue(
      "Keep the tab handoff stable"
    );
  });

  it("ends and saves a session without opening a confirmation sheet", () => {
    const onResultModalChange = vi.fn();
    render(<TrackScreen track={trackWithSession()} onResultModalChange={onResultModalChange} />);

    endCurrentFocus();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
    expect(onResultModalChange).not.toHaveBeenCalledWith(true);
  });

  it("opens recovery only after an automatic save failure and allows retry", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(response(false, 503))
      .mockResolvedValueOnce(response(true, 200, focusCommandResponse()));
    render(
      <TrackScreen
        apiBaseUrl="http://127.0.0.1:8000"
        fetchImpl={fetchImpl}
        track={trackWithSession()}
      />
    );

    endCurrentFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const result = await screen.findByRole("dialog", { name: "Save failed" });
    expect(await within(result).findByRole("alert")).toHaveTextContent(
      "Session could not be saved: Backend returned 503"
    );

    fireEvent.click(within(result).getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Save failed" })).not.toBeInTheDocument();
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1]?.headers).toEqual(
      fetchImpl.mock.calls[1][1]?.headers
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("posts once when the end control is clicked twice during an automatic save", async () => {
    let resolveFetch: ((value: ReturnType<typeof response>) => void) | undefined;
    const fetchImpl: FetchLike = vi.fn(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          resolveFetch = resolve;
        })
    );
    render(
      <TrackScreen
        apiBaseUrl="http://127.0.0.1:8000"
        fetchImpl={fetchImpl}
        track={trackWithSession()}
      />
    );

    const endButton = screen.getAllByRole("button", { name: "End focus activity" })[0];
    fireEvent.click(endButton);
    fireEvent.click(endButton);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch?.(response(true, 200, focusCommandResponse()));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("00:00:00")).toBeInTheDocument();
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("delegates cross-day persistence to one atomic End command", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return response(
        true,
        200,
        focusCommandResponse(120, [
          {
            id: 71,
            user_id: 1,
            activity_id: 7,
            project_id: null,
            task_id: null,
            focus_session_id: 31,
            date: "2026-07-18",
            duration_minutes: 1,
            duration_seconds: 60,
            activity_name: "Frontend build block",
            activity_type: "consuming",
            type_source: "user_selected",
            note: "",
            created_at: "2026-07-19T07:01:00Z",
            updated_at: "2026-07-19T07:01:00Z"
          },
          {
            id: 72,
            user_id: 1,
            activity_id: 7,
            project_id: null,
            task_id: null,
            focus_session_id: 31,
            date: "2026-07-19",
            duration_minutes: 1,
            duration_seconds: 60,
            activity_name: "Frontend build block",
            activity_type: "consuming",
            type_source: "user_selected",
            note: "",
            created_at: "2026-07-19T07:01:00Z",
            updated_at: "2026-07-19T07:01:00Z"
          }
        ])
      );
    };
    const track: AppWeekViewModel["track"] = {
      activities: demoWeek.track.activities.map((activity, index) =>
        index === 0
          ? {
              ...activity,
              todayDate: "2026-07-19",
              todaySeconds: 0,
              sessionSeconds: 120,
              sessionSecondsByDate: {
                "2026-07-18": 60,
                "2026-07-19": 60
              },
              activityId: 7,
              focusSessionId: 31,
              focusSessionVersion: 1,
              running: true
            }
          : { ...activity, todayDate: "2026-07-19", todaySeconds: 0 }
      )
    };

    render(
      <TrackScreen
        apiBaseUrl="http://127.0.0.1:8000"
        todayDate="2026-07-19"
        timeZone="America/Los_Angeles"
        fetchImpl={fetchImpl}
        track={track}
      />
    );

    endCurrentFocus();

    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe(
      "http://127.0.0.1:8000/focus-sessions/31/commands"
    );
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      command: "end",
      expected_version: 1
    });
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
  });

  it("opens persisted Today history separately and supports correction with Undo", async () => {
    const original = historyLog();
    const corrected = {
      ...original,
      duration_minutes: 20,
      duration_seconds: 1200,
      activity_type: "neutral" as const,
      type_source: "user_corrected" as const,
      note: "Corrected note",
      version: 2
    };
    const restored = { ...original, version: 3 };
    const fetchImpl = vi.fn<FetchLike>()
      .mockResolvedValueOnce(response(true, 200, {
        time_log: corrected,
        revision_id: 41,
        affected_review_weeks: []
      }))
      .mockResolvedValueOnce(response(true, 200, {
        time_log: restored,
        revision_id: 42,
        affected_review_weeks: []
      }))
      .mockResolvedValueOnce(response(true, 200, {
        time_log: {
          ...restored,
          version: 4,
          deleted_at: "2026-07-25T17:00:00Z"
        },
        revision_id: 43,
        affected_review_weeks: []
      }));

    render(<HistoryHarness fetchImpl={fetchImpl} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Today history" }));
    const history = screen.getByRole("dialog", { name: "Today history" });
    expect(within(history).getByRole("button", { name: "Edit Backend work" })).toHaveTextContent(
      "30m"
    );
    expect(within(history).getByText("Focus")).toBeInTheDocument();

    fireEvent.click(within(history).getByRole("button", { name: "Edit Backend work" }));
    fireEvent.change(screen.getByLabelText("Record minutes"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Record energy"), { target: { value: "neutral" } });
    fireEvent.change(screen.getByLabelText("Record note"), { target: { value: "Corrected note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("History updated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Backend work" })).toHaveTextContent("20m");
    expect(fetchImpl.mock.calls[0][0]).toBe("http://127.0.0.1:8000/time-logs/71");
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("PATCH");

    fireEvent.click(screen.getByRole("button", { name: "Undo history change" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit Backend work" })).toHaveTextContent("30m");
    });
    expect(fetchImpl.mock.calls[1][0]).toBe(
      "http://127.0.0.1:8000/time-logs/71/revisions/41/undo"
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Backend work" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove record" }));
    expect(screen.getByText("Remove this record from Today and Review?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("No saved records today")).toBeInTheDocument();
    expect(fetchImpl.mock.calls[2][1]?.method).toBe("DELETE");
  });
});

function openSessionSetup() {
  fireEvent.click(screen.getByRole("button", { name: "Activity detail" }));
  const detail = screen.getByRole("dialog", { name: "Frontend build block" });
  fireEvent.click(within(detail).getByRole("button", { name: "Session setup" }));
}

function endCurrentFocus() {
  fireEvent.click(screen.getAllByRole("button", { name: "End focus activity" })[0]);
}

function trackWithSession(): AppWeekViewModel["track"] {
  return {
    activities: demoWeek.track.activities.map((activity, index) =>
      index === 0
        ? {
              ...activity,
              activityId: 7,
              focusSessionId: 31,
              focusSessionVersion: 1,
              sessionSeconds: 61,
              running: true
          }
        : { ...activity }
    )
  };
}

function response(ok: boolean, status: number, payload: unknown = {}) {
  return {
    ok,
    status,
    json: async () => payload
  };
}

function focusCommandResponse(
  accumulatedSeconds = 61,
  timeLogs: unknown[] = []
) {
  return {
    session: {
      id: 31,
      user_id: 1,
      activity_id: 7,
      task_id: null,
      project_id: null,
      activity_name: "Frontend build block",
      activity_type: "consuming",
      type_source: "user_selected",
      task_title: null,
      timezone: "America/Los_Angeles",
      status: "completed",
      accumulated_seconds: accumulatedSeconds,
      current_run_started_at: null,
      elapsed_seconds: accumulatedSeconds,
      version: 2,
      started_at: "2026-07-25T18:00:00Z",
      completed_at: "2026-07-25T18:01:01Z",
      cancelled_at: null,
      created_at: "2026-07-25T18:00:00Z",
      updated_at: "2026-07-25T18:01:01Z"
    },
    time_logs: timeLogs
  };
}

function runningFocusSession() {
  return {
    id: 31,
    user_id: 1,
    activity_id: 7,
    task_id: null,
    project_id: null,
    activity_name: "Frontend build block",
    activity_type: "consuming",
    type_source: "user_selected",
    task_title: null,
    timezone: "America/Los_Angeles",
    status: "running",
    accumulated_seconds: 0,
    current_run_started_at: "2026-07-25T18:00:00Z",
    elapsed_seconds: 0,
    version: 1,
    started_at: "2026-07-25T18:00:00Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2026-07-25T18:00:00Z",
    updated_at: "2026-07-25T18:00:00Z"
  };
}

function SessionDraftHarness() {
  const [visible, setVisible] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, FocusSessionDraft>>({});

  function updateDraft(activityId: string, draft: FocusSessionDraft | null) {
    setDrafts((current) => {
      if (draft) return { ...current, [activityId]: draft };
      const next = { ...current };
      delete next[activityId];
      return next;
    });
  }

  return (
    <>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        {visible ? "Leave Focus" : "Return to Focus"}
      </button>
      {visible ? (
        <TrackScreen
          track={demoWeek.track}
          sessionDrafts={drafts}
          onSessionDraftChange={updateDraft}
        />
      ) : null}
    </>
  );
}

function HistoryHarness({ fetchImpl }: { fetchImpl: FetchLike }) {
  const [logs, setLogs] = useState<ApiTimeLogRead[]>([historyLog()]);
  return (
    <TrackScreen
      apiBaseUrl="http://127.0.0.1:8000"
      todayDate="2026-07-25"
      fetchImpl={fetchImpl}
      track={demoWeek.track}
      timeLogs={logs}
      onTimeLogsChange={setLogs}
      projects={[
        {
          id: 3,
          title: "Theseus backend",
          stage: "sprint",
          status: "active",
          weeklyMinMinutes: 120,
          weeklyTargetMinutes: 300
        }
      ]}
    />
  );
}

function historyLog(): ApiTimeLogRead {
  return {
    id: 71,
    user_id: 1,
    activity_id: 7,
    project_id: 3,
    task_id: null,
    focus_session_id: 31,
    task_title: null,
    date: "2026-07-25",
    start_time: "09:00:00",
    end_time: "09:30:00",
    duration_minutes: 30,
    duration_seconds: 1800,
    activity_name: "Backend work",
    activity_type: "consuming",
    type_source: "user_selected",
    note: "Initial note",
    version: 1,
    deleted_at: null,
    created_at: "2026-07-25T16:00:00Z",
    updated_at: "2026-07-25T16:30:00Z"
  };
}
