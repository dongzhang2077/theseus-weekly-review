import { demoWeek } from "../demo/demoWeek";
import { mapWeeklyReviewToAppWeek, type AppWeekViewModel, type WeeklyReviewApiResponse } from "./weeklyReview";

export const demoWeekRange = {
  start: "2026-06-08",
  end: "2026-06-14"
};

export type AppWeekSource = "api" | "demo";

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
  weekStart?: string;
  weekEnd?: string;
  fallback?: AppWeekViewModel;
  fetchImpl?: FetchLike;
}

export async function loadAppWeek(options: LoadAppWeekOptions = {}): Promise<LoadedAppWeek> {
  const fallback = options.fallback ?? demoWeek;
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return { week: fallback, source: "demo", error: null };
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(`${apiBaseUrl.replace(/\/$/, "")}/reviews/weekly/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        week_start: options.weekStart ?? demoWeekRange.start,
        week_end: options.weekEnd ?? demoWeekRange.end,
        mode: "deterministic_first"
      })
    });

    if (!response.ok) {
      return { week: fallback, source: "demo", error: `Backend returned ${response.status}` };
    }

    const apiReview = (await response.json()) as WeeklyReviewApiResponse;
    return { week: mapWeeklyReviewToAppWeek(apiReview, fallback), source: "api", error: null };
  } catch (error) {
    return {
      week: fallback,
      source: "demo",
      error: error instanceof Error ? error.message : "Backend request failed"
    };
  }
}
