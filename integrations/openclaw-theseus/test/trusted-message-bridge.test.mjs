import assert from "node:assert/strict";
import test from "node:test";

import { TrustedMessageBridge } from "../dist/trusted-message-bridge.js";

test("trusted message references expire instead of retaining a completed run", () => {
  let now = 1000;
  const bridge = new TrustedMessageBridge(() => now, 100);
  bridge.recordInbound({
    runId: "run-1",
    messageId: "external-message-1",
    channelId: "whatsapp",
    senderId: "15551230000",
  });

  const reference = bridge.createProposalReference("run-1");
  assert.equal(bridge.resolveProposalReference(reference), "external-message-1");

  now += 101;
  assert.equal(bridge.resolveProposalReference(reference), undefined);
  assert.equal(bridge.createProposalReference("run-1"), undefined);
});
