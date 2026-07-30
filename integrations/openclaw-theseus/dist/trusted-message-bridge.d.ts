export interface TrustedInboundMessage {
    runId: string;
    messageId: string;
    channelId: string;
    senderId: string;
}
export interface TrustedSessionInboundMessage {
    sessionKey: string;
    messageId: string;
    channelId: string;
    senderId: string;
}
/**
 * Keeps the runtime-provided inbound identifier out of model-controlled tool
 * parameters. References are scoped to one OpenClaw agent run, expire quickly,
 * and are authenticated so a tool registered in another OpenClaw plugin
 * instance can verify them without sharing mutable memory.
 */
export declare class TrustedMessageBridge {
    private readonly now;
    private readonly ttlMs;
    private readonly maxEntries;
    private readonly sessionTtlMs;
    private readonly messagesByRun;
    private readonly messagesBySession;
    constructor(now?: () => number, ttlMs?: number, maxEntries?: number, sessionTtlMs?: number);
    recordInbound(message: TrustedInboundMessage): void;
    recordSessionInbound(message: TrustedSessionInboundMessage): void;
    createProposalReference(runId: string, sessionKey: string | undefined, signingKey: string): string | undefined;
    resolveProposalReference(reference: string | undefined, signingKey: string): string | undefined;
    clearRun(runId: string | undefined): void;
    clearSession(sessionKey: string | undefined): void;
    private purgeExpired;
    private sign;
    private ensureCapacity;
}
