import type { FetchLike } from "./loadAppWeek";

export type IntegrationChannelType = "local_test" | "openclaw" | "whatsapp";
export type IntegrationScope =
  | "context:read"
  | "proposal:create"
  | "proposal:decide"
  | "action:execute"
  | "action:undo";

export interface IntegrationCredential {
  id: number;
  user_id: number;
  label: string;
  channel_type: IntegrationChannelType;
  scopes: IntegrationScope[];
  token_prefix: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface IntegrationPair {
  credential: IntegrationCredential;
  access_token: string;
}

export interface IntegrationContext {
  context_version: "v1";
  user_id: number;
  week_start: string;
  week_end: string;
}

export interface PairIntegrationInput {
  label: string;
  channelType: IntegrationChannelType;
  externalIdentity: string;
  scopes: IntegrationScope[];
  expiresInSeconds: number;
}

export type IntegrationApiStatus = "ok" | "conflict" | "not_found" | "error";

export interface IntegrationApiResult<T> {
  status: IntegrationApiStatus;
  data: T | null;
  error: string | null;
}

interface IntegrationApiOptions {
  apiBaseUrl: string;
  fetchImpl: FetchLike;
}

export function listIntegrations(
  options: IntegrationApiOptions
): Promise<IntegrationApiResult<IntegrationCredential[]>> {
  return request(options, "/integrations", "GET");
}

export function pairIntegration(
  options: IntegrationApiOptions,
  input: PairIntegrationInput
): Promise<IntegrationApiResult<IntegrationPair>> {
  return request(options, "/integrations/pair", "POST", {
    label: input.label.trim(),
    channel_type: input.channelType,
    external_identity: input.externalIdentity.trim(),
    scopes: input.scopes,
    expires_in_seconds: input.expiresInSeconds
  });
}

export function revokeIntegration(
  options: IntegrationApiOptions,
  credentialId: number
): Promise<IntegrationApiResult<null>> {
  return request(options, `/integrations/${credentialId}`, "DELETE");
}

export async function readIntegrationContext(
  options: {
    apiBaseUrl: string;
    accessToken: string;
    externalIdentity: string;
    weekStart: string;
    weekEnd: string;
    messageId: string;
    fetchImpl?: FetchLike;
  }
): Promise<IntegrationApiResult<IntegrationContext>> {
  const baseUrl = options.apiBaseUrl.trim().replace(/\/$/, "");
  if (!baseUrl) return failure("API base URL is not configured");
  try {
    const query = new URLSearchParams({
      week_start: options.weekStart,
      week_end: options.weekEnd
    });
    const response = await (options.fetchImpl ?? fetch)(
      `${baseUrl}/integrations/channel/context?${query}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          "X-Channel-Type": "openclaw",
          "X-External-Identity": options.externalIdentity,
          "X-External-Message-ID": options.messageId
        }
      }
    );
    if (!response.ok) {
      return {
        status: response.status === 409 ? "conflict" : "error",
        data: null,
        error: await responseDetail(response) ?? `Backend returned ${response.status}`
      };
    }
    return { status: "ok", data: await response.json() as IntegrationContext, error: null };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "OpenClaw connection check failed");
  }
}

async function request<T>(
  options: IntegrationApiOptions,
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown
): Promise<IntegrationApiResult<T>> {
  const baseUrl = options.apiBaseUrl.trim().replace(/\/$/, "");
  if (!baseUrl) return failure("API base URL is not configured");

  try {
    const response = await options.fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) {
      const detail = await responseDetail(response);
      return {
        status: response.status === 409
          ? "conflict"
          : response.status === 404
            ? "not_found"
            : "error",
        data: null,
        error: detail ?? `Backend returned ${response.status}`
      };
    }
    if (response.status === 204) return { status: "ok", data: null, error: null };
    return { status: "ok", data: await response.json() as T, error: null };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Integration request failed");
  }
}

async function responseDetail(response: { json: () => Promise<unknown> }): Promise<string | null> {
  try {
    const payload = await response.json() as { detail?: string | { message?: string } };
    if (typeof payload.detail === "string") return payload.detail;
    return payload.detail?.message ?? null;
  } catch {
    return null;
  }
}

function failure<T>(error: string): IntegrationApiResult<T> {
  return { status: "error", data: null, error };
}
