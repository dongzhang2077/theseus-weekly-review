import assert from "node:assert/strict";
import test from "node:test";

import plugin from "../dist/index.js";

test("registers optional context, proposal, decision, execution, and undo tools through the native OpenClaw SDK", () => {
  const registrations = [];
  const hooks = new Map();
  plugin.register({
    pluginConfig: {
      baseUrl: "http://127.0.0.1:8000",
      accessToken: "ths_int_test-token-value",
      channelType: "openclaw",
      externalIdentity: "gateway-owner",
      trustedChannelId: "whatsapp",
      trustedSenderId: "15551230000",
    },
    registerTool(tool, options) {
      registrations.push({tool, options});
    },
    on(name, handler) {
      hooks.set(name, handler);
    },
  });

  assert.deepEqual(
    registrations.map(({tool}) => tool.name),
    ["theseus_context_read", "theseus_weekly_plan_proposal", "theseus_weekly_plan_decision", "theseus_weekly_plan_execute", "theseus_weekly_plan_undo"],
  );
  assert.equal(registrations[0].options.optional, true);
  assert.equal(typeof registrations[0].tool.execute, "function");
  assert.deepEqual(registrations[0].tool.parameters.required, ["weekStart", "weekEnd"]);
  assert.equal(registrations[1].options.optional, true);
  assert.equal(registrations[2].options.optional, true);
  assert.equal(registrations[3].options.optional, true);
  assert.equal(registrations[4].options.optional, true);
  assert.equal(typeof hooks.get("message_received"), "function");
  assert.equal(typeof hooks.get("before_tool_call"), "function");
});

test("proposal uses only a matching trusted inbound message", async () => {
  const registrations = [];
  const hooks = new Map();
  plugin.register({
    pluginConfig: {
      baseUrl: "http://127.0.0.1:8000",
      accessToken: "ths_int_test-token-value",
      channelType: "openclaw",
      externalIdentity: "gateway-owner",
      trustedChannelId: "whatsapp",
      trustedSenderId: "15551230000",
    },
    registerTool(tool, options) {
      registrations.push({tool, options});
    },
    on(name, handler) {
      hooks.set(name, handler);
    },
  });

  const proposalParams = {
    reviewWeekStart: "2026-07-20",
    reviewWeekEnd: "2026-07-26",
    targetWeekStart: "2026-07-27",
    targetWeekEnd: "2026-08-02",
  };
  const beforeToolCall = hooks.get("before_tool_call");
  const receiveMessage = hooks.get("message_received");

  assert.deepEqual(
    await beforeToolCall({toolName: "theseus_weekly_plan_proposal", runId: "run-1", params: proposalParams}),
    {
      block: true,
      blockReason: "Theseus proposal changes require a trusted inbound message from the configured channel and sender.",
    },
  );

  await receiveMessage(
    {runId: "run-1", messageId: "external-message-1", senderId: "untrusted"},
    {runId: "run-1", channelId: "whatsapp", senderId: "untrusted"},
  );
  assert.equal(
    (await beforeToolCall({toolName: "theseus_weekly_plan_proposal", runId: "run-1", params: proposalParams})).block,
    true,
  );

  await receiveMessage(
    {runId: "run-1", messageId: "external-message-1", senderId: "15551230000"},
    {runId: "run-1", channelId: "whatsapp", senderId: "15551230000"},
  );
  const accepted = await beforeToolCall({
    toolName: "theseus_weekly_plan_proposal",
    runId: "run-1",
    params: {...proposalParams, trustedMessageReference: "model-controlled"},
  });
  assert.equal(accepted.block, undefined);
  assert.equal(typeof accepted.params.trustedMessageReference, "string");
  assert.notEqual(accepted.params.trustedMessageReference, "external-message-1");
  assert.notEqual(accepted.params.trustedMessageReference, "model-controlled");

  assert.equal(registrations[1].tool.name, "theseus_weekly_plan_proposal");
  assert.equal(registrations[2].tool.name, "theseus_weekly_plan_decision");
  const decisionAccepted = await beforeToolCall({
    toolName: "theseus_weekly_plan_decision",
    runId: "run-1",
    params: {proposalId: 7, expectedVersion: 1, decision: "approve"},
  });
  assert.equal(decisionAccepted.block, undefined);
  assert.equal(typeof decisionAccepted.params.trustedMessageReference, "string");
  const executionAccepted = await beforeToolCall({toolName: "theseus_weekly_plan_execute", runId: "run-1", params: {proposalId: 7, expectedVersion: 2}});
  assert.equal(executionAccepted.block, undefined);
  assert.equal(typeof executionAccepted.params.trustedMessageReference, "string");
  const undoAccepted = await beforeToolCall({toolName: "theseus_weekly_plan_undo", runId: "run-1", params: {proposalId: 7, actionId: 12, expectedVersion: 3}});
  assert.equal(undoAccepted.block, undefined);
  assert.equal(typeof undoAccepted.params.trustedMessageReference, "string");
});
