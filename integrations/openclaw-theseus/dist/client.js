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
    const fetcher = options.fetch ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 10_000);
    const url = new URL("/integrations/channel/context", normalizedBase(config.baseUrl));
    url.searchParams.set("week_start", request.weekStart);
    url.searchParams.set("week_end", request.weekEnd);
    try {
        const response = await fetcher(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                "X-Channel-Type": config.channelType,
                "X-External-Identity": config.externalIdentity,
                "X-External-Message-ID": options.messageId ?? randomUUID(),
            },
            signal: controller.signal,
        });
        const payload = await safeJson(response);
        if (!response.ok) {
            throw mappedError(response.status, payload);
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
function mappedError(status, payload) {
    const code = errorCode(payload);
    if (status === 401) {
        return new TheseusAdapterError("integration_access_denied", "Theseus pairing is unavailable", status);
    }
    if (status === 403) {
        return new TheseusAdapterError("integration_scope_denied", "Theseus read access is not allowed", status);
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
