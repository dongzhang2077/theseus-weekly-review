(function () {
  const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
  const STORAGE_KEY = "theseus.apiBaseUrl";

  class ApiError extends Error {
    constructor(message, details) {
      super(message);
      this.name = "ApiError";
      this.status = details.status;
      this.url = details.url;
      this.detail = details.detail;
    }
  }

  function normalizeBaseUrl(value) {
    const trimmed = String(value || "").trim();
    return (trimmed || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  }

  function getApiBaseUrl() {
    try {
      return normalizeBaseUrl(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      return DEFAULT_API_BASE_URL;
    }
  }

  function setApiBaseUrl(value) {
    const normalized = normalizeBaseUrl(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      return normalized;
    }
    return normalized;
  }

  function resetApiBaseUrl() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      return DEFAULT_API_BASE_URL;
    }
    return DEFAULT_API_BASE_URL;
  }

  async function request(path, options = {}) {
    const url = `${getApiBaseUrl()}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new ApiError("Theseus API request failed", {
        status: response.status,
        url,
        detail: typeof body === "string" ? body : body.detail || body,
      });
    }

    return body;
  }

  window.TheseusApi = {
    DEFAULT_API_BASE_URL,
    ApiError,
    getApiBaseUrl,
    setApiBaseUrl,
    resetApiBaseUrl,
    health: () => request("/health"),
    listGoals: () => request("/goals"),
    createGoal: (payload) =>
      request("/goals", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    listProjects: () => request("/projects"),
    createProject: (payload) =>
      request("/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    listWeeklyPlans: () => request("/weekly-plans"),
    listTimeLogs: () => request("/time-logs"),
    generateWeeklyReview: (payload) =>
      request("/reviews/weekly/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  };
})();
