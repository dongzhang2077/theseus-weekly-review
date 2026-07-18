import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthResult, SessionResult } from "../../shared/auth/AuthClient";
import { AuthScreen } from "./AuthScreen";

const account = {
  id: 7,
  email: "user@example.com",
  display_name: "User",
  timezone: "UTC",
  locale: "en",
  created_at: "2026-07-17T12:00:00Z",
  updated_at: "2026-07-17T12:00:00Z"
};

const session: AuthResult<SessionResult> = {
  ok: true,
  data: { user: account },
  error: null
};

function baseProps() {
  return {
    onLogin: vi.fn().mockResolvedValue(session),
    onRegister: vi.fn().mockResolvedValue(session),
    onRetry: vi.fn()
  };
}

describe("AuthScreen", () => {
  it("collects a formal account registration and uses browser context", async () => {
    const props = baseProps();
    render(<AuthScreen phase="signed_out" {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "correct horse battery staple" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(props.onRegister).toHaveBeenCalledTimes(1));
    expect(props.onRegister).toHaveBeenCalledWith(expect.objectContaining({
      display_name: "Alex",
      email: "alex@example.com",
      password: "correct horse battery staple",
      timezone: expect.any(String),
      locale: expect.any(String)
    }));
  });

  it("keeps sign in and account creation as the only signed-out paths", () => {
    const props = baseProps();
    render(<AuthScreen phase="signed_out" {...props} />);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText(/recovery/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to sign in" })).toBeInTheDocument();
  });
});
