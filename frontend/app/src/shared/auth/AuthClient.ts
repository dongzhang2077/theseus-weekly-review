import type { FetchLike } from "../api/loadAppWeek";

export interface AuthAccount {
  id: number;
  email: string;
  display_name: string;
  timezone: string;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  display_name: string;
  timezone: string;
  locale: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AccountUpdatePayload {
  display_name?: string;
  timezone?: string;
  locale?: string;
}

export interface AuthError {
  code: string;
  message: string;
  status: number;
}

export interface AuthResult<T> {
  ok: boolean;
  data: T | null;
  error: AuthError | null;
}

export interface SessionResult {
  user: AuthAccount;
}

interface AuthTokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: AuthAccount;
}

type BrowserFetch = (input: string, init?: RequestInit) => Promise<Response>;

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "AuthRequiredError";
  }
}

export class AuthClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: BrowserFetch;
  private readonly cookieReader: () => string;
  private accessToken: string | null = null;
  private refreshRequest: Promise<AuthResult<SessionResult>> | null = null;
  private sessionExpiredHandler: (() => void) | null = null;

  constructor(
    apiBaseUrl: string,
    options: {
      fetchImpl?: BrowserFetch;
      cookieReader?: () => string;
    } = {}
  ) {
    this.baseUrl = apiBaseUrl.trim().replace(/\/$/, "");
    if (options.fetchImpl) {
      const injectedFetch = options.fetchImpl;
      this.fetchImpl = (input, init) => injectedFetch(input, init);
    } else {
      this.fetchImpl = (input, init) => globalThis.fetch(input, init);
    }
    this.cookieReader = options.cookieReader ?? (() => document.cookie);
  }

  setSessionExpiredHandler(handler: (() => void) | null) {
    this.sessionExpiredHandler = handler;
  }

  async register(payload: RegisterPayload): Promise<AuthResult<SessionResult>> {
    return this.requestSession("/auth/register", payload);
  }

  async login(payload: LoginPayload): Promise<AuthResult<SessionResult>> {
    return this.requestSession("/auth/login", payload);
  }

  async restore(): Promise<AuthResult<SessionResult>> {
    return this.refresh();
  }

  async logout(): Promise<AuthResult<null>> {
    const result = await this.authorizedRequest("/auth/logout", { method: "POST" });
    if (!result.ok) {
      return { ok: false, data: null, error: result.error };
    }
    this.clearAccessToken();
    return { ok: true, data: null, error: null };
  }

  async updateProfile(payload: AccountUpdatePayload): Promise<AuthResult<AuthAccount>> {
    return this.authorizedJson<AuthAccount>("/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  async changeEmail(payload: {
    email: string;
    current_password: string;
  }): Promise<AuthResult<AuthAccount>> {
    return this.authorizedJson<AuthAccount>("/auth/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  async changePassword(payload: {
    current_password: string;
    new_password: string;
  }): Promise<AuthResult<SessionResult>> {
    const result = await this.authorizedJson<AuthTokenResponse>(
      "/auth/change-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
    if (!result.ok || !result.data) {
      return { ok: false, data: null, error: result.error };
    }
    return this.acceptSession(result.data);
  }

  async deleteAccount(currentPassword: string): Promise<AuthResult<null>> {
    const response = await this.authorizedRequest("/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword,
        confirmation: "DELETE"
      })
    });
    if (!response.ok) return { ok: false, data: null, error: response.error };
    this.clearAccessToken();
    return { ok: true, data: null, error: null };
  }

  readonly fetch: FetchLike = async (input: string, init: RequestInit) => {
    if (!this.accessToken) {
      const restored = await this.refresh();
      if (!restored.ok) {
        this.sessionExpiredHandler?.();
        throw new AuthRequiredError();
      }
    }

    let response = await this.fetchWithAccess(input, init);
    if (response.status !== 401) return response;

    const refreshed = await this.refresh();
    if (!refreshed.ok) {
      this.clearAccessToken();
      this.sessionExpiredHandler?.();
      return response;
    }
    response = await this.fetchWithAccess(input, init);
    return response;
  };

  private async requestSession(
    path: string,
    payload: RegisterPayload | LoginPayload
  ): Promise<AuthResult<SessionResult>> {
    const result = await this.requestJson<AuthTokenResponse>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!result.ok || !result.data) {
      return { ok: false, data: null, error: result.error };
    }
    return this.acceptSession(result.data);
  }

  private refresh(): Promise<AuthResult<SessionResult>> {
    if (this.refreshRequest) return this.refreshRequest;
    this.refreshRequest = this.performRefresh().finally(() => {
      this.refreshRequest = null;
    });
    return this.refreshRequest;
  }

  private async performRefresh(): Promise<AuthResult<SessionResult>> {
    const csrfToken = readCookie(this.cookieReader(), "theseus_csrf");
    if (!csrfToken) {
      this.clearAccessToken();
      return {
        ok: false,
        data: null,
        error: { code: "not_authenticated", message: "Sign in to continue", status: 401 }
      };
    }
    const result = await this.requestJson<AuthTokenResponse>("/auth/refresh", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken }
    });
    if (!result.ok || !result.data) {
      this.clearAccessToken();
      return { ok: false, data: null, error: result.error };
    }
    return this.acceptSession(result.data);
  }

  private acceptSession(payload: AuthTokenResponse): AuthResult<SessionResult> {
    this.accessToken = payload.access_token;
    return {
      ok: true,
      data: {
        user: payload.user
      },
      error: null
    };
  }

  private async authorizedJson<T>(
    path: string,
    init: RequestInit
  ): Promise<AuthResult<T>> {
    const response = await this.authorizedRequest(path, init);
    if (!response.ok) return { ok: false, data: null, error: response.error };
    return { ok: true, data: response.data as T, error: null };
  }

  private async authorizedRequest(
    path: string,
    init: RequestInit,
    retry = true
  ): Promise<AuthResult<unknown>> {
    try {
      if (!this.accessToken) {
        const restored = await this.refresh();
        if (!restored.ok) return { ok: false, data: null, error: restored.error };
      }
      let response = await this.fetchWithAccess(`${this.baseUrl}${path}`, init);
      if (retry && response.status === 401) {
        const refreshed = await this.refresh();
        if (!refreshed.ok) return { ok: false, data: null, error: refreshed.error };
        response = await this.fetchWithAccess(`${this.baseUrl}${path}`, init);
      }
      return parseResponse(response);
    } catch (error) {
      return {
        ok: false,
        data: null,
        error: {
          code: "network_error",
          message: error instanceof Error ? error.message : "Local service is unavailable",
          status: 0
        }
      };
    }
  }

  private fetchWithAccess(input: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.accessToken) headers.set("Authorization", `Bearer ${this.accessToken}`);
    return this.fetchImpl(input, {
      ...init,
      credentials: "include",
      headers
    });
  }

  private requestJson<T>(path: string, init: RequestInit): Promise<AuthResult<T>> {
    if (!this.baseUrl) {
      return Promise.resolve({
        ok: false,
        data: null,
        error: {
          code: "api_unavailable",
          message: "Local service is not configured",
          status: 0
        }
      });
    }
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      credentials: "include"
    }).then(parseResponse<T>).catch((error: unknown) => ({
      ok: false,
      data: null,
      error: {
        code: "network_error",
        message: error instanceof Error ? error.message : "Local service is unavailable",
        status: 0
      }
    }));
  }

  private clearAccessToken() {
    this.accessToken = null;
  }
}

async function parseResponse<T>(response: Response): Promise<AuthResult<T>> {
  if (response.ok) {
    if (response.status === 204) return { ok: true, data: null, error: null };
    return { ok: true, data: await response.json() as T, error: null };
  }

  let code = "request_failed";
  let message = `Request failed (${response.status})`;
  try {
    const payload = await response.json() as {
      detail?: string | { code?: string; message?: string };
    };
    if (typeof payload.detail === "string") {
      message = payload.detail;
    } else if (payload.detail) {
      code = payload.detail.code ?? code;
      message = payload.detail.message ?? message;
    }
  } catch {
    // A controlled fallback is clearer than exposing an unreadable response body.
  }
  return {
    ok: false,
    data: null,
    error: { code, message, status: response.status }
  };
}

function readCookie(cookieHeader: string, name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of cookieHeader.split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) {
      return decodeURIComponent(value.slice(prefix.length));
    }
  }
  return null;
}
