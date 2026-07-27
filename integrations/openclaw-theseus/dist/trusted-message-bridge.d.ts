export interface TrustedInboundMessage {
    runId: string;
    messageId: string;
    channelId: string;
    senderId: string;
}
/**
 * Keeps the runtime-provided inbound identifier out of model-controlled tool
 * parameters. References are scoped to one OpenClaw agent run and expire
 * quickly, which keeps host state bounded even when an external plugin cannot
 * receive OpenClaw's conversation-access lifecycle hooks.
 */
export declare class TrustedMessageBridge {
    private readonly now;
    private readonly ttlMs;
    private readonly maxEntries;
    private readonly messagesByRun;
    private readonly references;
    constructor(now?: () => number, ttlMs?: number, maxEntries?: number);
    recordInbound(message: TrustedInboundMessage): void;
    createProposalReference(runId: string): string | undefined;
    resolveProposalReference(reference: string | undefined): string | undefined;
    private purgeExpired;
    private ensureCapacity;
}
