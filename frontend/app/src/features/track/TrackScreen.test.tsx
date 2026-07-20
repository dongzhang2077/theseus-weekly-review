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

  it("shows a source-backed sample reason without inventing a completion criterion", () => {
    render(<TrackScreen track={demoWeek.track} />);

    const currentFocus = screen.getByRole("region", { name: "Current focus" });
    expect(within(currentFocus).getByText("Frontend build block")).toBeInTheDocument();
    expect(
      within(currentFocus).getByText(
        "Sample recommendation: frontend work finished below its planned block."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/done when/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/one clear result is recorded/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start focus activity" })).toBeInTheDocument();
  });

  it("moves to the next activity without recording feedback", () => {
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("region", { name: "Current focus" })).toHaveTextContent("Backend polish");
    expect(screen.getByRole("status")).toHaveTextContent("Showing the next activity");
    expect(screen.queryByText(/later|skipped/i)).not.toBeInTheDocument();
  });

  it("marks a delayed activity as later in this view", () => {
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getByRole("button", { name: "Delay" }));
    expect(screen.getByRole("status")).toHaveTextContent("Moved to later in this view");

    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    const chooser = screen.getByRole("dialog", { name: "Choose activity" });
    expect(within(chooser).getByText("42m · Later")).toBeInTheDocument();
  });

  it("skips an activity for the view and restores it through manual choice", () => {
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("status")).toHaveTextContent("Skipped for this view");
    expect(screen.getByRole("region", { name: "Current focus" })).toHaveTextContent("Backend polish");

    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    const chooser = screen.getByRole("dialog", { name: "Choose activity" });
    expect(within(chooser).getByText("42m · Skipped")).toBeInTheDocument();

    fireEvent.click(within(chooser).getByRole("button", { name: "Choose Frontend build block" }));
    expect(screen.queryByRole("dialog", { name: "Choose activity" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Current focus" })).toHaveTextContent(
      "Frontend build block"
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(screen.queryByText("42m · Skipped")).not.toBeInTheDocument();
  });

  it("locks every recommendation and activity-switch entry while running and paused", () => {
    vi.useFakeTimers();
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getByRole("button", { name: "Start focus activity" }));
    expectFocusSwitchingToBeLocked();

    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole("button", { name: "Pause focus" }));

    expect(screen.getByRole("button", { name: "Resume focus" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Session paused");
    expectFocusSwitchingToBeLocked();
  });

  it("keeps the session target and goal local to this view", () => {
    const fetchImpl = vi.fn<FetchLike>();
    const { unmount } = render(
      <TrackScreen apiBaseUrl="http://127.0.0.1:8000" fetchImpl={fetchImpl} track={demoWeek.track} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Session target · 25 min" }));
    const setup = screen.getByRole("dialog", { name: "Session setup" });
    fireEvent.click(within(setup).getByRole("button", { name: "45 minute target" }));
    fireEvent.change(within(setup).getByLabelText("Goal for this session (optional)"), {
      target: { value: "Complete the mobile focus layout" }
    });
    fireEvent.click(within(setup).getByRole("button", { name: "Use this setup" }));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Session target · 45 min" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Session target · 45 min" }));
    expect(screen.getByLabelText("Goal for this session (optional)")).toHaveValue(
      "Complete the mobile focus layout"
    );

    unmount();
    render(<TrackScreen track={demoWeek.track} />);
    expect(screen.getByRole("button", { name: "Session target · 25 min" })).toBeInTheDocument();
  });

  it("restores the session setup when Focus is unmounted during tab navigation", () => {
    render(<SessionDraftHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Session target · 25 min" }));
    const setup = screen.getByRole("dialog", { name: "Session setup" });
    fireEvent.click(within(setup).getByRole("button", { name: "45 minute target" }));
    fireEvent.change(within(setup).getByLabelText("Goal for this session (optional)"), {
      target: { value: "Keep the tab handoff stable" }
    });
    fireEvent.click(within(setup).getByRole("button", { name: "Use this setup" }));

    fireEvent.click(screen.getByRole("button", { name: "Leave Focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Return to Focus" }));

    expect(screen.getByRole("button", { name: "Session target · 45 min" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Session target · 45 min" }));
    expect(screen.getByLabelText("Goal for this session (optional)")).toHaveValue(
      "Keep the tab handoff stable"
    );
  });

  it("keeps a completed result in demo mode", () => {
    const onResultModalChange = vi.fn();
    render(<TrackScreen track={trackWithSession()} onResultModalChange={onResultModalChange} />);

    fireEvent.click(screen.getByRole("button", { name: "End focus" }));
    const result = screen.getByRole("dialog", { name: "Session result" });
    expect(screen.getByRole("button", { name: "Resume focus" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "End focus" })).toBeDisabled();
    expect(onResultModalChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(within(result).getByRole("button", { name: "Completed" }));
    fireEvent.change(within(result).getByLabelText("Result note"), {
      target: { value: "Finished the first pass." }
    });
    fireEvent.click(within(result).getByRole("button", { name: "Save result" }));

    expect(screen.queryByRole("dialog", { name: "Session result" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Session kept in this demo");
    expect(screen.getByText("00:00")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "End focus" }));
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

    fireEvent.click(screen.getByRole("button", { name: "End focus" }));
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
});

function expectFocusSwitchingToBeLocked() {
  ["Next", "Delay", "Skip", "Choose"].forEach((name) => {
    expect(screen.getByRole("button", { name })).toBeDisabled();
  });
  expect(screen.getByRole("button", { name: "Choose activity" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Session target/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Open today's activity list" })).toBeDisabled();
}

function trackWithSession(): AppWeekViewModel["track"] {
  return {
    activities: demoWeek.track.activities.map((activity, index) =>
      index === 0
        ? {
            ...activity,
            sessionSeconds: 61,
            running: false
          }
        : { ...activity }
    )
  };
}

function response(ok: boolean, status: number) {
  return {
    ok,
    status,
    json: async () => ({})
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
