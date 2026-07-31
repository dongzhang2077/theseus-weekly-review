import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { demoWeek } from "../../shared/demo/demoWeek";
import { InsightsScreen } from "./InsightsScreen";

const demoRange = { start: "2026-06-08", end: "2026-06-14" };

function renderInsights(
  overrides: Partial<ComponentProps<typeof InsightsScreen>> = {}
) {
  const props: ComponentProps<typeof InsightsScreen> = {
    review: demoWeek.review,
    signals: demoWeek.signals,
    weekRange: demoRange,
    accountToday: "2026-07-30",
    hasTimeLogs: true,
    onWeekChange: vi.fn(),
    onGenerate: vi.fn(),
    onAction: vi.fn(),
    onTrack: vi.fn(),
    ...overrides,
  };
  return { ...render(<InsightsScreen {...props} />), props };
}

describe("InsightsScreen", () => {
  it("converges Review and Signals into one low-noise Level 1", () => {
    renderInsights();

    expect(screen.getByRole("heading", { name: "Insights" })).toBeInTheDocument();
    expect(screen.getByLabelText("Week insight status")).toHaveTextContent("Needs attention");
    expect(screen.getByLabelText("Week insight status")).toHaveTextContent("2 wins");
    expect(screen.getByRole("article", { name: "Resume dormant: Wake-up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Wins" })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Open Other issues" })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Open Steady checks" })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Open Weekly review" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Other issues" }));
    const dialog = screen.getByRole("dialog", { name: "Other issues" });
    expect(within(dialog).getByText("Plan drift")).toBeInTheDocument();
    expect(within(dialog).getByText("Energy thin")).toBeInTheDocument();
    expect(within(dialog).queryByText("Resume dormant")).not.toBeInTheDocument();
  });

  it("preserves signal and review evidence as separate drill-down paths", async () => {
    const onDetailOpenChange = vi.fn();
    renderInsights({ onDetailOpenChange });

    fireEvent.click(
      within(screen.getByRole("article", { name: "Resume dormant: Wake-up" }))
        .getByRole("button", { name: "Open Resume dormant details" })
    );
    const summary = screen.getByRole("region", { name: "Resume dormant summary" });
    fireEvent.click(within(summary).getByRole("button", { name: "Evidence" }));
    expect(screen.getByRole("region", { name: "Resume dormant evidence" })).toBeInTheDocument();
    await waitFor(() => expect(onDetailOpenChange).toHaveBeenLastCalledWith(true));

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(onDetailOpenChange).toHaveBeenLastCalledWith(false));

    fireEvent.click(screen.getByRole("button", { name: "Open Wins" }));
    const wins = screen.getByRole("dialog", { name: "Wins" });
    fireEvent.click(within(wins).getByRole("button", { name: demoWeek.review.wins[0].title }));
    expect(
      screen.getByRole("region", { name: demoWeek.review.wins[0].title })
    ).toBeInTheDocument();
  });

  it("supports historical week navigation and a direct reset to this week", () => {
    const onWeekChange = vi.fn();
    renderInsights({ onWeekChange });

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(onWeekChange).toHaveBeenLastCalledWith({
      start: "2026-06-01",
      end: "2026-06-07",
    });

    fireEvent.click(screen.getByRole("button", { name: "This week" }));
    expect(onWeekChange).toHaveBeenLastCalledWith({
      start: "2026-07-27",
      end: "2026-08-02",
    });
  });

  it("gives empty weeks one evidence-aware next action", () => {
    const onGenerate = vi.fn();
    const generated = renderInsights({
      review: null,
      signals: null,
      hasTimeLogs: true,
      onGenerate,
    });
    expect(screen.getByText("Review not created")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(onGenerate).toHaveBeenCalledOnce();

    generated.unmount();
    const onTrack = vi.fn();
    renderInsights({
      review: null,
      signals: null,
      hasTimeLogs: false,
      onTrack,
    });
    expect(screen.getByText("No week evidence")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Today" }));
    expect(onTrack).toHaveBeenCalledOnce();
  });
});
