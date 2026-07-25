import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("closes from the backdrop and Close button by default", () => {
    const onClose = vi.fn();

    render(
      <Sheet title="Session result" open onClose={onClose}>
        Result form
      </Sheet>
    );

    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    expect(closeButtons).toHaveLength(2);

    fireEvent.click(closeButtons[0]);
    fireEvent.click(closeButtons[1]);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("disables both close paths when closing is locked", () => {
    const onClose = vi.fn();

    render(
      <Sheet title="Session result" open closeDisabled onClose={onClose}>
        Saving result
      </Sheet>
    );

    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    expect(closeButtons).toHaveLength(2);
    expect(closeButtons[0]).toBeDisabled();
    expect(closeButtons[0]).toHaveClass("disabled:cursor-not-allowed", "disabled:opacity-60");
    expect(closeButtons[1]).toBeDisabled();
    expect(closeButtons[1]).toHaveClass("disabled:cursor-not-allowed", "disabled:opacity-40");

    fireEvent.click(closeButtons[0]);
    fireEvent.click(closeButtons[1]);

    expect(onClose).not.toHaveBeenCalled();
  });
});
