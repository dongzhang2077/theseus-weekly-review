import process from "node:process";

import { readTheseusContext } from "../dist/client.js";

const required = [
  "THESEUS_BASE_URL",
  "THESEUS_ACCESS_TOKEN",
  "THESEUS_EXTERNAL_IDENTITY",
  "THESEUS_WEEK_START",
  "THESEUS_WEEK_END",
];

for (const name of required) {
  if (!process.env[name]?.trim()) {
    throw new Error(`${name} must be set`);
  }
}

const response = await readTheseusContext(
  {
    baseUrl: process.env.THESEUS_BASE_URL,
    accessToken: process.env.THESEUS_ACCESS_TOKEN,
    channelType: process.env.THESEUS_CHANNEL_TYPE ?? "openclaw",
    externalIdentity: process.env.THESEUS_EXTERNAL_IDENTITY,
  },
  {
    weekStart: process.env.THESEUS_WEEK_START,
    weekEnd: process.env.THESEUS_WEEK_END,
  },
  {messageId: process.env.THESEUS_EXTERNAL_MESSAGE_ID ?? "openclaw-smoke-context-001"},
);

const contextVersion =
  response && typeof response === "object" && "context_version" in response
    ? response.context_version
    : "unknown";

console.log(JSON.stringify({status: "ok", operation: "context.read", contextVersion}));
