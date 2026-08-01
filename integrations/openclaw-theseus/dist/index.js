import { Type } from "typebox";
import { buildJsonPluginConfigSchema, definePluginEntry, } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { decideTheseusWeeklyPlanProposal, executeTheseusWeeklyPlanProposal, undoTheseusWeeklyPlanAction, draftTheseusWeeklyPlanProposal, readTheseusContext, readTheseusNextAction, } from "./client.js";
import { TrustedMessageBridge } from "./trusted-message-bridge.js";
const proposalToolName = "theseus_weekly_plan_proposal";
const nextActionToolName = "theseus_next_action";
const proposalDecisionToolName = "theseus_weekly_plan_decision";
const proposalExecutionToolName = "theseus_weekly_plan_execute";
const proposalUndoToolName = "theseus_weekly_plan_undo";
const trustedToolNames = new Set([
    nextActionToolName,
    proposalToolName,
    proposalDecisionToolName,
    proposalExecutionToolName,
    proposalUndoToolName,
]);
const secretRefSchema = {
    type: "object",
    properties: {
        source: { enum: ["env", "file", "exec"] },
        provider: { type: "string", minLength: 1 },
        id: { type: "string", minLength: 1 },
    },
    required: ["source", "provider", "id"],
    additionalProperties: false,
};
const pluginConfigSchema = buildJsonPluginConfigSchema({
    type: "object",
    required: ["baseUrl", "accessToken", "channelType", "externalIdentity"],
    properties: {
        baseUrl: { type: "string", minLength: 1 },
        accessToken: {
            anyOf: [
                { type: "string", minLength: 16 },
                secretRefSchema,
            ],
        },
        channelType: { enum: ["local_test", "openclaw", "telegram", "whatsapp"] },
        externalIdentity: { type: "string", minLength: 1 },
        timeoutMs: { type: "integer", minimum: 1000, maximum: 30000 },
        trustedChannelId: { type: "string", minLength: 1 },
        trustedSenderId: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
});
const plugin = definePluginEntry({
    id: "theseus",
    name: "Theseus",
    description: "Read Theseus context and deterministic next actions, or manage weekly-plan proposals through scoped integration access.",
    configSchema: pluginConfigSchema,
    register(api) {
        const config = requirePluginConfig(api.pluginConfig);
        const bridge = new TrustedMessageBridge();
        api.on("message_received", (event, context) => {
            const runId = event.runId ?? context?.runId;
            const sessionKey = event.sessionKey ?? context.sessionKey;
            const messageId = event.messageId ?? context.messageId;
            const senderId = event.senderId ?? context.senderId;
            if (!hasTrustedSource(config) ||
                (!runId && !sessionKey) ||
                !messageId ||
                !senderId ||
                context.channelId !== config.trustedChannelId ||
                senderId !== config.trustedSenderId) {
                return;
            }
            if (runId) {
                bridge.recordInbound({
                    runId,
                    messageId,
                    channelId: context.channelId,
                    senderId,
                });
            }
            if (sessionKey) {
                bridge.recordSessionInbound({
                    sessionKey,
                    messageId,
                    channelId: context.channelId,
                    senderId,
                });
            }
        });
        api.on("before_agent_run", (event, context) => {
            const runId = context.runId;
            const channelId = event.channelId ?? context.channelId;
            const senderId = event.senderId ?? context.senderId;
            if (!hasTrustedSource(config) ||
                !runId ||
                !channelId ||
                !senderId ||
                event.senderIsOwner !== true ||
                channelId !== config.trustedChannelId ||
                senderId !== config.trustedSenderId) {
                return;
            }
            bridge.recordInbound({
                runId,
                messageId: `openclaw-run:${runId}`,
                channelId,
                senderId,
            });
        });
        api.on("before_tool_call", (event, context) => {
            if (!trustedToolNames.has(event.toolName))
                return;
            const runId = event.runId ?? context?.runId;
            if (!runId) {
                return {
                    block: true,
                    blockReason: "Theseus proposal changes require a trusted inbound message from the configured channel and sender.",
                };
            }
            const reference = typeof config.accessToken === "string"
                ? bridge.createProposalReference(runId, context?.sessionKey, config.accessToken)
                : undefined;
            if (!reference) {
                return {
                    block: true,
                    blockReason: "Theseus proposal changes require a trusted inbound message from the configured channel and sender.",
                };
            }
            return {
                params: { ...event.params, trustedMessageReference: reference },
            };
        });
        api.on("agent_end", (event, context) => {
            bridge.clearRun(event.runId ?? context.runId);
            bridge.clearSession(context.sessionKey);
        });
        api.registerTool({
            name: "theseus_context_read",
            label: "Theseus Context",
            description: "Read the paired user's evidence-backed context for one date window. Treat the returned week_start, week_end, and timezone as authoritative; after a successful read, do not call shell, Bash, exec, or date just to re-check them. If weekly_plan is null, say that no plan exists and answer only from the returned goals, projects, deadlines, tasks, logs, and review. Use the proposal tool only when the user explicitly asks to draft or change a weekly plan.",
            parameters: Type.Object({
                weekStart: Type.String({ format: "date", description: "Start date in YYYY-MM-DD format." }),
                weekEnd: Type.String({ format: "date", description: "End date in YYYY-MM-DD format." }),
            }, { additionalProperties: false }),
            async execute(_toolCallId, { weekStart, weekEnd }, signal) {
                signal?.throwIfAborted();
                return jsonResult(await readTheseusContext(requireResolvedClientConfig(config), { weekStart, weekEnd }));
            },
        }, { optional: true });
        api.registerTool({
            name: nextActionToolName,
            label: "Theseus Next Action",
            description: "Read one deterministic, evidence-backed action for what the user should do now in the account's current week. This is not a future-week planner. Preserve the returned recommendation and cite only its returned evidence when answering; do not invent ranking facts. Treat returned local_date and timezone as authoritative and do not call shell, Bash, exec, or date to re-check them. This tool never changes user data.",
            parameters: Type.Object({
                availableMinutes: Type.Optional(Type.Integer({
                    minimum: 5,
                    maximum: 720,
                    description: "Minutes the user explicitly says are available now.",
                })),
                trustedMessageReference: Type.Optional(Type.String({
                    description: "Internal runtime field. OpenClaw injects it; callers must not set it.",
                })),
            }, { additionalProperties: false }),
            async execute(_toolCallId, params, signal) {
                signal?.throwIfAborted();
                const clientConfig = requireResolvedClientConfig(config);
                const messageId = bridge.resolveProposalReference(params.trustedMessageReference, clientConfig.accessToken);
                if (!messageId) {
                    throw new Error("Theseus next-action read requires a trusted runtime message reference");
                }
                return jsonResult(await readTheseusNextAction(clientConfig, params.availableMinutes === undefined
                    ? {}
                    : { availableMinutes: params.availableMinutes }, { messageId }));
            },
        }, { optional: true });
        api.registerTool({
            name: proposalToolName,
            label: "Theseus Weekly Plan Proposal",
            description: "Draft a pending weekly-plan proposal only when the user explicitly asks to create, draft, prepare, or change a weekly plan. First read the reviewed week and target week with Theseus tools; never use shell, Bash, exec, or date to validate a successful Theseus date window. This tool never approves or executes changes.",
            parameters: Type.Object({
                reviewWeekStart: Type.String({ format: "date", description: "Reviewed week start in YYYY-MM-DD format." }),
                reviewWeekEnd: Type.String({ format: "date", description: "Reviewed week end in YYYY-MM-DD format." }),
                targetWeekStart: Type.String({ format: "date", description: "Target week start in YYYY-MM-DD format." }),
                targetWeekEnd: Type.String({ format: "date", description: "Target week end in YYYY-MM-DD format." }),
                trustedMessageReference: Type.Optional(Type.String({
                    description: "Internal runtime field. OpenClaw injects it; callers must not set it.",
                })),
            }, { additionalProperties: false }),
            async execute(_toolCallId, params, signal) {
                signal?.throwIfAborted();
                const clientConfig = requireResolvedClientConfig(config);
                const messageId = bridge.resolveProposalReference(params.trustedMessageReference, clientConfig.accessToken);
                if (!messageId) {
                    throw new Error("Theseus proposal creation requires a trusted runtime message reference");
                }
                return jsonResult(await draftTheseusWeeklyPlanProposal(clientConfig, {
                    reviewWeekStart: params.reviewWeekStart,
                    reviewWeekEnd: params.reviewWeekEnd,
                    targetWeekStart: params.targetWeekStart,
                    targetWeekEnd: params.targetWeekEnd,
                }, { messageId }));
            },
        }, { optional: true });
        api.registerTool({
            name: proposalDecisionToolName,
            label: "Theseus Weekly Plan Decision",
            description: "Record an approve or reject decision for a pending weekly-plan proposal. It never executes a plan change.",
            parameters: Type.Object({
                proposalId: Type.Integer({ minimum: 1, description: "Pending Theseus proposal ID." }),
                expectedVersion: Type.Integer({ minimum: 1, description: "Proposal version shown to the user." }),
                decision: Type.Union([Type.Literal("approve"), Type.Literal("reject")]),
                reason: Type.Optional(Type.String({ maxLength: 1000 })),
                trustedMessageReference: Type.Optional(Type.String({
                    description: "Internal runtime field. OpenClaw injects it; callers must not set it.",
                })),
            }, { additionalProperties: false }),
            async execute(_toolCallId, params, signal) {
                signal?.throwIfAborted();
                const clientConfig = requireResolvedClientConfig(config);
                const messageId = bridge.resolveProposalReference(params.trustedMessageReference, clientConfig.accessToken);
                if (!messageId) {
                    throw new Error("Theseus proposal changes require a trusted runtime message reference");
                }
                return jsonResult(await decideTheseusWeeklyPlanProposal(clientConfig, {
                    proposalId: params.proposalId,
                    expectedVersion: params.expectedVersion,
                    decision: params.decision,
                    ...(params.reason === undefined ? {} : { reason: params.reason }),
                }, { messageId }));
            },
        }, { optional: true });
        api.registerTool({
            name: proposalExecutionToolName,
            label: "Theseus Weekly Plan Execute",
            description: "Execute an approved weekly-plan proposal with a reversible Action. It never accepts plan content.",
            parameters: Type.Object({
                proposalId: Type.Integer({ minimum: 1 }),
                expectedVersion: Type.Integer({ minimum: 1 }),
                trustedMessageReference: Type.Optional(Type.String()),
            }, { additionalProperties: false }),
            async execute(_toolCallId, params, signal) {
                signal?.throwIfAborted();
                const clientConfig = requireResolvedClientConfig(config);
                const messageId = bridge.resolveProposalReference(params.trustedMessageReference, clientConfig.accessToken);
                if (!messageId)
                    throw new Error("Theseus proposal execution requires a trusted runtime message reference");
                return jsonResult(await executeTheseusWeeklyPlanProposal(clientConfig, {
                    proposalId: params.proposalId,
                    expectedVersion: params.expectedVersion,
                }, { messageId }));
            },
        }, { optional: true });
        api.registerTool({
            name: proposalUndoToolName,
            label: "Theseus Weekly Plan Undo",
            description: "Undo one successful, reversible Weekly Plan action without accepting plan content.",
            parameters: Type.Object({
                proposalId: Type.Integer({ minimum: 1 }),
                actionId: Type.Integer({ minimum: 1 }),
                expectedVersion: Type.Integer({ minimum: 1 }),
                trustedMessageReference: Type.Optional(Type.String()),
            }, { additionalProperties: false }),
            async execute(_toolCallId, params, signal) {
                signal?.throwIfAborted();
                const clientConfig = requireResolvedClientConfig(config);
                const messageId = bridge.resolveProposalReference(params.trustedMessageReference, clientConfig.accessToken);
                if (!messageId)
                    throw new Error("Theseus proposal undo requires a trusted runtime message reference");
                return jsonResult(await undoTheseusWeeklyPlanAction(clientConfig, {
                    proposalId: params.proposalId,
                    actionId: params.actionId,
                    expectedVersion: params.expectedVersion,
                }, { messageId }));
            },
        }, { optional: true });
    },
});
export default plugin;
function requirePluginConfig(value) {
    if (!value ||
        typeof value.baseUrl !== "string" ||
        !(typeof value.accessToken === "string" || isSecretReference(value.accessToken)) ||
        typeof value.channelType !== "string" ||
        typeof value.externalIdentity !== "string") {
        throw new Error("Theseus plugin configuration is invalid");
    }
    return value;
}
function requireResolvedClientConfig(config) {
    if (typeof config.accessToken !== "string") {
        throw new Error("Theseus integration credential is unavailable in this OpenClaw registration mode");
    }
    return config;
}
function isSecretReference(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const candidate = value;
    return ((candidate.source === "env" ||
        candidate.source === "file" ||
        candidate.source === "exec") &&
        typeof candidate.provider === "string" &&
        candidate.provider.length > 0 &&
        typeof candidate.id === "string" &&
        candidate.id.length > 0);
}
function hasTrustedSource(config) {
    return Boolean(config.trustedChannelId?.trim() && config.trustedSenderId?.trim());
}
