import { describe, expect, it } from "vitest";
import type { FetchLike } from "./loadAppWeek";
import { createLocalUser, listLocalUsers, type LocalUser } from "./users";

const user: LocalUser = {
  id: 7,
  display_name: "Douglas",
  timezone: "America/Los_Angeles",
  locale: "en-US",
  created_at: "2026-07-15T12:00:00",
  updated_at: "2026-07-15T12:00:00"
};

describe("local user api helpers", () => {
  it("lists persisted local users", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return { ok: true, status: 200, json: async () => [user] };
    };

    await expect(
      listLocalUsers({ apiBaseUrl: "http://127.0.0.1:8000/", fetchImpl })
    ).resolves.toEqual({ ok: true, data: [user], error: null });
    expect(calls[0]).toMatchObject({
      input: "http://127.0.0.1:8000/users",
      init: { method: "GET" }
    });
  });

  it("creates a local user without requiring an existing user header", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return { ok: true, status: 201, json: async () => user };
    };

    const result = await createLocalUser({
      apiBaseUrl: "http://127.0.0.1:8000",
      payload: {
        display_name: "Douglas",
        timezone: "America/Los_Angeles",
        locale: "en-US"
      },
      fetchImpl
    });

    expect(result).toEqual({ ok: true, data: user, error: null });
    expect(calls[0].init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      display_name: "Douglas",
      timezone: "America/Los_Angeles"
    });
  });

  it("returns a recoverable error when the local API is unavailable", async () => {
    await expect(
      listLocalUsers({
        apiBaseUrl: "http://127.0.0.1:8000",
        fetchImpl: async () => {
          throw new Error("offline");
        }
      })
    ).resolves.toEqual({ ok: false, data: null, error: "offline" });
  });
});
