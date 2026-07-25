import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../../shared/api/loadAppWeek";
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
    const chooser = screen.getByRole("dialog", { name: "Today" });
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
    const chooser = screen.getByRole("dialog", { name: "Today" });
    fireEvent.click(within(chooser).getByRole("button", { name: "Start Backend polish" }));
    fireEvent.click(within(chooser).getByRole("button", { name: "Close" }));
    const currentFocus = screen.getByRole("region", { name: "Current focus" });
    expect(currentFocus).toHaveTextContent("Backend polish");
    expect(currentFocus).toHaveTextContent("Project");
    expect(screen.getAllByRole("button", { name: "End focus activity" })).toHaveLength(3);
  });

  it("runs multiple activities independently and ends the selected session on its next tap", () => {
    vi.useFakeTimers();
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Start focus activity" })[0]);
    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
    const chooser = screen.getByRole("dialog", { name: "Today" });
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
    expect(screen.getByRole("dialog", { name: "Session result" })).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Session result" })).getByRole("button", {
        name: "Save result"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
    const reopenedChooser = screen.getByRole("dialog", { name: "Today" });
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

  it("keeps a completed result in demo mode", () => {
    const onResultModalChange = vi.fn();
    render(<TrackScreen track={trackWithSession()} onResultModalChange={onResultModalChange} />);

    endCurrentFocus();
    const result = screen.getByRole("dialog", { name: "Session result" });
    screen
      .getAllByRole("button", { name: "Resume focus activity" })
      .forEach((button) => expect(button).toBeDisabled());
    expect(onResultModalChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(within(result).getByRole("button", { name: "Completed" }));
    fireEvent.change(within(result).getByLabelText("Result note"), {
      target: { value: "Finished the first pass." }
    });
    fireEvent.click(within(result).getByRole("button", { name: "Save result" }));

    expect(screen.queryByRole("dialog", { name: "Session result" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Session kept in this demo");
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
    expect(onResultModalChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps the result draft after an API failure and allows retry", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(response(false, 503))
      .mockResolvedValueOnce(response(true, 201));
    render(
      <TrackScreen
        apiBaseUrl="http://127.0.0.1:8000"
        fetchImpl={fetchImpl}
        track={trackWithSession()}
      />
    );

    endCurrentFocus();
    const result = screen.getByRole("dialog", { name: "Session result" });
    fireEvent.click(within(result).getByRole("button", { name: "Stuck" }));
    fireEvent.change(within(result).getByLabelText("Result note"), {
      target: { value: "Need a narrower mobile layout." }
    });
    fireEvent.click(within(result).getByRole("button", { name: "Save result" }));

    expect(await within(result).findByRole("alert")).toHaveTextContent(
      "Session could not be saved: Backend returned 503"
    );
    expect(within(result).getByLabelText("Result note")).toHaveValue(
      "Need a narrower mobile layout."
    );
    expect(within(result).getByRole("button", { name: "Stuck" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(within(result).getByRole("button", { name: "Retry save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Session recorded");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog", { name: "Session result" })).not.toBeInTheDocument();
  });

  it("posts once on a double save and disables both close controls while saving", async () => {
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

    endCurrentFocus();
    const result = screen.getByRole("dialog", { name: "Session result" });
    const saveButton = within(result).getByRole("button", { name: "Save result" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(within(result).getByRole("button", { name: "Saving" })).toBeDisabled();
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    expect(closeButtons).toHaveLength(2);
    closeButtons.forEach((button) => expect(button).toBeDisabled());

    await act(async () => {
      resolveFetch?.(response(true, 201));
      await Promise.resolve();
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Session recorded");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("saves a cross-day accumulated session through one batch request", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return response(true, 201);
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
    fireEvent.click(within(screen.getByRole("dialog", { name: "Session result" })).getByRole("button", { name: "Save result" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Session recorded");
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe("http://127.0.0.1:8000/time-logs/batch");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      time_logs: [
        expect.objectContaining({ date: "2026-07-18", duration_minutes: 1 }),
        expect.objectContaining({ date: "2026-07-19", duration_minutes: 1 })
      ]
    });
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
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
