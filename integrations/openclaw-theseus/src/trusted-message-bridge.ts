import { randomUUID } from "node:crypto";

export interface TrustedInboundMessage {
  runId: string;
  messageId: string;
  channelId: string;
  senderId: string;
}

interface TrustedProposalReference {
  messageId: string;
  runId: string;
  expiresAt: number;
}

/**
 * Keeps the runtime-provided inbound identifier out of model-controlled tool
 * parameters. References are scoped to one OpenClaw agent run and expire
 * quickly, which keeps host state bounded even when an external plugin cannot
 * receive OpenClaw's conversation-access lifecycle hooks.
 */
export class TrustedMessageBridge {
  private readonly messagesByRun = new Map<string, TrustedInboundMessage & {expiresAt: number}>();
  private readonly references = new Map<string, TrustedProposalReference>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly maxEntries = 256,
  ) {}

  recordInbound(message: TrustedInboundMessage): void {
    this.purgeExpired();
    this.ensureCapacity(this.messagesByRun);
    this.messagesByRun.set(message.runId, {...message, expiresAt: this.now() + this.ttlMs});
  }

  createProposalReference(runId: string): string | undefined {
    this.purgeExpired();
    const message = this.messagesByRun.get(runId);
    if (!message) return undefined;

    const reference = randomUUID();
    this.ensureCapacity(this.references);
    this.references.set(reference, {messageId: message.messageId, runId, expiresAt: message.expiresAt});
    return reference;
  }

  resolveProposalReference(reference: string | undefined): string | undefined {
    this.purgeExpired();
    if (!reference) return undefined;
    return this.references.get(reference)?.messageId;
  }

  private purgeExpired(): void {
    const now = this.now();
    for (const [runId, message] of this.messagesByRun) {
      if (message.expiresAt <= now) this.messagesByRun.delete(runId);
    }
    for (const [reference, value] of this.references) {
      if (value.expiresAt <= now) this.references.delete(reference);
    }
  }

  private ensureCapacity<T>(entries: Map<string, T>): void {
    if (entries.size < this.maxEntries) return;
    const oldest = entries.keys().next().value;
    if (oldest) entries.delete(oldest);
  }
}
