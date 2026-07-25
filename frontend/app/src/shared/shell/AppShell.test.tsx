import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("locks navigation and account controls while a result modal is open", () => {
    const onTabChange = vi.fn();
    const onProfileChange = vi.fn();
    render(
      <AppShell
        activeTab="track"
        onTabChange={onTabChange}
        interactionLocked
        profileName="Theseus Demo"
        onProfileChange={onProfileChange}
      >
        Focus result
      </AppShell>
    );

    ["Review", "Signals", "Focus", "Plan"].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    });
    const account = screen.getByRole("button", { name: /Open account/ });
    expect(account).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Plan" }));
    fireEvent.click(account);
    expect(onTabChange).not.toHaveBeenCalled();
    expect(onProfileChange).not.toHaveBeenCalled();
  });

  it("gives full-screen detail pages the complete phone canvas", () => {
    render(
      <AppShell
        activeTab="review"
        onTabChange={vi.fn()}
        navigationHidden
        profileName="Theseus Demo"
        onProfileChange={vi.fn()}
      >
        Review detail
      </AppShell>
    );

    expect(screen.getByText("Review detail")).toHaveClass("h-full");
    expect(screen.queryByRole("navigation", { name: "App sections" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open account/ })).not.toBeInTheDocument();
  });

  it("keeps bottom navigation icon-only while preserving accessible names", () => {
    render(
      <AppShell activeTab="signals" onTabChange={vi.fn()}>
        Signals content
      </AppShell>
    );

    ["Review", "Signals", "Focus", "Plan"].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("title", label);
      expect(screen.queryByText(label, { selector: "nav span" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Signals" })).toHaveAttribute("aria-current", "page");
  });
});
