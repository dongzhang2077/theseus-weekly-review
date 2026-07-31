import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import plugin from "../dist/index.js";

test("declares the integration token as a manifest-owned SecretRef surface", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../openclaw.plugin.json", import.meta.url), "utf8"),
  );
  const packageMetadata = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.equal(manifest.version, packageMetadata.version);
  assert.deepEqual(manifest.configContracts.secretInputs.paths, [
    {path: "accessToken", expected: "string"},
  ]);
  assert.deepEqual(
    manifest.configSchema.properties.accessToken.anyOf.map((schema) => schema.type),
    ["string", "object"],
  );
  assert.deepEqual(
    plugin.configSchema.jsonSchema.properties.accessToken.anyOf.map((schema) => schema.type),
    ["string", "object"],
  );
  assert(manifest.contracts.tools.includes("theseus_next_action"));
  assert.deepEqual(manifest.toolMetadata.theseus_next_action, {
    replaySafe: true,
    optional: true,
  });
});

test("registers optional context, next-action, proposal, decision, execution, and undo tools through the native OpenClaw SDK", () => {
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
    ["theseus_context_read", "theseus_next_action", "theseus_weekly_plan_proposal", "theseus_weekly_plan_decision", "theseus_weekly_plan_execute", "theseus_weekly_plan_undo"],
  );
  assert.equal(registrations[0].options.optional, true);
  assert.equal(typeof registrations[0].tool.execute, "function");
  assert.deepEqual(registrations[0].tool.parameters.required, ["weekStart", "weekEnd"]);
  assert.equal(registrations[1].options.optional, true);
  assert.equal(registrations[2].options.optional, true);
  assert.equal(registrations[3].options.optional, true);
  assert.equal(registrations[4].options.optional, true);
  assert.equal(registrations[5].options.optional, true);
  assert.equal(typeof hooks.get("message_received"), "function");
  assert.equal(typeof hooks.get("before_agent_run"), "function");
  assert.equal(typeof hooks.get("before_tool_call"), "function");
  assert.equal(typeof hooks.get("agent_end"), "function");
});

test("registers discovery metadata with an unresolved SecretRef and fails closed before execution", async () => {
  const registrations = [];
  plugin.register({
    registrationMode: "discovery",
    pluginConfig: {
      baseUrl: "http://127.0.0.1:1",
      accessToken: {
        source: "file",
        provider: "theseus_pairing",
        id: "value",
      },
      channelType: "telegram",
      externalIdentity: "telegram-user-42",
    },
    registerTool(tool, options) {
      registrations.push({tool, options});
    },
    on() {},
  });

  assert.equal(registrations.length, 6);
  await assert.rejects(
    registrations[0].tool.execute(
      "discovery-call",
      {weekStart: "2026-06-08", weekEnd: "2026-06-14"},
    ),
    /credential is unavailable in this OpenClaw registration mode/,
  );
});

