export type TheseusChannelType = "local_test" | "openclaw" | "whatsapp";
export interface TheseusClientConfig {
    baseUrl: string;
    accessToken: string;
    channelType: TheseusChannelType;
    externalIdentity: string;
    timeoutMs?: number;
}
export interface TheseusContextRequest {
    weekStart: string;
    weekEnd: string;
}
export interface TheseusWeeklyProposalRequest {
    reviewWeekStart: string;
    reviewWeekEnd: string;
    targetWeekStart: string;
    targetWeekEnd: string;
}
interface TheseusRequestOptions {
    fetch?: typeof fetch;
    messageId?: string;
}
export declare class TheseusAdapterError extends Error {
    readonly code: string;
    readonly status?: number | undefined;
    constructor(code: string, message: string, status?: number | undefined);
}
export declare function readTheseusContext(config: TheseusClientConfig, request: TheseusContextRequest, options?: TheseusRequestOptions): Promise<unknown>;
/**
 * Draft only. The caller must supply the trusted inbound channel message ID;
 * a model tool-call ID and a generated UUID are not valid substitutes.
 */
export declare function draftTheseusWeeklyPlanProposal(config: TheseusClientConfig, request: TheseusWeeklyProposalRequest, options?: TheseusRequestOptions): Promise<unknown>;
export {};
