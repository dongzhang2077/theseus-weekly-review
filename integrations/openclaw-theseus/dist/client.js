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
function requiredMessageId(value) {
    if (typeof value === "string" && value.trim())
        return value;
    throw new TheseusAdapterError("external_message_id_required", "A trusted channel message ID is required to create a Theseus proposal");
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
        return new TheseusAdapterError("integration_scope_denied", operation === "context"
            ? "Theseus read access is not allowed"
            : "Theseus proposal creation is not allowed", status);
    }
    if (status === 409) {
        return new TheseusAdapterError(code ?? "theseus_conflict", "Theseus rejected the repeated request", status);
    }
    if (status === 422) {
        return new TheseusAdapterError(code ?? "invalid_context_window", "The requested week is invalid", status);
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
