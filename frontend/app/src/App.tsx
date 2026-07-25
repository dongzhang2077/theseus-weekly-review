import { useEffect, useState } from "react";
import { AccountSheet } from "./features/auth/AccountSheet";
import { AuthScreen, type AuthGatePhase } from "./features/auth/AuthScreen";
import { PlanScreen, type PlanDetail } from "./features/plan/PlanScreen";
import { ReviewScreen } from "./features/review/ReviewScreen";
import type { ReviewWeekRange } from "./features/review/reviewWeek";
import { SignalsScreen } from "./features/signals/SignalsScreen";
import { TrackScreen } from "./features/track/TrackScreen";
import { AuthClient, type AuthAccount, type LoginPayload, type RegisterPayload } from "./shared/auth/AuthClient";
import {
  activityRecordToTimer,
  loadActivityCatalog,
  mergeActivityCatalog
} from "./shared/api/activities";
import { demoWeekRange, loadAppWeek, type LoadedAppWeek } from "./shared/api/loadAppWeek";
import {
  applyTodayTimeLogs,
  calendarDate,
  loadTimeLogs,
  splitElapsedSecondsByDate,
  type ApiTimeLogRead
} from "./shared/api/timeLogs";
import {
  applyOpenFocusSessions,
  loadOpenFocusSessions
} from "./shared/api/focusSessions";
import { StateSurface } from "./shared/components/StateSurface";
import { demoWeek } from "./shared/demo/demoWeek";
import type { PlanItem, PlanSuggestion } from "./features/plan/planModel";
import type { AppSignalAction } from "./shared/api/weeklyReview";
import { tickActivitiesByDate } from "./features/track/timerModel";
import type { ActivityTimer, FocusSessionDraft } from "./shared/domain/track";
import type { PlanProject } from "./shared/domain/plan";
import { resolveInitialTab, type AppTab } from "./shared/navigation/tabs";
import { AppShell } from "./shared/shell/AppShell";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const apiBaseUrl = env.VITE_THESEUS_API_BASE_URL?.trim();

