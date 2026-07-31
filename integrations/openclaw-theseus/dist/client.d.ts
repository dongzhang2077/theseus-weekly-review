export type TheseusChannelType = "local_test" | "openclaw" | "telegram" | "whatsapp";
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
export interface TheseusNextActionRequest {
    availableMinutes?: number;
}
export interface TheseusWeeklyProposalRequest {
    reviewWeekStart: string;
    reviewWeekEnd: string;
    targetWeekStart: string;
    targetWeekEnd: string;
}
export interface TheseusWeeklyProposalDecisionRequest {
    proposalId: number;
    expectedVersion: number;
    decision: "approve" | "reject";
    reason?: string;
}
export interface TheseusWeeklyProposalExecutionRequest {
    proposalId: number;
    expectedVersion: number;
}
export interface TheseusWeeklyPlanUndoRequest {
    proposalId: number;
    actionId: number;
    expectedVersion: number;
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
 * Reads the backend-ranked next action without granting the model authority to
 * invent evidence or mutate user data. The trusted inbound message ID binds
 * the read to the configured channel owner.
 */
export declare function readTheseusNextAction(config: TheseusClientConfig, request: TheseusNextActionRequest, options?: TheseusRequestOptions): Promise<unknown>;
/**
 * Draft only. The caller must supply the trusted inbound channel message ID;
 * a model tool-call ID and a generated UUID are not valid substitutes.
 */
export declare function draftTheseusWeeklyPlanProposal(config: TheseusClientConfig, request: TheseusWeeklyProposalRequest, options?: TheseusRequestOptions): Promise<unknown>;
/**
 * Records a narrowly scoped proposal decision. This never executes the
 * approved plan change.
 */
export declare function decideTheseusWeeklyPlanProposal(config: TheseusClientConfig, request: TheseusWeeklyProposalDecisionRequest, options?: TheseusRequestOptions): Promise<unknown>;
export declare function executeTheseusWeeklyPlanProposal(config: TheseusClientConfig, request: TheseusWeeklyProposalExecutionRequest, options?: TheseusRequestOptions): Promise<unknown>;
/**
 * Undo one successful, reversible action created from an approved weekly-plan
 * proposal. The backend retains the Action's verification and replay record.
 */
export declare function undoTheseusWeeklyPlanAction(config: TheseusClientConfig, request: TheseusWeeklyPlanUndoRequest, options?: TheseusRequestOptions): Promise<unknown>;
export {};
