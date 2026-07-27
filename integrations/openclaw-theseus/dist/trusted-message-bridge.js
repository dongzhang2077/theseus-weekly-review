import { randomUUID } from "node:crypto";
/**
 * Keeps the runtime-provided inbound identifier out of model-controlled tool
 * parameters. References are scoped to one OpenClaw agent run and expire
 * quickly, which keeps host state bounded even when an external plugin cannot
 * receive OpenClaw's conversation-access lifecycle hooks.
 */
export class TrustedMessageBridge {
    now;
    ttlMs;
    maxEntries;
    messagesByRun = new Map();
    references = new Map();
    constructor(now = Date.now, ttlMs = 10 * 60 * 1000, maxEntries = 256) {
        this.now = now;
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
    }
    recordInbound(message) {
        this.purgeExpired();
        this.ensureCapacity(this.messagesByRun);
        this.messagesByRun.set(message.runId, { ...message, expiresAt: this.now() + this.ttlMs });
    }
    createProposalReference(runId) {
        this.purgeExpired();
        const message = this.messagesByRun.get(runId);
        if (!message)
            return undefined;
        const reference = randomUUID();
        this.ensureCapacity(this.references);
        this.references.set(reference, { messageId: message.messageId, runId, expiresAt: message.expiresAt });
        return reference;
    }
    resolveProposalReference(reference) {
        this.purgeExpired();
        if (!reference)
            return undefined;
        return this.references.get(reference)?.messageId;
    }
    purgeExpired() {
        const now = this.now();
        for (const [runId, message] of this.messagesByRun) {
            if (message.expiresAt <= now)
                this.messagesByRun.delete(runId);
        }
        for (const [reference, value] of this.references) {
            if (value.expiresAt <= now)
                this.references.delete(reference);
        }
    }
    ensureCapacity(entries) {
        if (entries.size < this.maxEntries)
            return;
        const oldest = entries.keys().next().value;
        if (oldest)
            entries.delete(oldest);
    }
}
