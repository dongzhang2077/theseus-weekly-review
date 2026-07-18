import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthClient, type AuthAccount } from "../../shared/auth/AuthClient";
import { AccountSheet } from "./AccountSheet";

const account: AuthAccount = {
  id: 7,
  email: "user@example.com",
  display_name: "User",
  timezone: "UTC",
  locale: "en",
  created_at: "2026-07-17T12:00:00Z",
  updated_at: "2026-07-17T12:00:00Z"
};

describe("AccountSheet", () => {
  it("updates the signed-in profile without changing identity", async () => {
    const updated = { ...account, display_name: "Alex" };
    const client = {
      updateProfile: vi.fn().mockResolvedValue({ ok: true, data: updated, error: null })
    } as unknown as AuthClient;
    const onAccountChange = vi.fn();

    render(
      <AccountSheet
        open
        account={account}
        client={client}
        onClose={vi.fn()}
        onAccountChange={onAccountChange}
        onSignedOut={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(onAccountChange).toHaveBeenCalledWith(updated));
    expect(client.updateProfile).toHaveBeenCalledWith({ display_name: "Alex", timezone: "UTC" });
  });

  it("signs out through the account surface", async () => {
    const client = {
      logout: vi.fn().mockResolvedValue({ ok: true, data: null, error: null })
    } as unknown as AuthClient;
    const onSignedOut = vi.fn();
    render(
      <AccountSheet
        open
        account={account}
        client={client}
        onClose={vi.fn()}
        onAccountChange={vi.fn()}
        onSignedOut={onSignedOut}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1));
  });

  it("keeps the account open and explains a failed sign out", async () => {
    const client = {
      logout: vi.fn().mockResolvedValue({
        ok: false,
        data: null,
        error: { code: "network_error", message: "Local service is unavailable", status: 0 }
      })
    } as unknown as AuthClient;
    const onSignedOut = vi.fn();
    render(
      <AccountSheet
        open
        account={account}
        client={client}
        onClose={vi.fn()}
        onAccountChange={vi.fn()}
        onSignedOut={onSignedOut}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Local service is unavailable");
    expect(onSignedOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });
});
