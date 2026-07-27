import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";

import { readTheseusContext } from "./client.js";

const configSchema = Type.Object(
  {
    baseUrl: Type.String({ minLength: 1 }),
    accessToken: Type.String({ minLength: 16 }),
    channelType: Type.Union([
      Type.Literal("local_test"),
      Type.Literal("openclaw"),
      Type.Literal("whatsapp"),
    ]),
    externalIdentity: Type.String({ minLength: 1 }),
    timeoutMs: Type.Optional(Type.Integer({ minimum: 1000, maximum: 30000 })),
  },
  { additionalProperties: false },
);

export default defineToolPlugin({
  id: "theseus",
  name: "Theseus",
  description: "Read evidence-backed Theseus context through scoped integration access.",
  configSchema,
  activation: { onStartup: false },
  tools: (tool: any) => [
    tool({
      name: "theseus_context_read",
      label: "Theseus Context",
      description: "Read the paired user's evidence-backed context for one date window.",
      optional: true,
      parameters: Type.Object(
        {
          weekStart: Type.String({ format: "date", description: "Start date in YYYY-MM-DD format." }),
          weekEnd: Type.String({ format: "date", description: "End date in YYYY-MM-DD format." }),
        },
        { additionalProperties: false },
      ),
      async execute(
        { weekStart, weekEnd }: { weekStart: string; weekEnd: string },
        config: any,
        context: { signal?: AbortSignal },
      ) {
        context.signal?.throwIfAborted();
        return readTheseusContext(config, { weekStart, weekEnd });
      },
    }),
  ],
});
