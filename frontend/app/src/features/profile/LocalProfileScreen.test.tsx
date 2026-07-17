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
    expect(screen.queryByLabelText("Profile name")).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /Start on this device/ }));
    expect(screen.getByText("Local only")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "  Douglas  " }
    });
    expect(screen.getByText("Douglas")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Time zone"), {
      target: { value: "America/Vancouver" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create and continue" }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: "Douglas",
        timezone: "America/Vancouver"
      })
    );
  });

  it("connects an email-code demo account and records a sync choice", () => {
    render(
      <LocalProfileScreen
        users={[user]}
        loading={false}
        unavailable={false}
        saving={false}
        error={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Login and sync/ }));

    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue with Apple/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Email code/ }));
    fireEvent.change(screen.getByLabelText("Account email"), {
      target: { value: "douglas@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Email code"), {
      target: { value: "000000" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect account" }));

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("douglas@example.com is connected for this local demo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync this local profile" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Review and merge" }));
    expect(screen.getByRole("status")).toHaveTextContent("Review and merge");
  });

  it("keeps account conflict choices disabled before email-code connection", () => {
    render(
      <LocalProfileScreen
        users={[user]}
        loading={false}
        unavailable={false}
        saving={false}
        error={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Login and sync/ }));

    expect(screen.getByRole("button", { name: "Use cloud profile" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep both profiles" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Review and merge" })).toBeDisabled();
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