test("next action is fail-closed and receives only a host-trusted message reference", async () => {
  const hooks = new Map();
  plugin.register({
    pluginConfig: {
      baseUrl: "http://127.0.0.1:8000",
      accessToken: "ths_int_test-token-value",
      channelType: "telegram",
      externalIdentity: "telegram-user-42",
      trustedChannelId: "telegram",
      trustedSenderId: "telegram-user-42",
    },
    registerTool() {},
    on(name, handler) {
      hooks.set(name, handler);
    },
  });

  const beforeToolCall = hooks.get("before_tool_call");
  assert.equal(
    (await beforeToolCall({
      toolName: "theseus_next_action",
      runId: "next-action-run",
      params: {availableMinutes: 25},
    })).block,
    true,
  );

  await hooks.get("message_received")(
    {
      runId: "next-action-run",
      messageId: "telegram-message-43",
      senderId: "telegram-user-42",
    },
    {
      runId: "next-action-run",
      channelId: "telegram",
      senderId: "telegram-user-42",
    },
  );
  const accepted = await beforeToolCall({
    toolName: "theseus_next_action",
    runId: "next-action-run",
    params: {availableMinutes: 25, trustedMessageReference: "model-controlled"},
  });

  assert.equal(accepted.block, undefined);
  assert.equal(accepted.params.availableMinutes, 25);
  assert.equal(typeof accepted.params.trustedMessageReference, "string");
  assert.notEqual(accepted.params.trustedMessageReference, "model-controlled");
  assert.notEqual(accepted.params.trustedMessageReference, "telegram-message-43");
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

  assert.equal(registrations[2].tool.name, "theseus_weekly_plan_proposal");
  assert.equal(registrations[3].tool.name, "theseus_weekly_plan_decision");
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

test("proposal accepts the host run ID from before_tool_call context", async () => {
  const hooks = new Map();
  plugin.register({
    pluginConfig: {
      baseUrl: "http://127.0.0.1:8000",
      accessToken: "ths_int_test-token-value",
      channelType: "telegram",
      externalIdentity: "telegram-user-42",
      trustedChannelId: "telegram",
      trustedSenderId: "telegram-user-42",
    },
    registerTool() {},
    on(name, handler) {
      hooks.set(name, handler);
    },
  });

  const receiveMessage = hooks.get("message_received");
  const beforeToolCall = hooks.get("before_tool_call");
  await receiveMessage(
    {messageId: "telegram-message-42", senderId: "telegram-user-42"},
    {
      runId: "runtime-run-42",
      messageId: "telegram-message-42",
      channelId: "telegram",
      senderId: "telegram-user-42",
    },
  );

  const accepted = await beforeToolCall(
    {
      toolName: "theseus_weekly_plan_proposal",
      params: {
        reviewWeekStart: "2026-06-08",
        reviewWeekEnd: "2026-06-14",
        targetWeekStart: "2026-06-15",
        targetWeekEnd: "2026-06-21",
      },
    },
    {runId: "runtime-run-42", toolName: "theseus_weekly_plan_proposal"},
  );

  assert.equal(accepted.block, undefined);
  assert.equal(typeof accepted.params.trustedMessageReference, "string");
  assert.notEqual(accepted.params.trustedMessageReference, "telegram-message-42");
});

test("proposal tool verifies a trusted reference created by another plugin instance", async () => {
  const hooks = new Map();
  const sharedConfig = {
    baseUrl: "http://127.0.0.1:1",
    accessToken: "ths_int_cross-instance-test-token",
    channelType: "telegram",
    externalIdentity: "telegram-user-42",
    trustedChannelId: "telegram",
    trustedSenderId: "telegram-user-42",
  };
  plugin.register({
    pluginConfig: sharedConfig,
    registerTool() {},
    on(name, handler) {
      hooks.set(name, handler);
    },
  });

  const registrations = [];
  plugin.register({
    pluginConfig: sharedConfig,
    registerTool(tool) {
      registrations.push(tool);
    },
    on() {},
  });

  await hooks.get("message_received")(
    {
      runId: "runtime-run-cross-instance",
      messageId: "telegram-message-cross-instance",
      senderId: "telegram-user-42",
    },
    {
      runId: "runtime-run-cross-instance",
      channelId: "telegram",
      senderId: "telegram-user-42",
    },
  );
  const accepted = await hooks.get("before_tool_call")({
    toolName: "theseus_weekly_plan_proposal",
    runId: "runtime-run-cross-instance",
    params: {
      reviewWeekStart: "2026-06-08",
      reviewWeekEnd: "2026-06-14",
      targetWeekStart: "2026-06-15",
      targetWeekEnd: "2026-06-21",
    },
  });

  await assert.rejects(
    registrations[2].execute(
      "cross-instance-call",
      accepted.params,
    ),
    (error) => {
      assert.equal(error.code, "theseus_unavailable");
      return true;
    },
  );
});

test("proposal bridges an owner-authorized channel run inside the tool runtime", async () => {
  const hooks = new Map();
  plugin.register({
    pluginConfig: {
      baseUrl: "http://127.0.0.1:8000",
      accessToken: "ths_int_test-token-value",
      channelType: "telegram",
      externalIdentity: "telegram-user-42",
      trustedChannelId: "telegram",
      trustedSenderId: "telegram-user-42",
    },
    registerTool() {},
    on(name, handler) {
      hooks.set(name, handler);
    },
  });

  const beforeAgentRun = hooks.get("before_agent_run");
  const beforeToolCall = hooks.get("before_tool_call");
  const proposalParams = {
    reviewWeekStart: "2026-06-08",
    reviewWeekEnd: "2026-06-14",
    targetWeekStart: "2026-06-15",
    targetWeekEnd: "2026-06-21",
  };

  await beforeAgentRun(
    {
      prompt: "model-visible content is not used by the trust bridge",
      messages: [],
      channelId: "telegram",
      senderId: "telegram-user-42",
      senderIsOwner: false,
    },
    {runId: "runtime-run-untrusted", channelId: "telegram", senderId: "telegram-user-42"},
  );
  assert.equal(
    (
      await beforeToolCall(
        {toolName: "theseus_weekly_plan_proposal", params: proposalParams},
        {runId: "runtime-run-untrusted", toolName: "theseus_weekly_plan_proposal"},
      )
    ).block,
    true,
  );

  await beforeAgentRun(
    {
      prompt: "model-visible content is not used by the trust bridge",
      messages: [],
      channelId: "telegram",
      senderId: "telegram-user-42",
      senderIsOwner: true,
    },
    {runId: "runtime-run-owner", channelId: "telegram", senderId: "telegram-user-42"},
  );
  const accepted = await beforeToolCall(
    {toolName: "theseus_weekly_plan_proposal", params: proposalParams},
    {
      runId: "runtime-run-owner",
      channelId: "telegram",
      toolName: "theseus_weekly_plan_proposal",
    },
  );

  assert.equal(accepted.block, undefined);
  assert.equal(typeof accepted.params.trustedMessageReference, "string");
  assert.notEqual(accepted.params.trustedMessageReference, "runtime-run-owner");
});

test("proposal uses a single host session fallback when message_received has no run ID", async () => {
  const hooks = new Map();
  plugin.register({
    pluginConfig: {
      baseUrl: "http://127.0.0.1:8000",
      accessToken: "ths_int_test-token-value",
      channelType: "telegram",
      externalIdentity: "telegram-user-42",
      trustedChannelId: "telegram",
      trustedSenderId: "telegram-user-42",
    },
    registerTool() {},
    on(name, handler) {
      hooks.set(name, handler);
    },
    logger: {info() {}},
  });

  const receiveMessage = hooks.get("message_received");
  const beforeToolCall = hooks.get("before_tool_call");
  const endAgent = hooks.get("agent_end");
  const proposalParams = {
    reviewWeekStart: "2026-06-08",
    reviewWeekEnd: "2026-06-14",
    targetWeekStart: "2026-06-15",
    targetWeekEnd: "2026-06-21",
  };

  await receiveMessage(
    {
      messageId: "telegram-message-84",
      senderId: "telegram-user-42",
      sessionKey: "agent:main:telegram-owner",
    },
    {
      messageId: "telegram-message-84",
      channelId: "telegram",
      senderId: "telegram-user-42",
    },
  );
  const accepted = await beforeToolCall(
    {toolName: "theseus_weekly_plan_proposal", params: proposalParams},
    {
      runId: "runtime-run-84",
      sessionKey: "agent:main:telegram-owner",
      toolName: "theseus_weekly_plan_proposal",
    },
  );
  assert.equal(accepted.block, undefined);
  assert.equal(typeof accepted.params.trustedMessageReference, "string");

  await endAgent(
    {runId: "runtime-run-84", messages: [], success: true},
    {
      runId: "runtime-run-84",
      sessionKey: "agent:main:telegram-owner",
    },
  );
  const nextRun = await beforeToolCall(
    {toolName: "theseus_weekly_plan_proposal", params: proposalParams},
    {
      runId: "runtime-run-85",
      sessionKey: "agent:main:telegram-owner",
      toolName: "theseus_weekly_plan_proposal",
    },
  );
  assert.equal(nextRun.block, true);
});
