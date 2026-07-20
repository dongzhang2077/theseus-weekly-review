import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { demoWeek } from "../../shared/demo/demoWeek";
import { ReviewScreen } from "./ReviewScreen";

const demoRange = { start: "2026-06-08", end: "2026-06-14" };

describe("ReviewScreen", () => {
  it("changes the actual requested week from arrows and any selected date", () => {
    const onWeekChange = vi.fn();
    render(
      <ReviewScreen
        review={demoWeek.review}
        weekRange={demoRange}
        onWeekChange={onWeekChange}
        onPlan={vi.fn()}
        onAction={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(onWeekChange).toHaveBeenLastCalledWith({ start: "2026-06-01", end: "2026-06-07" });

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(onWeekChange).toHaveBeenLastCalledWith({ start: "2026-06-15", end: "2026-06-21" });

    fireEvent.change(screen.getByLabelText("Choose review week"), { target: { value: "2026-07-18" } });
    expect(onWeekChange).toHaveBeenLastCalledWith({ start: "2026-07-13", end: "2026-07-19" });
  });

  it("renders an opaque detail page without repeating the finding and restores its list on back", async () => {
    const onDetailOpenChange = vi.fn();
    const finding = "Theseus backend received 4.0 hours.";
    const review = {
      ...demoWeek.review,
      wins: [
        {
          id: "win-one",
          title: "Progress on Theseus backend",
          reason: finding,
          evidence: [{ label: "Finding", value: finding }]
        }
      ]
    };
    render(
      <ReviewScreen
        review={review}
        weekRange={demoRange}
        onWeekChange={vi.fn()}
        onPlan={vi.fn()}
        onAction={vi.fn()}
        onDetailOpenChange={onDetailOpenChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Wins" }));
    fireEvent.click(screen.getByRole("button", { name: "Progress on Theseus backend" }));

    expect(screen.getAllByText(finding)).toHaveLength(1);
    expect(screen.queryByRole("dialog", { name: "Wins" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Week status summary" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Progress on Theseus backend" })).toHaveClass("bg-desk-paper");
    await waitFor(() => expect(onDetailOpenChange).toHaveBeenLastCalledWith(true));

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("dialog", { name: "Wins" })).toBeInTheDocument();
    await waitFor(() => expect(onDetailOpenChange).toHaveBeenLastCalledWith(false));
  });

  it("keeps real week navigation available for an empty week", () => {
    const onPlan = vi.fn();
    render(
      <ReviewScreen
        review={null}
        weekRange={{ start: "2026-07-13", end: "2026-07-19" }}
        onWeekChange={vi.fn()}
        onPlan={onPlan}
        onAction={vi.fn()}
      />
    );

    expect(screen.getByText("Jul 13 - Jul 19")).toBeInTheDocument();
    expect(screen.getByText("No review for this week")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Week status summary" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create a plan" }));
    expect(onPlan).toHaveBeenCalledOnce();
  });

  it("sends the selected Risk action instead of the global review suggestion", () => {
    const onAction = vi.fn();
    render(
      <ReviewScreen
        review={demoWeek.review}
        weekRange={demoRange}
        onWeekChange={vi.fn()}
        onPlan={vi.fn()}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Risks" }));
    fireEvent.click(screen.getByRole("button", { name: /Resume dormant/ }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule restart" }));

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({
      label: "Schedule restart",
      suggestion: expect.objectContaining({ projectId: 3, deltaMinutes: 60 })
    }));
  });
});
