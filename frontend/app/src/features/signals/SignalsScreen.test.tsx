import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import { demoWeek } from "../../shared/demo/demoWeek";
import { SignalsScreen } from "./SignalsScreen";

describe("SignalsScreen", () => {
  it("shows concrete issues once instead of repeating a priority category in four summaries", () => {
    const { container } = render(
      <SignalsScreen signals={demoWeek.signals} onAction={vi.fn()} onTrack={vi.fn()} />
    );

    expect(container.querySelector(".signals-screen")).toHaveClass(
      "!h-full",
      "!min-h-0",
      "overflow-y-auto",
      "touch-pan-y"
    );
    expect(screen.getByLabelText("Current signal issues")).toBeInTheDocument();
    expect(screen.getAllByText("Resume dormant")).toHaveLength(1);
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Other signals")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Plan drift details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Energy thin details" })).toBeInTheDocument();
    expect(screen.getByText("Resume dormant")).toHaveClass("break-words");
    expect(screen.getByText("Wake-up")).toHaveClass("whitespace-nowrap", "shrink-0");
    expect(screen.getByText("Plan drift")).toHaveClass("break-words");
    expect(screen.queryByText("The project was planned, then received no active block.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Evidence" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Signal summaries")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Plan: Drift" })).not.toBeInTheDocument();
  });

  it("sends the selected issue's project and minutes directly to Plan", () => {
    const onAction = vi.fn();
    render(<SignalsScreen signals={demoWeek.signals} onAction={onAction} onTrack={vi.fn()} />);

    const issue = screen.getByRole("article", { name: "Resume dormant: Wake-up" });
    const action = within(issue).getByRole("button", { name: "Restart" });
    expect(action).toHaveClass("bg-desk-accent-soft", "text-desk-accent");
    expect(action).not.toHaveClass("bg-desk-accent", "text-white");
    fireEvent.click(action);

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
    fireEvent.click(within(issue).getByRole("button", { name: "Open Resume dormant details" }));

    const detail = screen.getByRole("region", { name: "Resume dormant" });
    expect(detail).toHaveClass("bg-desk-paper");
    expect(within(detail).getByText("Inactive")).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Restart" })).toHaveClass("bg-desk-accent-soft");
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
