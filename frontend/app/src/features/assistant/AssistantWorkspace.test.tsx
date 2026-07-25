import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PreferenceRecord,
  ProposalDetail,
  ProposalRecord
} from "../../shared/api/agentMemory";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import { AssistantWorkspace } from "./AssistantWorkspace";

const proposal: ProposalRecord = {
  id: 9,
  user_id: 2,
  proposal_type: "weekly_plan_adjustment",
  source: "deterministic",
  title: "Reduce Friday load",
  rationale: "Friday is over capacity.",
  evidence: [{ planned_minutes: 180, capacity_minutes: 120 }],
  before: { minutes: 180 },
  after: { minutes: 120 },
  expires_at: null,
  status: "pending",
  version: 2,
  created_at: "2026-07-25T00:00:00Z",
  updated_at: "2026-07-25T00:00:00Z"
};

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

const proposalDetail: ProposalDetail = {
  proposal,
  decisions: [],
  actions: [],
  outcomes: []
};

describe("AssistantWorkspace", () => {
  it("keeps summary, pending list, and proposal detail as separate layers", async () => {
    const approved = {
      ...proposalDetail,
      proposal: { ...proposal, status: "approved" as const, version: 3 }
    };
    const fetchImpl = routeFetch({
      "GET /proposals": [proposal],
      "GET /preferences?include_deleted=true": [preference],
      "GET /proposals/9": proposalDetail,
      "POST /proposals/9/decisions": approved
    });

    render(
      <AssistantWorkspace
        open
        apiBaseUrl="http://127.0.0.1:8000"
        fetchImpl={fetchImpl}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText("Your control")).toBeInTheDocument();
    expect(screen.queryByText(proposal.title)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Pending/ }));
    fireEvent.click(screen.getByRole("button", { name: /Reduce Friday load/ }));

    expect(await screen.findByText("Friday is over capacity.")).toBeInTheDocument();
    expect(screen.getAllByText("180")).not.toHaveLength(0);
    expect(screen.getAllByText("120")).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Edit proposal" }));
    fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledWith(
        "http://127.0.0.1:8000/proposals/9/decisions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            expected_version: 2,
            decision: "edit",
            decided_after: { minutes: 90 },
            reason: "Edited and approved in Assistant"
          })
        })
      );
    });
    expect(await screen.findByText("Approved")).toBeInTheDocument();
  });

  it("corrects and soft-deletes inferred memory with explicit confirmation", async () => {
    const corrected = { ...preference, source: "user_stated" as const, value: 45, version: 4 };
    const deleted = { ...corrected, deleted_at: "2026-07-25T01:00:00Z", version: 5 };
    const fetchImpl = routeFetch({
      "GET /proposals": [],
      "GET /preferences?include_deleted=true": [preference],
      "GET /preferences/4?include_deleted=true": {
        preference,
        revisions: []
      },
      "PATCH /preferences/4": { preference: corrected, revision_id: 8 },
      "DELETE /preferences/4?expected_version=4&reason=Removed+from+Assistant+memory": {
        preference: deleted,
        revision_id: 9
      }
    });

    render(
      <AssistantWorkspace
        open
        apiBaseUrl="http://127.0.0.1:8000"
        fetchImpl={fetchImpl}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Your control");
    fireEvent.click(screen.getByRole("button", { name: /Memory/ }));
    fireEvent.click(screen.getByRole("button", { name: /Focus length/ }));
    expect(await screen.findByText(/80% confidence/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Preference value"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("You told the assistant.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete preference" }));
    expect(screen.getByText("Delete this preference?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Deleted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });
});

function routeFetch(routes: Record<string, unknown>): ReturnType<typeof vi.fn<FetchLike>> {
  return vi.fn<FetchLike>().mockImplementation(async (input, init) => {
    const url = new URL(input);
    const key = `${init.method} ${url.pathname}${url.search}`;
    if (!(key in routes)) throw new Error(`Unexpected request: ${key}`);
    return {
      ok: true,
      status: 200,
      json: async () => routes[key]
    };
  });
}
