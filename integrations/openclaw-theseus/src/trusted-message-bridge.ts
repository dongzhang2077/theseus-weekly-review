import { createHmac, timingSafeEqual } from "node:crypto";

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

interface StoredTrustedMessage {
  messageId: string;
  channelId: string;
  senderId: string;
  expiresAt: number;
}

interface TrustedProposalReference {
  version: 1;
  messageId: string;
  runId: string;
  expiresAt: number;
}

const REFERENCE_SIGNATURE_CONTEXT = "theseus-trusted-message-v1:";
const MAX_REFERENCE_LENGTH = 4096;

/**
 * Keeps the runtime-provided inbound identifier out of model-controlled tool
 * parameters. References are scoped to one OpenClaw agent run, expire quickly,
 * and are authenticated so a tool registered in another OpenClaw plugin
 * instance can verify them without sharing mutable memory.
 */
export class TrustedMessageBridge {
  private readonly messagesByRun = new Map<string, StoredTrustedMessage>();
  private readonly messagesBySession = new Map<string, StoredTrustedMessage>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly maxEntries = 256,
    private readonly sessionTtlMs = 60 * 1000,
  ) {}

  recordInbound(message: TrustedInboundMessage): void {
    this.purgeExpired();
    this.ensureCapacity(this.messagesByRun);
    this.messagesByRun.set(message.runId, {
      messageId: message.messageId,
      channelId: message.channelId,
      senderId: message.senderId,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  recordSessionInbound(message: TrustedSessionInboundMessage): void {
    this.purgeExpired();
    this.ensureCapacity(this.messagesBySession);
    this.messagesBySession.set(message.sessionKey, {
      messageId: message.messageId,
      channelId: message.channelId,
      senderId: message.senderId,
      expiresAt: this.now() + this.sessionTtlMs,
    });
  }

  createProposalReference(
    runId: string,
    sessionKey: string | undefined,
    signingKey: string,
  ): string | undefined {
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
    if (!message) return undefined;

    const payload = Buffer.from(
      JSON.stringify({
        version: 1,
        messageId: message.messageId,
        runId,
        expiresAt: message.expiresAt,
      } satisfies TrustedProposalReference),
      "utf8",
    ).toString("base64url");
    return `${payload}.${this.sign(payload, signingKey)}`;
  }

  resolveProposalReference(
    reference: string | undefined,
    signingKey: string,
  ): string | undefined {
    if (!reference || reference.length > MAX_REFERENCE_LENGTH) return undefined;
    const parts = reference.split(".");
    if (parts.length !== 2) return undefined;
    const [payload, suppliedSignature] = parts;
    if (!payload || !suppliedSignature) return undefined;

    const expectedSignature = this.sign(payload, signingKey);
    const suppliedBytes = Buffer.from(suppliedSignature, "base64url");
    const expectedBytes = Buffer.from(expectedSignature, "base64url");
    if (
      suppliedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(suppliedBytes, expectedBytes)
    ) {
      return undefined;
    }

    try {
      const value = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as Partial<TrustedProposalReference>;
      if (
        value.version !== 1 ||
        typeof value.messageId !== "string" ||
        value.messageId.length === 0 ||
        typeof value.runId !== "string" ||
        value.runId.length === 0 ||
        typeof value.expiresAt !== "number" ||
        !Number.isSafeInteger(value.expiresAt) ||
        value.expiresAt <= this.now()
      ) {
        return undefined;
      }
      return value.messageId;
    } catch {
      return undefined;
    }
  }

  clearRun(runId: string | undefined): void {
    if (runId) this.messagesByRun.delete(runId);
  }

  clearSession(sessionKey: string | undefined): void {
    if (sessionKey) this.messagesBySession.delete(sessionKey);
  }

  private purgeExpired(): void {
    const now = this.now();
    for (const [runId, message] of this.messagesByRun) {
      if (message.expiresAt <= now) this.messagesByRun.delete(runId);
    }
    for (const [sessionKey, message] of this.messagesBySession) {
      if (message.expiresAt <= now) this.messagesBySession.delete(sessionKey);
    }
  }

  private sign(payload: string, signingKey: string): string {
    return createHmac("sha256", signingKey)
      .update(REFERENCE_SIGNATURE_CONTEXT)
      .update(payload)
      .digest("base64url");
  }

  private ensureCapacity<T>(entries: Map<string, T>): void {
    if (entries.size < this.maxEntries) return;
    const oldest = entries.keys().next().value;
    if (oldest) entries.delete(oldest);
  }
}
