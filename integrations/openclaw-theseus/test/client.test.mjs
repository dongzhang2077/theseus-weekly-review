import assert from "node:assert/strict";
import test from "node:test";

import { TheseusAdapterError, readTheseusContext } from "../dist/client.js";

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
