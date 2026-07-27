import assert from "node:assert/strict";
import test from "node:test";

import {
  TheseusAdapterError,
  decideTheseusWeeklyPlanProposal,
  draftTheseusWeeklyPlanProposal,
  readTheseusContext,
} from "../dist/client.js";

const config = {
  baseUrl: "http://127.0.0.1:8000",
  accessToken: "ths_int_test-token-value",
  channelType: "openclaw",
  externalIdentity: "gateway-owner",
  timeoutMs: 1000,
};

test("read context sends only the scoped integration contract", async () => {
  let captured;
  const result = await readTheseusContext(
    config,
    { weekStart: "2026-07-20", weekEnd: "2026-07-26" },
    {
      messageId: "message-001",
      fetch: async (url, init) => {
        captured = {url: String(url), init};
        return new Response(JSON.stringify({context_version: "v1", user_id: 7}), {
          status: 200,
          headers: {"content-type": "application/json"},
        });
      },
    },
  );

  assert.deepEqual(result, {context_version: "v1", user_id: 7});
  assert.match(captured.url, /week_start=2026-07-20/);
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.init.headers.Authorization, `Bearer ${config.accessToken}`);
  assert.equal(captured.init.headers["X-Channel-Type"], "openclaw");
  assert.equal(captured.init.headers["X-External-Identity"], "gateway-owner");
  assert.equal(captured.init.headers["X-External-Message-ID"], "message-001");
});

test("draft proposal requires a trusted message ID and sends only the draft contract", async () => {
  await assert.rejects(
    draftTheseusWeeklyPlanProposal(
      config,
      {
        reviewWeekStart: "2026-07-20",
        reviewWeekEnd: "2026-07-26",
        targetWeekStart: "2026-07-27",
        targetWeekEnd: "2026-08-02",
      },
    ),
    (error) => {
      assert(error instanceof TheseusAdapterError);
      assert.equal(error.code, "external_message_id_required");
      return true;
    },
  );

  let captured;
  const result = await draftTheseusWeeklyPlanProposal(
    config,
    {
      reviewWeekStart: "2026-07-20",
      reviewWeekEnd: "2026-07-26",
      targetWeekStart: "2026-07-27",
      targetWeekEnd: "2026-08-02",
    },
    {
      messageId: "trusted-message-001",
      fetch: async (url, init) => {
        captured = {url: String(url), init};
        return new Response(JSON.stringify({id: 8, status: "pending"}), {
          status: 201,
          headers: {"content-type": "application/json"},
        });
      },
    },
  );

  assert.deepEqual(result, {id: 8, status: "pending"});
  assert.equal(
    captured.url,
    "http://127.0.0.1:8000/integrations/channel/proposals/weekly-adjustment",
  );
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers["X-External-Message-ID"], "trusted-message-001");
  assert.equal(captured.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(captured.init.body), {
    review_week_start: "2026-07-20",
    review_week_end: "2026-07-26",
    target_week_start: "2026-07-27",
    target_week_end: "2026-08-02",
  });
});

test("proposal decision accepts only the decision contract and trusted message ID", async () => {
  await assert.rejects(
    decideTheseusWeeklyPlanProposal(
      config,
      {proposalId: 8, expectedVersion: 1, decision: "approve"},
    ),
    (error) => {
      assert(error instanceof TheseusAdapterError);
      assert.equal(error.code, "external_message_id_required");
      return true;
    },
  );

  let captured;
  const result = await decideTheseusWeeklyPlanProposal(
    config,
    {proposalId: 8, expectedVersion: 1, decision: "reject", reason: "Not this week"},
    {
      messageId: "trusted-decision-001",
      fetch: async (url, init) => {
        captured = {url: String(url), init};
        return new Response(JSON.stringify({id: 13, proposal_id: 8, decision: "reject"}), {
          status: 200,
          headers: {"content-type": "application/json"},
        });
      },
    },
  );

  assert.deepEqual(result, {id: 13, proposal_id: 8, decision: "reject"});
  assert.equal(
    captured.url,
    "http://127.0.0.1:8000/integrations/channel/proposals/8/decision",
  );
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers["X-External-Message-ID"], "trusted-decision-001");
  assert.deepEqual(JSON.parse(captured.init.body), {
    expected_version: 1,
    decision: "reject",
    reason: "Not this week",
  });
});

test("authentication failures are redacted", async () => {
  await assert.rejects(
    readTheseusContext(config, {weekStart: "2026-07-20", weekEnd: "2026-07-26"}, {
      fetch: async () => new Response(JSON.stringify({detail: {code: "integration_access_denied"}}), {status: 401}),
    }),
    (error) => {
      assert(error instanceof TheseusAdapterError);
      assert.equal(error.code, "integration_access_denied");
      assert.equal(error.message, "Theseus pairing is unavailable");
      assert(!error.message.includes(config.accessToken));
      return true;
    },
  );
});

test("scope and replay conflicts are represented without returning server detail", async () => {
  await assert.rejects(
    readTheseusContext(config, {weekStart: "2026-07-20", weekEnd: "2026-07-26"}, {
      fetch: async () => new Response(JSON.stringify({detail: {code: "integration_scope_denied", internal: "context:read missing"}}), {status: 403}),
    }),
    (error) => {
      assert(error instanceof TheseusAdapterError);
      assert.equal(error.code, "integration_scope_denied");
      assert.equal(error.message, "Theseus read access is not allowed");
      assert(!error.message.includes("context:read"));
      return true;
    },
  );

  await assert.rejects(
    readTheseusContext(config, {weekStart: "2026-07-20", weekEnd: "2026-07-26"}, {
      fetch: async () => new Response(JSON.stringify({detail: {code: "external_message_replay_conflict", internal: "request hash differs"}}), {status: 409}),
    }),
    (error) => {
      assert(error instanceof TheseusAdapterError);
      assert.equal(error.code, "external_message_replay_conflict");
      assert.equal(error.message, "Theseus rejected the repeated request");
      assert(!error.message.includes("request hash"));
      return true;
    },
  );
});

test("network failures do not expose configuration", async () => {
  await assert.rejects(
    readTheseusContext(config, {weekStart: "2026-07-20", weekEnd: "2026-07-26"}, {
      fetch: async () => { throw new Error("socket included sensitive request"); },
    }),
    (error) => {
      assert(error instanceof TheseusAdapterError);
      assert.equal(error.code, "theseus_unavailable");
      assert.equal(error.message, "Theseus is unavailable");
      return true;
    },
  );
});

test("timeouts and unexpected failures remain redacted", async () => {
  await assert.rejects(
    readTheseusContext(config, {weekStart: "2026-07-20", weekEnd: "2026-07-26"}, {
      fetch: async () => {
        const error = new Error("secret upstream details");
        error.name = "AbortError";
        throw error;
      },
    }),
    (error) => {
      assert(error instanceof TheseusAdapterError);
      assert.equal(error.code, "theseus_timeout");
      assert.equal(error.message, "Theseus did not respond in time");
      return true;
    },
  );

  await assert.rejects(
    readTheseusContext(config, {weekStart: "2026-07-20", weekEnd: "2026-07-26"}, {
      fetch: async () => new Response("unexpected implementation detail", {status: 500}),
    }),
    (error) => {
      assert(error instanceof TheseusAdapterError);
      assert.equal(error.code, "theseus_request_failed");
      assert.equal(error.message, "Theseus could not complete the request");
      return true;
    },
  );
});
