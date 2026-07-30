import assert from "node:assert/strict";
import test from "node:test";

import { TrustedMessageBridge } from "../dist/trusted-message-bridge.js";

const signingKey = "test-signing-key-with-sufficient-entropy";

test("trusted message references expire instead of retaining a completed run", () => {
  let now = 1000;
  const bridge = new TrustedMessageBridge(() => now, 100);
  bridge.recordInbound({
    runId: "run-1",
    messageId: "external-message-1",
    channelId: "whatsapp",
    senderId: "15551230000",
  });

  const reference = bridge.createProposalReference("run-1", undefined, signingKey);
  assert.equal(
    bridge.resolveProposalReference(reference, signingKey),
    "external-message-1",
  );

  now += 101;
  assert.equal(bridge.resolveProposalReference(reference, signingKey), undefined);
  assert.equal(
    bridge.createProposalReference("run-1", undefined, signingKey),
    undefined,
  );
});

test("session fallback is promoted once to the matching host run", () => {
  const bridge = new TrustedMessageBridge(() => 1000, 1000, 256, 100);
  bridge.recordSessionInbound({
    sessionKey: "agent:main:telegram-owner",
    messageId: "telegram-message-42",
    channelId: "telegram",
    senderId: "trusted-owner",
  });

  const first = bridge.createProposalReference(
    "runtime-run-42",
    "agent:main:telegram-owner",
    signingKey,
  );
  assert.equal(
    bridge.resolveProposalReference(first, signingKey),
    "telegram-message-42",
  );

  const retry = bridge.createProposalReference(
    "runtime-run-42",
    "agent:main:telegram-owner",
    signingKey,
  );
  assert.equal(
    bridge.resolveProposalReference(retry, signingKey),
    "telegram-message-42",
  );
  assert.equal(
    bridge.createProposalReference(
      "different-runtime-run",
      "agent:main:telegram-owner",
      signingKey,
    ),
    undefined,
  );
});

test("session fallback expires and can be cleared without a tool call", () => {
  let now = 1000;
  const bridge = new TrustedMessageBridge(() => now, 1000, 256, 100);
  bridge.recordSessionInbound({
    sessionKey: "agent:main:first",
    messageId: "telegram-message-first",
    channelId: "telegram",
    senderId: "trusted-owner",
  });
  bridge.clearSession("agent:main:first");
  assert.equal(
    bridge.createProposalReference(
      "runtime-run-first",
      "agent:main:first",
      signingKey,
    ),
    undefined,
  );

  bridge.recordSessionInbound({
    sessionKey: "agent:main:second",
    messageId: "telegram-message-second",
    channelId: "telegram",
    senderId: "trusted-owner",
  });
  now += 101;
  assert.equal(
    bridge.createProposalReference(
      "runtime-run-second",
      "agent:main:second",
      signingKey,
    ),
    undefined,
  );
});

test("signed references verify across plugin instances and reject tampering", () => {
  const hookBridge = new TrustedMessageBridge(() => 1000, 1000);
  hookBridge.recordInbound({
    runId: "runtime-run-cross-instance",
    messageId: "telegram-message-cross-instance",
    channelId: "telegram",
    senderId: "trusted-owner",
  });
  const reference = hookBridge.createProposalReference(
    "runtime-run-cross-instance",
    undefined,
    signingKey,
  );

  const toolBridge = new TrustedMessageBridge(() => 1000, 1000);
  assert.equal(
    toolBridge.resolveProposalReference(reference, signingKey),
    "telegram-message-cross-instance",
  );
  assert.equal(
    toolBridge.resolveProposalReference(reference, "different-signing-key"),
    undefined,
  );
  assert.equal(
    toolBridge.resolveProposalReference(`${reference}tampered`, signingKey),
    undefined,
  );
});
