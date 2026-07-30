import { createHmac, timingSafeEqual } from "node:crypto";
const REFERENCE_SIGNATURE_CONTEXT = "theseus-trusted-message-v1:";
const MAX_REFERENCE_LENGTH = 4096;
/**
 * Keeps the runtime-provided inbound identifier out of model-controlled tool
 * parameters. References are scoped to one OpenClaw agent run, expire quickly,
 * and are authenticated so a tool registered in another OpenClaw plugin
 * instance can verify them without sharing mutable memory.
 */
export class TrustedMessageBridge {
    now;
    ttlMs;
    maxEntries;
    sessionTtlMs;
    messagesByRun = new Map();
    messagesBySession = new Map();
    constructor(now = Date.now, ttlMs = 10 * 60 * 1000, maxEntries = 256, sessionTtlMs = 60 * 1000) {
        this.now = now;
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
        this.sessionTtlMs = sessionTtlMs;
    }
    recordInbound(message) {
        this.purgeExpired();
        this.ensureCapacity(this.messagesByRun);
        this.messagesByRun.set(message.runId, {
            messageId: message.messageId,
            channelId: message.channelId,
            senderId: message.senderId,
            expiresAt: this.now() + this.ttlMs,
        });
    }
    recordSessionInbound(message) {
        this.purgeExpired();
        this.ensureCapacity(this.messagesBySession);
        this.messagesBySession.set(message.sessionKey, {
            messageId: message.messageId,
            channelId: message.channelId,
            senderId: message.senderId,
            expiresAt: this.now() + this.sessionTtlMs,
        });
    }
    createProposalReference(runId, sessionKey, signingKey) {
        this.purgeExpired();
        let message = this.messagesByRun.get(runId);
        if (!message && sessionKey) {
            message = this.messagesBySession.get(sessionKey);
            if (message) {
                this.messagesBySession.delete(sessionKey);
                this.ensureCapacity(this.messagesByRun);
                this.messagesByRun.set(runId, message);
            }
        }
        if (!message)
            return undefined;
        const payload = Buffer.from(JSON.stringify({
            version: 1,
            messageId: message.messageId,
            runId,
            expiresAt: message.expiresAt,
        }), "utf8").toString("base64url");
        return `${payload}.${this.sign(payload, signingKey)}`;
    }
    resolveProposalReference(reference, signingKey) {
        if (!reference || reference.length > MAX_REFERENCE_LENGTH)
            return undefined;
        const parts = reference.split(".");
        if (parts.length !== 2)
            return undefined;
        const [payload, suppliedSignature] = parts;
        if (!payload || !suppliedSignature)
            return undefined;
        const expectedSignature = this.sign(payload, signingKey);
        const suppliedBytes = Buffer.from(suppliedSignature, "base64url");
        const expectedBytes = Buffer.from(expectedSignature, "base64url");
        if (suppliedBytes.length !== expectedBytes.length ||
            !timingSafeEqual(suppliedBytes, expectedBytes)) {
            return undefined;
        }
        try {
            const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
            if (value.version !== 1 ||
                typeof value.messageId !== "string" ||
                value.messageId.length === 0 ||
                typeof value.runId !== "string" ||
                value.runId.length === 0 ||
                typeof value.expiresAt !== "number" ||
                !Number.isSafeInteger(value.expiresAt) ||
                value.expiresAt <= this.now()) {
                return undefined;
            }
            return value.messageId;
        }
        catch {
            return undefined;
        }
    }
    clearRun(runId) {
        if (runId)
            this.messagesByRun.delete(runId);
    }
    clearSession(sessionKey) {
        if (sessionKey)
            this.messagesBySession.delete(sessionKey);
    }
    purgeExpired() {
        const now = this.now();
        for (const [runId, message] of this.messagesByRun) {
            if (message.expiresAt <= now)
                this.messagesByRun.delete(runId);
        }
        for (const [sessionKey, message] of this.messagesBySession) {
            if (message.expiresAt <= now)
                this.messagesBySession.delete(sessionKey);
        }
    }
    sign(payload, signingKey) {
        return createHmac("sha256", signingKey)
            .update(REFERENCE_SIGNATURE_CONTEXT)
            .update(payload)
            .digest("base64url");
    }
    ensureCapacity(entries) {
        if (entries.size < this.maxEntries)
            return;
        const oldest = entries.keys().next().value;
        if (oldest)
            entries.delete(oldest);
    }
}
