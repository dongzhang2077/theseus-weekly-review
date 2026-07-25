import { describe, expect, it, vi } from "vitest";
import {
  correctPreference,
  decideProposal,
  deletePreference,
  loadPreferences,
  type PreferenceRecord,
  type ProposalRecord
} from "./agentMemory";
import type { FetchLike } from "./loadAppWeek";

const preference: PreferenceRecord = {
  id: 4,
  user_id: 2,
  source: "inferred",
  preference_key: "focus_length",
  value: 30,
  scope_type: "global",
  scope_ref_id: null,
  provenance: { source: "sessions" },
  confidence: 0.8,
  review_after: "2026-08-01T00:00:00Z",
  expires_at: null,
  version: 3,
  deleted_at: null,
  created_at: "2026-07-20T00:00:00Z",
  updated_at: "2026-07-25T00:00:00Z"
};

const proposal: ProposalRecord = {
  id: 9,
  user_id: 2,
  proposal_type: "weekly_plan_adjustment",
  source: "deterministic",
  title: "Reduce Friday load",
  rationale: "Friday is over capacity.",
  evidence: [],
  before: { minutes: 180 },
  after: { minutes: 120 },
  expires_at: null,
  status: "pending",
  version: 2,
  created_at: "2026-07-25T00:00:00Z",
  updated_at: "2026-07-25T00:00:00Z"
};

describe("agentMemory API", () => {
  it("loads deleted and active preferences through the authenticated fetch", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [preference]
    });

    const result = await loadPreferences({
      apiBaseUrl: "http://127.0.0.1:8000/",
      fetchImpl
    });

    expect(result.data).toEqual([preference]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/preferences?include_deleted=true",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("sends optimistic versions for correction and deletion", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ preference: { ...preference, version: 4 }, revision_id: 6 })
    });
    const options = { apiBaseUrl: "http://127.0.0.1:8000", fetchImpl };

    await correctPreference(options, preference, 45);
    await deletePreference(options, preference);

    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1].body))).toEqual({
      expected_version: 3,
      value: 45,
      reason: "Corrected from Assistant memory"
    });
    expect(fetchImpl.mock.calls[1]?.[0]).toContain(
      "/preferences/4?expected_version=3"
    );
  });

  it("records an edited approval and surfaces version conflicts", async () => {
    const fetchImpl = vi.fn<FetchLike>()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          proposal: { ...proposal, status: "approved", version: 3 },
          decisions: [],
          actions: [],
          outcomes: []
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          detail: { message: "The proposal changed after it was loaded", current: proposal }
        })
      });
    const options = { apiBaseUrl: "http://127.0.0.1:8000", fetchImpl };

    await decideProposal(options, proposal, "edit", { minutes: 90 });
    const conflict = await decideProposal(options, proposal, "approve");

    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1].body))).toEqual({
      expected_version: 2,
      decision: "edit",
      decided_after: { minutes: 90 },
      reason: "Edited and approved in Assistant"
    });
    expect(conflict.status).toBe("conflict");
    expect(conflict.current).toEqual(proposal);
  });
});
