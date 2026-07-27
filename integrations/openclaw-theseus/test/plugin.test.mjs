import assert from "node:assert/strict";
import test from "node:test";

import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";

import plugin from "../dist/index.js";

test("registers one optional read-only tool through the OpenClaw SDK", () => {
  const metadata = getToolPluginMetadata(plugin);
  assert.deepEqual(metadata?.tools.map((tool) => tool.name), ["theseus_context_read"]);
  assert.equal(metadata?.tools[0]?.optional, true);

  const registrations = [];
  plugin.register({
    pluginConfig: {
      baseUrl: "http://127.0.0.1:8000",
      accessToken: "ths_int_test-token-value",
      channelType: "openclaw",
      externalIdentity: "gateway-owner",
    },
    registerTool(tool, options) {
      registrations.push({tool, options});
    },
  });

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].tool.name, "theseus_context_read");
  assert.equal(registrations[0].options.optional, true);
  assert.equal(typeof registrations[0].tool.execute, "function");
  assert.deepEqual(registrations[0].tool.parameters.required, ["weekStart", "weekEnd"]);
});
