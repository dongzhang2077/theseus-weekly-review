import { useEffect, useState } from "react";
import { AccountSheet } from "./features/auth/AccountSheet";
import { AuthScreen, type AuthGatePhase } from "./features/auth/AuthScreen";
import { PlanScreen, type PlanDetail } from "./features/plan/PlanScreen";
import { ReviewScreen } from "./features/review/ReviewScreen";
import { SignalsScreen } from "./features/signals/SignalsScreen";
import { TrackScreen } from "./features/track/TrackScreen";
import { AuthClient, type AuthAccount, type LoginPayload, type RegisterPayload } from "./shared/auth/AuthClient";
import { loadAppWeek, type LoadedAppWeek } from "./shared/api/loadAppWeek";
import { StateSurface } from "./shared/components/StateSurface";
import { demoWeek } from "./shared/demo/demoWeek";
import type { PlanItem } from "./features/plan/planModel";
import { tickActivities } from "./features/track/timerModel";
import type { ActivityTimer } from "./shared/domain/track";
import { resolveInitialTab, type AppTab } from "./shared/navigation/tabs";
import { AppShell } from "./shared/shell/AppShell";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const apiBaseUrl = env.VITE_THESEUS_API_BASE_URL?.trim();

type AppPhase = AuthGatePhase | "signed_in";
export interface PlanEntryRequest {
  id: number;
  detail: PlanDetail;
}

