import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import { demoWeek } from "../../shared/demo/demoWeek";
import { SignalsScreen } from "./SignalsScreen";

describe("SignalsScreen", () => {
  it("shows concrete issues once instead of repeating a priority category in four summaries", () => {
    render(
      <SignalsScreen signals={demoWeek.signals} onAction={vi.fn()} onTrack={vi.fn()} />
    );

    expect(screen.getByLabelText("Current signal issues")).toBeInTheDocument();
    expect(screen.getAllByText("Resume dormant")).toHaveLength(1);
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.queryByLabelText("Signal summaries")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Plan: Drift" })).not.toBeInTheDocument();
  });

  it("sends the selected issue's project and minutes directly to Plan", () => {
    const onAction = vi.fn();
    render(<SignalsScreen signals={demoWeek.signals} onAction={onAction} onTrack={vi.fn()} />);

    const issue = screen.getByRole("article", { name: "Resume dormant: Wake-up" });
    fireEvent.click(within(issue).getByRole("button", { name: "Schedule restart" }));

    expect(onAction).toHaveBeenCalledWith({
      label: "Schedule restart",
      detail: "suggestion",
      suggestion: expect.objectContaining({
        projectId: 3,
        projectTitle: "Resume and applications",
        deltaMinutes: 60
      })
    });
  });

  it("opens one opaque evidence page without keeping the issue list underneath", async () => {
    const onDetailOpenChange = vi.fn();
    render(
      <SignalsScreen
        signals={demoWeek.signals}
        onAction={vi.fn()}
        onTrack={vi.fn()}
        onDetailOpenChange={onDetailOpenChange}
      />
    );

    const issue = screen.getByRole("article", { name: "Resume dormant: Wake-up" });
    fireEvent.click(within(issue).getByRole("button", { name: "Evidence" }));

    const detail = screen.getByRole("region", { name: "Resume dormant" });
    expect(detail).toHaveClass("bg-desk-paper");
    expect(within(detail).getByText("Inactive")).toBeInTheDocument();
    expect(screen.queryByLabelText("Current signal issues")).not.toBeInTheDocument();
    await waitFor(() => expect(onDetailOpenChange).toHaveBeenLastCalledWith(true));

    fireEvent.click(within(detail).getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Current signal issues")).toBeInTheDocument();
    await waitFor(() => expect(onDetailOpenChange).toHaveBeenLastCalledWith(false));
  });

  it("collapses a data-backed week with no issues into a steady state", () => {
    const signals: AppWeekViewModel["signals"] = {
      summaries: demoWeek.signals.summaries.map((signal) => ({
        ...signal,
        severity: "normal",
        status: "Steady"
      })),
      evidence: demoWeek.signals.evidence.map((row) => ({
        ...row,
        severity: "normal",
        action: undefined
      }))
    };

    render(<SignalsScreen signals={signals} onAction={vi.fn()} onTrack={vi.fn()} />);
    expect(screen.getByText("All checks steady")).toBeInTheDocument();
  });

  it("shows a focus-first empty state when every signal has no data", () => {
    const onTrack = vi.fn();
    const signals: AppWeekViewModel["signals"] = {
      summaries: demoWeek.signals.summaries.map((signal) => ({
        ...signal,
        severity: "nodata",
        status: "No data"
      })),
      evidence: []
    };

    render(<SignalsScreen signals={signals} onAction={vi.fn()} onTrack={onTrack} />);
    expect(screen.getByText("Track a little more first")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open focus" }));
    expect(onTrack).toHaveBeenCalledOnce();
  });
});