type AppPhase = AuthGatePhase | "signed_in";
export interface PlanEntryRequest {
  id: number;
  detail: PlanDetail;
  suggestion?: PlanSuggestion;
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
  const [selectedReviewWeek, setSelectedReviewWeek] = useState<ReviewWeekRange>(demoWeekRange);
  const [trackTodayDate, setTrackTodayDate] = useState(() => calendarDate());
  const [trackActivities, setTrackActivities] = useState<ActivityTimer[]>(demoWeek.track.activities);
  const [trackTimeLogs, setTrackTimeLogs] = useState<ApiTimeLogRead[]>([]);
  const [activityProjects, setActivityProjects] = useState<PlanProject[]>([]);
  const [focusSessionDrafts, setFocusSessionDrafts] = useState<Record<string, FocusSessionDraft>>({});
  const [focusResultOpen, setFocusResultOpen] = useState(false);
  const [reviewDetailOpen, setReviewDetailOpen] = useState(false);
  const [signalsDetailOpen, setSignalsDetailOpen] = useState(false);
  const [planDetailOpen, setPlanDetailOpen] = useState(false);
  const [trackHistoryError, setTrackHistoryError] = useState<string | null>(null);
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
    if (!account || appPhase !== "signed_in") return;
    const syncDate = () => setTrackTodayDate(calendarDate(account.timezone));
    syncDate();
    const interval = window.setInterval(syncDate, 30_000);
    return () => window.clearInterval(interval);
  }, [account, appPhase]);

  useEffect(() => {
    if (!apiBaseUrl || !authClient || !account || appPhase !== "signed_in") return;

    let ignore = false;
    setWeekLoading(true);
    Promise.all([
      loadAppWeek({
        apiBaseUrl,
        fetchImpl: authClient.fetch,
        weekStart: selectedReviewWeek.start,
        weekEnd: selectedReviewWeek.end
      }),
      loadTimeLogs({ apiBaseUrl, fetchImpl: authClient.fetch }),
      loadActivityCatalog({ apiBaseUrl, fetchImpl: authClient.fetch }),
      loadOpenFocusSessions({ apiBaseUrl, fetchImpl: authClient.fetch })
    ]).then(([loaded, timeLogs, activityCatalog, focusSessions]) => {
      if (!ignore) {
        const persistedActivities = activityCatalog.status === "ok" && activityCatalog.data
          ? activityCatalog.data.activities.map((activity) =>
              activityRecordToTimer(activity, activityCatalog.data?.projects ?? [])
            )
          : [];
        const activitySeed = mergeActivityCatalog(
          persistedActivities,
          loaded.week.track.activities
        );
        const activitiesWithHistory = timeLogs.loaded
          ? applyTodayTimeLogs(
              activitySeed,
              timeLogs.logs,
              trackTodayDate
            )
          : activitySeed;
        const activities = focusSessions.status === "ok" && focusSessions.data
          ? applyOpenFocusSessions(
              activitiesWithHistory,
              focusSessions.data,
              account.timezone
            )
          : activitiesWithHistory;
        const hydratedWeek = {
          ...loaded.week,
          track: { activities }
        };
        setLoadedWeek({ ...loaded, week: hydratedWeek });
        setActivityProjects(
          activityCatalog.status === "ok" && activityCatalog.data
            ? activityCatalog.data.projects
            : []
        );
        setTrackHistoryError(
          timeLogs.error
          ?? activityCatalog.error
          ?? focusSessions.error
        );
        setTrackTimeLogs(timeLogs.loaded ? timeLogs.logs : []);
        setTrackActivities(activities);
        setWeekLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [
    account?.id,
    account?.timezone,
    appPhase,
    authClient,
    selectedReviewWeek.end,
    selectedReviewWeek.start,
    trackTodayDate,
    weekReload
  ]);

  useEffect(() => {
    if (!account || appPhase !== "signed_in") return;
    setTrackActivities((current) =>
      applyTodayTimeLogs(current, trackTimeLogs, trackTodayDate)
    );
  }, [account?.id, appPhase, trackTimeLogs, trackTodayDate]);

  useEffect(() => {
    if (!hasRunningTrackActivity) return;

    let lastTick = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastTick) / 1000);
      if (elapsedSeconds <= 0) return;
      const elapsedByDate = splitElapsedSecondsByDate(
        lastTick,
        elapsedSeconds,
        account?.timezone
      );
      lastTick += elapsedSeconds * 1000;
      setTrackActivities((current) => tickActivitiesByDate(current, elapsedByDate));
    }, 250);

    return () => window.clearInterval(interval);
  }, [account?.timezone, hasRunningTrackActivity]);

  function enterSignedIn(nextAccount: AuthAccount) {
    setAccount(nextAccount);
    setAccountOpen(false);
    setTrackActivities([]);
    setTrackTimeLogs([]);
    setActivityProjects([]);
    setFocusSessionDrafts({});
    setFocusResultOpen(false);
    setReviewDetailOpen(false);
    setSignalsDetailOpen(false);
    setPlanDetailOpen(false);
    setTrackHistoryError(null);
    setWeekReload(0);
    setSelectedReviewWeek(demoWeekRange);
    setTrackTodayDate(calendarDate(nextAccount.timezone));
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
    setTrackActivities([]);
    setTrackTimeLogs([]);
    setActivityProjects([]);
    setFocusSessionDrafts({});
    setFocusResultOpen(false);
    setReviewDetailOpen(false);
    setSignalsDetailOpen(false);
    setPlanDetailOpen(false);
    setTrackHistoryError(null);
    setWeekReload(0);
    setSelectedReviewWeek(demoWeekRange);
    setWeekLoading(false);
    setAppPhase("signed_out");
  }

  function openPlanSuggestion() {
    setPlanEntryRequest({ id: Date.now(), detail: "suggestion" });
    setActiveTab("plan");
  }

  function openSignalAction(action: AppSignalAction) {
    setSignalsDetailOpen(false);
    setPlanEntryRequest({
      id: Date.now(),
      detail: action.detail,
      ...(action.suggestion ? { suggestion: action.suggestion } : {})
    });
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
                taskId: item.taskId ?? undefined,
                projectTitle: projectTitle ?? undefined,
                recommended: true,
                focusContext: planItemFocusContext(item)
              }
            : activity
        );
      }
      return [
        {
          id: activityId,
          projectId: item.projectId ?? undefined,
          taskId: item.taskId ?? undefined,
          name: item.title,
          category: "Project",
          energy: "neutral",
          color: "#6f8f6b",
          projectTitle: projectTitle ?? undefined,
          todaySeconds: 0,
          sessionSeconds: 0,
          running: false,
          recommended: true,
          focusContext: planItemFocusContext(item)
        },
        ...current
      ];
    });
    setActiveTab("track");
  }

  function updateFocusSessionDraft(activityId: string, draft: FocusSessionDraft | null) {
    setFocusSessionDrafts((current) => {
      if (draft) return { ...current, [activityId]: draft };
      const next = { ...current };
      delete next[activityId];
      return next;
    });
  }

  function changeReviewWeek(range: ReviewWeekRange) {
    setReviewDetailOpen(false);
    setSelectedReviewWeek(range);
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
  const signalsAreEmpty = loadedWeek.source === "empty" && activeTab === "signals";
  const trackIsError = activeTab === "track" && Boolean(trackHistoryError);
  const contentIsError = loadedWeek.source === "error" && (activeTab === "review" || activeTab === "signals");
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
      onTabChange={(tab) => {
        if (!focusResultOpen && !reviewDetailOpen && !signalsDetailOpen && !planDetailOpen) setActiveTab(tab);
      }}
      interactionLocked={focusResultOpen || reviewDetailOpen || signalsDetailOpen || planDetailOpen}
      navigationHidden={reviewDetailOpen || signalsDetailOpen || planDetailOpen}
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
      {!weekLoading && signalsAreEmpty ? (
        <StateSurface
          icon="calendar"
          title="No review for this week"
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
      {!weekLoading && trackIsError ? (
        <StateSurface
          icon="info"
          title="Focus history could not load"
          actionLabel="Retry"
          actionIcon="activity"
          onAction={() => setWeekReload((value) => value + 1)}
        />
      ) : null}
      {!weekLoading && !contentIsError && activeTab === "review" ? (
        <ReviewScreen
          review={loadedWeek.source === "empty" ? null : appWeek.review}
          weekRange={selectedReviewWeek}
          onWeekChange={changeReviewWeek}
          onPlan={openPlanSuggestion}
          onAction={openSignalAction}
          onDetailOpenChange={setReviewDetailOpen}
        />
      ) : null}
      {!weekLoading && !signalsAreEmpty && !contentIsError && activeTab === "signals" ? (
        <SignalsScreen
          signals={appWeek.signals}
          weekLabel={appWeek.review.weekLabel}
          onAction={openSignalAction}
          onTrack={() => setActiveTab("track")}
          onDetailOpenChange={setSignalsDetailOpen}
        />
      ) : null}
      {!weekLoading && !trackIsError && !contentIsError && activeTab === "track" ? (
        <TrackScreen
          apiBaseUrl={apiBaseUrl}
          timeZone={account.timezone}
          todayDate={trackTodayDate}
          fetchImpl={authClient.fetch}
          track={appWeek.track}
          activities={trackActivities}
          timeLogs={trackTimeLogs}
          projects={activityProjects}
          onActivitiesChange={setTrackActivities}
          onTimeLogsChange={setTrackTimeLogs}
          sessionDrafts={focusSessionDrafts}
          onSessionDraftChange={updateFocusSessionDraft}
          onResultModalChange={setFocusResultOpen}
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
          onDetailOpenChange={setPlanDetailOpen}
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

function planItemFocusContext(item: PlanItem): NonNullable<ActivityTimer["focusContext"]> {
  return {
    source: "persisted_plan",
    ...(item.id !== null && item.id !== undefined ? { planItemId: item.id } : {}),
    plannedMinutes: item.plannedMinutes,
    priority: item.priority,
    isCompleted: item.isCompleted,
    reason: `Priority ${item.priority} in this week's plan`
  };
}
