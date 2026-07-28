import { Type } from "typebox";
import { buildJsonPluginConfigSchema, definePluginEntry, } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { decideTheseusWeeklyPlanProposal, executeTheseusWeeklyPlanProposal, undoTheseusWeeklyPlanAction, draftTheseusWeeklyPlanProposal, readTheseusContext, } from "./client.js";
import { TrustedMessageBridge } from "./trusted-message-bridge.js";
const proposalToolName = "theseus_weekly_plan_proposal";
const proposalDecisionToolName = "theseus_weekly_plan_decision";
const proposalExecutionToolName = "theseus_weekly_plan_execute";
const proposalUndoToolName = "theseus_weekly_plan_undo";
const trustedProposalToolNames = new Set([
    proposalToolName,
    proposalDecisionToolName,
    proposalExecutionToolName,
    proposalUndoToolName,
]);
const pluginConfigSchema = buildJsonPluginConfigSchema({
    type: "object",
    required: ["baseUrl", "accessToken", "channelType", "externalIdentity"],
    properties: {
        baseUrl: { type: "string", minLength: 1 },
        accessToken: { type: "string", minLength: 16 },
        channelType: { enum: ["local_test", "openclaw", "whatsapp"] },
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
    description: "Read Theseus context, draft and decide weekly-plan proposals, and execute or undo approved changes through scoped integration access.",
    configSchema: pluginConfigSchema,
    register(api) {
        const config = requirePluginConfig(api.pluginConfig);
        const bridge = new TrustedMessageBridge();
        api.on("message_received", (event, context) => {
            const runId = event.runId ?? context.runId;
            const messageId = event.messageId ?? context.messageId;
            const senderId = event.senderId ?? context.senderId;
            if (!hasTrustedSource(config) ||
                !runId ||
                !messageId ||
                !senderId ||
                context.channelId !== config.trustedChannelId ||
                senderId !== config.trustedSenderId) {
                return;
            }
            bridge.recordInbound({
                runId,
                messageId,
                channelId: context.channelId,
                senderId,
            });
        });
        api.on("before_tool_call", (event) => {
            if (!trustedProposalToolNames.has(event.toolName))
                return;
            if (!event.runId) {
                return {
                    block: true,
                    blockReason: "Theseus proposal changes require a trusted inbound message from the configured channel and sender.",
                };
            }
            const reference = bridge.createProposalReference(event.runId);
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
        api.registerTool({
            name: "theseus_context_read",
            label: "Theseus Context",
            description: "Read the paired user's evidence-backed context for one date window.",
            parameters: Type.Object({
                weekStart: Type.String({ format: "date", description: "Start date in YYYY-MM-DD format." }),
                weekEnd: Type.String({ format: "date", description: "End date in YYYY-MM-DD format." }),
            }, { additionalProperties: false }),
            async execute(_toolCallId, { weekStart, weekEnd }, signal) {
                signal?.throwIfAborted();
                return jsonResult(await readTheseusContext(config, { weekStart, weekEnd }));
            },
        }, { optional: true });
        api.registerTool({
            name: proposalToolName,
            label: "Theseus Weekly Plan Proposal",
            description: "Draft a pending weekly-plan proposal for the paired user. It never approves or executes changes.",
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
                const messageId = bridge.resolveProposalReference(params.trustedMessageReference);
                if (!messageId) {
                    throw new Error("Theseus proposal creation requires a trusted runtime message reference");
                }
                return jsonResult(await draftTheseusWeeklyPlanProposal(config, {
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
                const messageId = bridge.resolveProposalReference(params.trustedMessageReference);
                if (!messageId) {
                    throw new Error("Theseus proposal changes require a trusted runtime message reference");
                }
                return jsonResult(await decideTheseusWeeklyPlanProposal(config, {
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
                const messageId = bridge.resolveProposalReference(params.trustedMessageReference);
                if (!messageId)
                    throw new Error("Theseus proposal execution requires a trusted runtime message reference");
                return jsonResult(await executeTheseusWeeklyPlanProposal(config, {
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
                const messageId = bridge.resolveProposalReference(params.trustedMessageReference);
                if (!messageId)
                    throw new Error("Theseus proposal undo requires a trusted runtime message reference");
                return jsonResult(await undoTheseusWeeklyPlanAction(config, {
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
        typeof value.accessToken !== "string" ||
        typeof value.channelType !== "string" ||
        typeof value.externalIdentity !== "string") {
        throw new Error("Theseus plugin configuration is invalid");
    }
    return value;
}
function hasTrustedSource(config) {
    return Boolean(config.trustedChannelId?.trim() && config.trustedSenderId?.trim());
}
