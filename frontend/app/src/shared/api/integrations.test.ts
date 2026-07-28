import { describe, expect, it, vi } from "vitest";
import {
  listIntegrations,
  pairIntegration,
  revokeIntegration,
  type IntegrationCredential
} from "./integrations";
import type { FetchLike } from "./loadAppWeek";

const credential: IntegrationCredential = {
  id: 5,
  user_id: 2,
  label: "OpenClaw desk",
  channel_type: "openclaw",
  scopes: ["context:read"],
  token_prefix: "ths_int_abc",
  expires_at: "2026-08-01T12:00:00Z",
  revoked_at: null,
  last_used_at: null,
  created_at: "2026-07-28T12:00:00Z"
};

describe("integrations API", () => {
  it("lists credentials through the authenticated fetch", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [credential]
    });

    const result = await listIntegrations({
      apiBaseUrl: "http://127.0.0.1:8765/",
      fetchImpl
    });

    expect(result).toEqual({ status: "ok", data: [credential], error: null });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8765/integrations",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("pairs an OpenClaw identity and returns the one-time token", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ credential, access_token: "ths_int_once" })
    });

    const result = await pairIntegration(
      { apiBaseUrl: "http://127.0.0.1:8765", fetchImpl },
      {
        label: " OpenClaw desk ",
        channelType: "openclaw",
        externalIdentity: " openclaw-desk-1 ",
        scopes: ["context:read", "proposal:create"],
        expiresInSeconds: 86400
      }
    );

    expect(result.data?.access_token).toBe("ths_int_once");
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1].body))).toEqual({
      label: "OpenClaw desk",
      channel_type: "openclaw",
      external_identity: "openclaw-desk-1",
      scopes: ["context:read", "proposal:create"],
      expires_in_seconds: 86400
    });
  });

  it("returns a useful conflict and accepts a no-content revoke", async () => {
    const fetchImpl = vi.fn<FetchLike>()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ detail: { message: "This channel identity already has an active pairing" } })
      })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });
    const options = { apiBaseUrl: "http://127.0.0.1:8765", fetchImpl };

    const conflict = await pairIntegration(options, {
      label: "OpenClaw desk",
      channelType: "openclaw",
      externalIdentity: "openclaw-desk-1",
      scopes: ["context:read"],
      expiresInSeconds: 86400
    });
    const revoked = await revokeIntegration(options, 5);

    expect(conflict).toEqual({
      status: "conflict",
      data: null,
      error: "This channel identity already has an active pairing"
    });
    expect(revoked).toEqual({ status: "ok", data: null, error: null });
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("http://127.0.0.1:8765/integrations/5");
    expect(fetchImpl.mock.calls[1]?.[1].method).toBe("DELETE");
  });
});
