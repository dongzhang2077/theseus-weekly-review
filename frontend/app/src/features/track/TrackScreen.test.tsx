import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoWeek } from "../../shared/demo/demoWeek";
import { TrackScreen } from "./TrackScreen";

describe("TrackScreen", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows recommendation context and records a completed focus session", () => {
    vi.useFakeTimers();
    const onSessionSaved = vi.fn();
    render(<TrackScreen track={demoWeek.track} onSessionSaved={onSessionSaved} />);

    expect(screen.getByText("Frontend build block")).toBeInTheDocument();
    expect(screen.getByText("Ship one visible UI improvement and verify it builds.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Start" })[0]);
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    fireEvent.click(screen.getByRole("button", { name: "End focus" }));

    const resultPage = screen.getByRole("region", { name: "Session result" });
    expect(within(resultPage).getByText("Focus session completed")).toBeInTheDocument();
    expect(within(resultPage).getByText("Frontend build block")).toBeInTheDocument();
    expect(within(resultPage).getByText("1m · Deep work")).toBeInTheDocument();

    fireEvent.click(within(resultPage).getByRole("button", { name: "Got stuck" }));
    fireEvent.change(within(resultPage).getByLabelText("Result note"), {
      target: { value: "Need a smaller next step." }
    });
    fireEvent.click(within(resultPage).getByRole("button", { name: "Save result" }));

    expect(screen.queryByRole("region", { name: "Session result" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Session recorded");
    expect(onSessionSaved).toHaveBeenCalledOnce();
  });

  it("lets the user change and manually choose the recommended task", () => {
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Backend polish")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose Research notes" }));

    expect(screen.getByText("Research notes")).toBeInTheDocument();
  });

  it("opens a planned item as the preferred focus activity", async () => {
    const plannedActivity = {
      id: "plan-frontend-review",
      projectId: 2,
      name: "Design review block",
      category: "Project",
      energy: "consume" as const,
      color: "#6f8f6b",
      todaySeconds: 0,
      sessionSeconds: 0,
      running: false,
      recommended: true,
      recommendationReason: "Planned for Theseus frontend",
      completionStandard: "Capture one clear result for Design review block.",
      suggestedMinutes: 45
    };

    render(
      <TrackScreen
        track={demoWeek.track}
        activities={[...demoWeek.track.activities, plannedActivity]}
        preferredActivityId={plannedActivity.id}
      />
    );

    expect(await screen.findByText("Design review block")).toBeInTheDocument();
    expect(screen.getByText("Capture one clear result for Design review block.")).toBeInTheDocument();
    expect(screen.getByText("45m")).toBeInTheDocument();
  });
});
