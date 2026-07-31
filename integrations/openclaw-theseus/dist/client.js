import { randomUUID } from "node:crypto";
export class TheseusAdapterError extends Error {
    code;
    status;
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = "TheseusAdapterError";
    }
}
export async function readTheseusContext(config, request, options = {}) {
    const url = new URL("/integrations/channel/context", normalizedBase(config.baseUrl));
    url.searchParams.set("week_start", request.weekStart);
    url.searchParams.set("week_end", request.weekEnd);
    return requestTheseus(config, url, "GET", options.messageId ?? randomUUID(), options.fetch, undefined, "context");
}
/**
 * Reads the backend-ranked next action without granting the model authority to
 * invent evidence or mutate user data. The trusted inbound message ID binds
 * the read to the configured channel owner.
 */
export async function readTheseusNextAction(config, request, options = {}) {
    return requestTheseus(config, new URL("/integrations/channel/next-action", normalizedBase(config.baseUrl)), "POST", requiredMessageId(options.messageId, "read a Theseus next action"), options.fetch, request.availableMinutes === undefined
        ? {}
        : { available_minutes: request.availableMinutes }, "next_action");
}
/**
 * Draft only. The caller must supply the trusted inbound channel message ID;
 * a model tool-call ID and a generated UUID are not valid substitutes.
 */
export async function draftTheseusWeeklyPlanProposal(config, request, options = {}) {
    const messageId = requiredMessageId(options.messageId);
    return requestTheseus(config, new URL("/integrations/channel/proposals/weekly-adjustment", normalizedBase(config.baseUrl)), "POST", messageId, options.fetch, {
        review_week_start: request.reviewWeekStart,
        review_week_end: request.reviewWeekEnd,
        target_week_start: request.targetWeekStart,
        target_week_end: request.targetWeekEnd,
    }, "proposal");
}
/**
 * Records a narrowly scoped proposal decision. This never executes the
 * approved plan change.
 */
export async function decideTheseusWeeklyPlanProposal(config, request, options = {}) {
    const messageId = requiredMessageId(options.messageId);
    return requestTheseus(config, new URL(`/integrations/channel/proposals/${request.proposalId}/decision`, normalizedBase(config.baseUrl)), "POST", messageId, options.fetch, {
        expected_version: request.expectedVersion,
        decision: request.decision,
        ...(request.reason === undefined ? {} : { reason: request.reason }),
    }, "decision");
}
export async function executeTheseusWeeklyPlanProposal(config, request, options = {}) {
    return requestTheseus(config, new URL(`/integrations/channel/proposals/${request.proposalId}/execute-weekly-plan`, normalizedBase(config.baseUrl)), "POST", requiredMessageId(options.messageId), options.fetch, { expected_version: request.expectedVersion }, "execution");
}
/**
 * Undo one successful, reversible action created from an approved weekly-plan
 * proposal. The backend retains the Action's verification and replay record.
 */
export async function undoTheseusWeeklyPlanAction(config, request, options = {}) {
    return requestTheseus(config, new URL(`/integrations/channel/proposals/${request.proposalId}/actions/${request.actionId}/undo-weekly-plan`, normalizedBase(config.baseUrl)), "POST", requiredMessageId(options.messageId), options.fetch, { expected_version: request.expectedVersion }, "undo");
}
async function requestTheseus(config, url, method, messageId, fetchOverride, body, operation) {
    const fetcher = fetchOverride ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 10_000);
    try {
        const response = await fetcher(url, {
            method,
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                "X-Channel-Type": config.channelType,
                "X-External-Identity": config.externalIdentity,
                "X-External-Message-ID": messageId,
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: controller.signal,
        });
        const payload = await safeJson(response);
        if (!response.ok) {
            throw mappedError(response.status, payload, operation);
        }
        return payload;
    }
    catch (error) {
        if (error instanceof TheseusAdapterError)
            throw error;
        if (error instanceof Error && error.name === "AbortError") {
            throw new TheseusAdapterError("theseus_timeout", "Theseus did not respond in time");
        }
        throw new TheseusAdapterError("theseus_unavailable", "Theseus is unavailable");
    }
    finally {
        clearTimeout(timeout);
    }
}
function requiredMessageId(value, purpose = "change a Theseus proposal") {
    if (typeof value === "string" && value.trim())
        return value;
    throw new TheseusAdapterError("external_message_id_required", `A trusted channel message ID is required to ${purpose}`);
}
function normalizedBase(value) {
    return value.endsWith("/") ? value : `${value}/`;
}
async function safeJson(response) {
    try {
        return await response.json();
    }
    catch {
        return null;
    }
}
function mappedError(status, payload, operation) {
    const code = errorCode(payload);
    if (status === 401) {
        return new TheseusAdapterError("integration_access_denied", "Theseus pairing is unavailable", status);
    }
    if (status === 403) {
        return new TheseusAdapterError("integration_scope_denied", operation === "context" || operation === "next_action"
            ? "Theseus read access is not allowed"
            : operation === "proposal"
                ? "Theseus proposal creation is not allowed"
                : operation === "decision"
                    ? "Theseus proposal decision is not allowed"
                    : operation === "execution"
                        ? "Theseus proposal execution is not allowed"
                        : "Theseus proposal undo is not allowed", status);
    }
    if (status === 409) {
        if (code === "invalid_account_timezone") {
            return new TheseusAdapterError(code, "Theseus needs a valid account timezone before recommending a next action", status);
        }
        return new TheseusAdapterError(code ?? "theseus_conflict", code === "external_message_replay_conflict"
            ? "Theseus rejected the repeated request"
            : "Theseus could not complete the request because its state changed", status);
    }
    if (status === 422) {
        return new TheseusAdapterError(code ?? (operation === "next_action" ? "invalid_next_action_request" : "invalid_context_window"), operation === "next_action"
            ? "The next-action request is invalid"
            : "The requested week is invalid", status);
    }
    return new TheseusAdapterError("theseus_request_failed", "Theseus could not complete the request", status);
}
function errorCode(payload) {
    if (!payload || typeof payload !== "object")
        return undefined;
    const detail = payload.detail;
    if (!detail || typeof detail !== "object")
        return undefined;
    const code = detail.code;
    return typeof code === "string" ? code : undefined;
}