export function App() {
  const [authClient] = useState(() => apiBaseUrl ? new AuthClient(apiBaseUrl) : null);
  const [appPhase, setAppPhase] = useState<AppPhase>(authClient ? "restoring" : "unavailable");
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>(() =>
    resolveInitialTab(typeof window === "undefined" ? "" : window.location.search)
  );
  const [planEntryRequest, setPlanEntryRequest] = useState<PlanEntryRequest | null>(null);
  const [loadedWeek, setLoadedWeek] = useState<LoadedAppWeek>({
    week: demoWeek,
    source: "demo",
    error: null
  });
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekReload, setWeekReload] = useState(0);
  const [trackActivities, setTrackActivities] = useState<ActivityTimer[]>(demoWeek.track.activities);
  const hasRunningTrackActivity = trackActivities.some((activity) => activity.running);

  useEffect(() => {
    if (!authClient) {
      setAppPhase("unavailable");
      return;
    }

    let ignore = false;
    setAppPhase("restoring");
    authClient.restore().then((result) => {
      if (ignore) return;
      if (result.ok && result.data) {
        enterSignedIn(result.data.user);
        return;
      }
      setAccount(null);
      setAppPhase(result.error?.status === 0 ? "unavailable" : "signed_out");
    });

    return () => {
      ignore = true;
    };
  }, [authAttempt, authClient]);

  useEffect(() => {
    if (!authClient) return;
    authClient.setSessionExpiredHandler(() => {
      setAccountOpen(false);
      setAccount(null);
      setAppPhase("signed_out");
    });
    return () => authClient.setSessionExpiredHandler(null);
  }, [authClient]);

  useEffect(() => {
    if (!apiBaseUrl || !authClient || !account || appPhase !== "signed_in") return;

    let ignore = false;
    setWeekLoading(true);
    loadAppWeek({ apiBaseUrl, fetchImpl: authClient.fetch }).then((loaded) => {
      if (!ignore) {
        setLoadedWeek(loaded);
        setTrackActivities(loaded.week.track.activities);
        setWeekLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [account?.id, appPhase, authClient, weekReload]);

  useEffect(() => {
    if (!hasRunningTrackActivity) return;

    let lastTick = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastTick) / 1000);
      if (elapsedSeconds <= 0) return;
      lastTick += elapsedSeconds * 1000;
      setTrackActivities((current) => tickActivities(current, elapsedSeconds));
    }, 250);

    return () => window.clearInterval(interval);
  }, [hasRunningTrackActivity]);

  function enterSignedIn(nextAccount: AuthAccount) {
    setAccount(nextAccount);
    setAccountOpen(false);
    setWeekLoading(true);
    setAppPhase("signed_in");
  }

  async function login(payload: LoginPayload) {
    const result = authClient
      ? await authClient.login(payload)
      : unavailableAuthResult();
    if (result.ok && result.data) enterSignedIn(result.data.user);
    return result;
  }

  async function register(payload: RegisterPayload) {
    const result = authClient
      ? await authClient.register(payload)
      : unavailableAuthResult();
    if (result.ok && result.data) {
      enterSignedIn(result.data.user);
    }
    return result;
  }

  function signedOut() {
    setAccountOpen(false);
    setAccount(null);
    setWeekLoading(false);
    setAppPhase("signed_out");
  }

  function openPlanSuggestion() {
    setPlanEntryRequest({ id: Date.now(), detail: "suggestion" });
    setActiveTab("plan");
  }

  function focusPlanItem(item: PlanItem, projectTitle: string | null) {
    const activityId = `plan-${item.id ?? `${item.projectId ?? "flex"}-${planItemKey(item.title)}`}`;
    setTrackActivities((current) => {
      const existing = current.find((activity) => activity.id === activityId);
      if (existing) {
        return current.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                name: item.title,
                category: "Project",
                projectId: item.projectId ?? undefined,
                projectTitle: projectTitle ?? undefined,
                recommended: true
              }
            : activity
        );
      }
      return [
        {
          id: activityId,
          projectId: item.projectId ?? undefined,
          name: item.title,
          category: "Project",
          energy: "consume",
          color: "#6f8f6b",
          projectTitle: projectTitle ?? undefined,
          todaySeconds: 0,
          sessionSeconds: 0,
          running: false,
          recommended: true
        },
        ...current
      ];
    });
    setActiveTab("track");
  }

  if (appPhase !== "signed_in" || !account || !authClient || !apiBaseUrl) {
    return (
      <AuthScreen
        phase={appPhase === "signed_in" ? "unavailable" : appPhase}
        onLogin={login}
        onRegister={register}
        onRetry={() => setAuthAttempt((value) => value + 1)}
      />
    );
  }

  const appWeek = loadedWeek.week;
  const reviewIsEmpty = loadedWeek.source === "empty" && (activeTab === "review" || activeTab === "signals");
  const trackIsEmpty = loadedWeek.source === "empty" && activeTab === "track";
  const contentIsError = loadedWeek.source === "error" && activeTab !== "plan";
  const notice = weekLoading
    ? "Loading"
    : loadedWeek.source === "empty"
      ? "Getting started"
      : loadedWeek.source === "error"
        ? "Load failed"
        : loadedWeek.error
          ? "Rule-based review"
          : undefined;

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      profileName={account.display_name}
      onProfileChange={() => setAccountOpen(true)}
      notice={notice}
      noticeTitle={loadedWeek.error ?? undefined}
      overlay={
        <AccountSheet
          open={accountOpen}
          account={account}
          client={authClient}
          onClose={() => setAccountOpen(false)}
          onAccountChange={setAccount}
          onSignedOut={signedOut}
        />
      }
    >
      {weekLoading ? <StateSurface icon="book" title="Loading your workspace" /> : null}
      {!weekLoading && reviewIsEmpty ? (
        <StateSurface
          icon="calendar"
          title="No review for this week"
          actionLabel="Create a plan"
          actionIcon="calendar"
          onAction={() => setActiveTab("plan")}
        />
      ) : null}
      {!weekLoading && trackIsEmpty ? (
        <StateSurface
          icon="activity"
          title="No activity yet"
          actionLabel="Create a plan"
          actionIcon="calendar"
          onAction={() => setActiveTab("plan")}
        />
      ) : null}
      {!weekLoading && contentIsError ? (
        <StateSurface
          icon="info"
          title="Workspace could not load"
          actionLabel="Retry"
          actionIcon="activity"
          onAction={() => setWeekReload((value) => value + 1)}
        />
      ) : null}
      {!weekLoading && !reviewIsEmpty && !contentIsError && activeTab === "review" ? (
        <ReviewScreen review={appWeek.review} onPlan={openPlanSuggestion} />
      ) : null}
      {!weekLoading && !reviewIsEmpty && !contentIsError && activeTab === "signals" ? (
        <SignalsScreen
          signals={appWeek.signals}
          onPlan={openPlanSuggestion}
          onTrack={() => setActiveTab("track")}
        />
      ) : null}
      {!weekLoading && !trackIsEmpty && !contentIsError && activeTab === "track" ? (
        <TrackScreen
          apiBaseUrl={apiBaseUrl}
          fetchImpl={authClient.fetch}
          track={appWeek.track}
          activities={trackActivities}
          onActivitiesChange={setTrackActivities}
          onSessionSaved={() => setWeekReload((value) => value + 1)}
        />
      ) : null}
      {!weekLoading && activeTab === "plan" ? (
        <PlanScreen
          apiBaseUrl={apiBaseUrl}
          fetchImpl={authClient.fetch}
          planData={appWeek.plan}
          reviewSource={loadedWeek.source}
          entryRequest={planEntryRequest}
          onReview={() => setActiveTab("review")}
          onFocusItem={focusPlanItem}
        />
      ) : null}
    </AppShell>
  );
}

function unavailableAuthResult() {
  return {
    ok: false as const,
    data: null,
    error: { code: "api_unavailable", message: "Local service is not configured", status: 0 }
  };
}

function planItemKey(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "block";
}
