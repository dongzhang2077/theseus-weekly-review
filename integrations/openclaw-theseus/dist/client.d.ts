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
export declare class TheseusAdapterError extends Error {
    readonly code: string;
    readonly status?: number | undefined;
    constructor(code: string, message: string, status?: number | undefined);
}
export declare function readTheseusContext(config: TheseusClientConfig, request: TheseusContextRequest, options?: {
    fetch?: typeof fetch;
    messageId?: string;
}): Promise<unknown>;
