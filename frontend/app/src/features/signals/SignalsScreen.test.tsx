import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import { demoWeek } from "../../shared/demo/demoWeek";
import { SignalsScreen } from "./SignalsScreen";

describe("SignalsScreen", () => {
  it("shows one priority signal and four stable, text-labelled summaries", () => {
    const { container } = render(
      <SignalsScreen signals={demoWeek.signals} onPlan={vi.fn()} onTrack={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Priority signal: Stage, Dormant" })).toHaveTextContent(
      "A restart project stayed inactive this week."
    );
    const summary = screen.getByLabelText("Signal summaries");
    expect(
      within(summary).getAllByRole("button").map((button) => button.getAttribute("aria-label"))
    ).toEqual(["Plan: Drift", "Stage: Dormant", "Goal: Aligned", "Energy: Thin"]);
    expect(container.querySelector(".orbit-visual")).not.toBeInTheDocument();
    expect(container.querySelector(".orbit-dot")).not.toBeInTheDocument();
    expect(container.querySelector(".signal-entry")).not.toBeInTheDocument();
  });

  it("opens signal evidence, then a concrete detail with a plan action", () => {
    const onPlan = vi.fn();
    const signals: AppWeekViewModel["signals"] = {
      summaries: demoWeek.signals.summaries,
      evidence: [
        {
          id: "frontend-under-plan",
          signalId: "plan",
          title: "Theseus frontend",
          severity: "attention",
          status: "Under plan",
          value: "-3h",
          reason: "Theseus frontend logged 3h below plan.",
          rows: [
            { label: "Planned", value: "4h" },
            { label: "Actual", value: "1h" },
            { label: "Delta", value: "-3h" }
          ],
          trace: {
            range: "Jun 8 - Jun 14",
            source: "Weekly plan",
            relatedTo: "Theseus frontend",
            records: "5 time logs",
            judgement: "Plan and actual time differ enough to need attention."
          },
          action: "Plan"
        }
      ]
    };

    render(<SignalsScreen signals={signals} onPlan={onPlan} onTrack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan: Drift" }));
    fireEvent.click(screen.getByRole("button", { name: "Theseus frontend: Under plan" }));

    const detail = screen.getByRole("region", { name: "Theseus frontend" });
    expect(within(detail).getByText("Planned")).toBeInTheDocument();
    expect(within(detail).getByText("Actual")).toBeInTheDocument();
    expect(within(detail).getByText("Delta")).toBeInTheDocument();
    expect(within(detail).getByRole("region", { name: "Evidence trace" })).toHaveTextContent("5 time logs");
    fireEvent.click(within(detail).getByRole("button", { name: "Adjust plan" }));
    expect(onPlan).toHaveBeenCalledOnce();
  });

  it("offers a direct action from the signal sheet", () => {
    const onPlan = vi.fn();

    render(<SignalsScreen signals={demoWeek.signals} onPlan={onPlan} onTrack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Stage: Dormant" }));
    fireEvent.click(screen.getByRole("button", { name: "Recover project" }));

    expect(onPlan).toHaveBeenCalledOnce();
  });

  it("shows a recovery action when one signal has no supporting evidence", () => {
    const onTrack = vi.fn();
    const signals: AppWeekViewModel["signals"] = {
      summaries: demoWeek.signals.summaries,
      evidence: demoWeek.signals.evidence.filter((row) => row.signalId !== "goal")
    };

    render(<SignalsScreen signals={signals} onPlan={vi.fn()} onTrack={onTrack} />);

    fireEvent.click(screen.getByRole("button", { name: "Goal: Aligned" }));
    expect(screen.getByText("No Goal evidence yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open track" }));
    expect(onTrack).toHaveBeenCalledOnce();
  });

  it("shows a track-first empty state when every signal has no data", () => {
    const onTrack = vi.fn();
    const signals: AppWeekViewModel["signals"] = {
      summaries: demoWeek.signals.summaries.map((signal) => ({
        ...signal,
        severity: "nodata",
        status: "No data"
      })),
      evidence: []
    };

    render(<SignalsScreen signals={signals} onPlan={vi.fn()} onTrack={onTrack} />);

    expect(screen.getByText("Track a little more first")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open track" }));
    expect(onTrack).toHaveBeenCalledOnce();
  });
});
