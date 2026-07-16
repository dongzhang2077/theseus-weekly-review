import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocalProfileScreen } from "./LocalProfileScreen";
import type { LocalUser } from "../../shared/api/users";

const user: LocalUser = {
  id: 7,
  display_name: "Douglas",
  timezone: "America/Los_Angeles",
  locale: "en-US",
  created_at: "2026-07-15T12:00:00",
  updated_at: "2026-07-15T12:00:00"
};

describe("LocalProfileScreen", () => {
  it("lets the user select an existing local profile", () => {
    const onSelect = vi.fn();
    render(
      <LocalProfileScreen
        users={[user]}
        loading={false}
        unavailable={false}
        saving={false}
        error={null}
        onSelect={onSelect}
        onCreate={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Douglas/ }));
    expect(onSelect).toHaveBeenCalledWith(user);
  });

  it("creates a named profile with browser-local context", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <LocalProfileScreen
        users={[]}
        loading={false}
        unavailable={false}
        saving={false}
        error={null}
        onSelect={vi.fn()}
        onCreate={onCreate}
        onRetry={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "  Douglas  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "Douglas" })
    );
  });

  it("shows a recovery action when profiles cannot be loaded", () => {
    const onRetry = vi.fn();
    render(
      <LocalProfileScreen
        users={[]}
        loading={false}
        unavailable={true}
        saving={false}
        error="offline"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Profiles unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
