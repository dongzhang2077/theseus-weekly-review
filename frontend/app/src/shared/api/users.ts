import type { FetchLike } from "./loadAppWeek";

export interface LocalUser {
  id: number;
  display_name: string;
  timezone: string;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface LocalUserCreatePayload {
  display_name: string;
  timezone?: string;
  locale?: string;
}

export interface LocalUserApiResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

interface LocalUserApiOptions {
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
}

export async function listLocalUsers(
  options: LocalUserApiOptions
): Promise<LocalUserApiResult<LocalUser[]>> {
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return { ok: false, data: null, error: "API base URL is not configured" };
  }

  return requestLocalUsers<LocalUser[]>(
    `${apiBaseUrl.replace(/\/$/, "")}/users`,
    { method: "GET" },
    options.fetchImpl
  );
}

export async function createLocalUser(
  options: LocalUserApiOptions & { payload: LocalUserCreatePayload }
): Promise<LocalUserApiResult<LocalUser>> {
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return { ok: false, data: null, error: "API base URL is not configured" };
  }

  return requestLocalUsers<LocalUser>(
    `${apiBaseUrl.replace(/\/$/, "")}/users`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.payload)
    },
    options.fetchImpl
  );
}

async function requestLocalUsers<T>(
  input: string,
  init: RequestInit,
  fetchImpl: FetchLike | undefined
): Promise<LocalUserApiResult<T>> {
  try {
    const response = await (fetchImpl ?? fetch)(input, init);
    if (!response.ok) {
      return { ok: false, data: null, error: `Backend returned ${response.status}` };
    }

    return { ok: true, data: (await response.json()) as T, error: null };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: error instanceof Error ? error.message : "Local profile request failed"
    };
  }
}
