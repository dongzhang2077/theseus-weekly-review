import { demoWeek } from "../demo/demoWeek";
import { isValidLocalUserId, localUserHeaders } from "./localUserContext";
import { mapWeeklyReviewToAppWeek, type AppWeekViewModel, type WeeklyReviewApiResponse } from "./weeklyReview";

export const demoWeekRange = {
  start: "2026-06-08",
  end: "2026-06-14"
};

export type AppWeekSource = "api" | "demo" | "empty" | "error";
export type ReviewMode = "deterministic_first" | "supportive_text";

export interface LoadedAppWeek {
  week: AppWeekViewModel;
  source: AppWeekSource;
  error: string | null;
}

interface FetchResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<FetchResponseLike>;

export interface LoadAppWeekOptions {
  apiBaseUrl?: string;
  userId?: number;
  weekStart?: string;
  weekEnd?: string;
  mode?: ReviewMode;
  deterministicFallback?: boolean;
  fallback?: AppWeekViewModel;
  fetchImpl?: FetchLike;
}

export async function loadAppWeek(options: LoadAppWeekOptions = {}): Promise<LoadedAppWeek> {
  const fallback = options.fallback ?? demoWeek;
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return { week: fallback, source: "demo", error: null };
  }
  if (!isValidLocalUserId(options.userId)) {
    return { week: fallback, source: "error", error: "Local user is not selected" };
  }

  const preferredMode = options.mode ?? "supportive_text";
  const modes: ReviewMode[] = [preferredMode];
  if (
    preferredMode === "supportive_text" &&
    options.deterministicFallback !== false
  ) {
    modes.push("deterministic_first");
  }
  let lastError = "Backend request failed";

  for (const mode of modes) {
    try {
      const response = await (options.fetchImpl ?? fetch)(
        `${apiBaseUrl.replace(/\/$/, "")}/reviews/weekly/generate`,
        {
          method: "POST",
          headers: localUserHeaders(options.userId, true),
          body: JSON.stringify({
            week_start: options.weekStart ?? demoWeekRange.start,
            week_end: options.weekEnd ?? demoWeekRange.end,
            mode
          })
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return { week: fallback, source: "empty", error: null };
        }
        lastError = `Backend returned ${response.status}`;
        if (mode === "supportive_text" && response.status === 502) {
          continue;
        }
        break;
      }

      const apiReview = (await response.json()) as WeeklyReviewApiResponse;
      return {
        week: mapWeeklyReviewToAppWeek(apiReview, fallback),
        source: "api",
        error:
          mode === preferredMode
            ? null
            : "Supportive review unavailable; deterministic review loaded"
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Backend request failed";
      break;
    }
  }

  return { week: fallback, source: "error", error: lastError };
}
