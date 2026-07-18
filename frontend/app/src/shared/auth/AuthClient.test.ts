import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthClient } from "./AuthClient";

const account = {
  id: 7,
  email: "user@example.com",
  display_name: "User",
  timezone: "UTC",
  locale: "en",
  created_at: "2026-07-17T12:00:00Z",
  updated_at: "2026-07-17T12:00:00Z"
};

function tokenResponse(accessToken: string) {
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 900,
    user: account
  };
}

describe("AuthClient", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps the access token in memory and adds it to personal requests", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse("access-one")), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    const client = new AuthClient("http://127.0.0.1:8000", { fetchImpl });

    const login = await client.login({
      email: "user@example.com",
      password: "correct horse battery staple"
    });
    await client.fetch("http://127.0.0.1:8000/goals", { method: "GET" });

    expect(login.ok).toBe(true);
    const request = fetchImpl.mock.calls[1][1] as RequestInit;
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer access-one");
    expect(request.credentials).toBe("include");
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("invokes browser fetch without rebinding it to the client instance", async () => {
    const contexts: unknown[] = [];
    const fetchImpl = function (this: unknown) {
      contexts.push(this);
      return Promise.resolve(new Response(JSON.stringify(tokenResponse("access-one")), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    };
    const client = new AuthClient("http://127.0.0.1:8000", { fetchImpl });

    await client.login({
      email: "user@example.com",
      password: "correct horse battery staple"
    });

    expect(contexts).toEqual([undefined]);
  });

  it("restores a session with the readable csrf cookie", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(tokenResponse("restored-access")), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const client = new AuthClient("http://127.0.0.1:8000", {
      fetchImpl,
      cookieReader: () => "theseus_csrf=csrf-value"
    });

    const restored = await client.restore();

    expect(restored.data?.user).toEqual(account);
    const request = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get("X-CSRF-Token")).toBe("csrf-value");
    expect(request.credentials).toBe("include");
  });

  it("refreshes once after a 401 and retries with the rotated access token", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse("old-access")), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse("new-access")), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    const client = new AuthClient("http://127.0.0.1:8000", {
      fetchImpl,
      cookieReader: () => "theseus_csrf=csrf-value"
    });
    await client.login({
      email: "user@example.com",
      password: "correct horse battery staple"
    });

    const response = await client.fetch("http://127.0.0.1:8000/goals", { method: "GET" });

    expect(response.status).toBe(200);
    const retried = fetchImpl.mock.calls[3][1] as RequestInit;
    expect(new Headers(retried.headers).get("Authorization")).toBe("Bearer new-access");
  });

  it("shares one refresh across concurrent unauthorized requests", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse("old-access")), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse("shared-access")), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    const client = new AuthClient("http://127.0.0.1:8000", {
      fetchImpl,
      cookieReader: () => "theseus_csrf=csrf-value"
    });
    await client.login({
      email: "user@example.com",
      password: "correct horse battery staple"
    });

    const [first, second] = await Promise.all([
      client.fetch("http://127.0.0.1:8000/goals", { method: "GET" }),
      client.fetch("http://127.0.0.1:8000/projects", { method: "GET" })
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(
      fetchImpl.mock.calls.filter(([input]) => String(input).endsWith("/auth/refresh"))
    ).toHaveLength(1);
    for (const call of fetchImpl.mock.calls.slice(4)) {
      const request = call[1] as RequestInit;
      expect(new Headers(request.headers).get("Authorization")).toBe("Bearer shared-access");
    }
  });

  it("refreshes an expired access token before revoking the server session on logout", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse("expired-access")), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse("rotated-access")), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new AuthClient("http://127.0.0.1:8000", {
      fetchImpl,
      cookieReader: () => "theseus_csrf=csrf-value"
    });
    await client.login({
      email: "user@example.com",
      password: "correct horse battery staple"
    });

    const result = await client.logout();

    expect(result.ok).toBe(true);
    expect(fetchImpl.mock.calls.map(([input]) => input)).toEqual([
      "http://127.0.0.1:8000/auth/login",
      "http://127.0.0.1:8000/auth/logout",
      "http://127.0.0.1:8000/auth/refresh",
      "http://127.0.0.1:8000/auth/logout"
    ]);
    const retriedLogout = fetchImpl.mock.calls[3][1] as RequestInit;
    expect(new Headers(retriedLogout.headers).get("Authorization")).toBe("Bearer rotated-access");
  });

  it("keeps the local session when the server cannot confirm logout", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse("access-one")), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    const client = new AuthClient("http://127.0.0.1:8000", { fetchImpl });
    await client.login({
      email: "user@example.com",
      password: "correct horse battery staple"
    });

    const logout = await client.logout();
    await client.fetch("http://127.0.0.1:8000/goals", { method: "GET" });

    expect(logout).toEqual({
      ok: false,
      data: null,
      error: { code: "network_error", message: "Failed to fetch", status: 0 }
    });
    const personalRequest = fetchImpl.mock.calls[2][1] as RequestInit;
    expect(new Headers(personalRequest.headers).get("Authorization")).toBe("Bearer access-one");
  });
});
