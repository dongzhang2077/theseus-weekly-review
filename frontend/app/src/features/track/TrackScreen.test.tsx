import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoWeek } from "../../shared/demo/demoWeek";
import { TrackScreen } from "./TrackScreen";

describe("TrackScreen", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps the task and reason ahead of a compact timer", () => {
    render(<TrackScreen track={demoWeek.track} />);

    expect(screen.getByText("Frontend build block")).toBeInTheDocument();
    expect(screen.getByText("Marked as a weekly priority")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("switches the recommendation without starting a session", () => {
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Backend polish")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Showing the next activity");
  });

  it("separates pause from ending and captures a session result", () => {
    vi.useFakeTimers();
    render(<TrackScreen track={demoWeek.track} />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    act(() => vi.advanceTimersByTime(61_000));
    expect(screen.getByText("01:01")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByText("01:01")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "End focus" }));
    const result = screen.getByRole("region", { name: "Session result" });
    fireEvent.click(within(result).getByRole("button", { name: "Completed" }));
    fireEvent.change(within(result).getByLabelText("Result note"), {
      target: { value: "Finished the first pass." }
    });
    fireEvent.click(within(result).getByRole("button", { name: "Save result" }));

    expect(screen.queryByRole("region", { name: "Session result" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Session kept in this demo");
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });
});
