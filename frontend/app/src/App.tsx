import { useEffect, useState } from "react";
import { AppShell } from "./shared/shell/AppShell";
import { ReviewScreen } from "./features/review/ReviewScreen";
import { SignalsScreen } from "./features/signals/SignalsScreen";
import { TrackScreen } from "./features/track/TrackScreen";
import { PlanScreen, type PlanDetail } from "./features/plan/PlanScreen";
import { resolveInitialTab, type AppTab } from "./shared/navigation/tabs";
import { demoWeek } from "./shared/demo/demoWeek";
import { loadAppWeek } from "./shared/api/loadAppWeek";
import type { LoadedAppWeek } from "./shared/api/loadAppWeek";
import { createLocalUser, listLocalUsers, type LocalUser, type LocalUserCreatePayload } from "./shared/api/users";
import { LocalProfileScreen } from "./features/profile/LocalProfileScreen";
import { StateSurface } from "./shared/components/StateSurface";
import { clearStoredUserId, readStoredUserId, storeUserId } from "./shared/profile/localProfilePreference";
import { tickActivities } from "./features/track/timerModel";
import type { ActivityTimer } from "./shared/domain/track";
import type { PlanItem } from "./features/plan/planModel";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const apiBaseUrl = env.VITE_THESEUS_API_BASE_URL?.trim();

type ProfilePhase = "demo" | "loading" | "choose" | "ready" | "error";

export interface PlanEntryRequest {
  id: number;
  detail: PlanDetail;
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() =>
    resolveInitialTab(typeof window === "undefined" ? "" : window.location.search)
  );
  const [planEntryRequest, setPlanEntryRequest] = useState<PlanEntryRequest | null>(null);
  const [loadedWeek, setLoadedWeek] = useState<LoadedAppWeek>({
    week: demoWeek,
    source: "demo",
    error: null
  });
  const [weekLoading, setWeekLoading] = useState(Boolean(apiBaseUrl));
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LocalUser | null>(null);
  const [profilePhase, setProfilePhase] = useState<ProfilePhase>(apiBaseUrl ? "loading" : "demo");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileReload, setProfileReload] = useState(0);
  const [weekReload, setWeekReload] = useState(0);
  const [trackActivities, setTrackActivities] = useState<ActivityTimer[]>(demoWeek.track.activities);
  const hasRunningTrackActivity = trackActivities.some((activity) => activity.running);

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

  useEffect(() => {
    if (!apiBaseUrl) return;
    let ignore = false;

    setProfilePhase("loading");
    setProfileError(null);
    listLocalUsers({ apiBaseUrl }).then((result) => {
      if (ignore) return;
      if (!result.ok || !result.data) {
        setProfileError(result.error);
        setProfilePhase("error");
        return;
      }

      setUsers(result.data);
      const storedId = readStoredUserId();
      const restored = result.data.find((user) => user.id === storedId) ?? null;
      if (restored) {
        setSelectedUser(restored);
        setProfilePhase("ready");
      } else {
        clearStoredUserId();
        setSelectedUser(null);
        setProfilePhase("choose");
      }
    });

    return () => {
      ignore = true;
    };
  }, [profileReload]);

  useEffect(() => {
    if (!apiBaseUrl || !selectedUser) {
      if (!apiBaseUrl) setWeekLoading(false);
      return;
    }

    let ignore = false;
    setWeekLoading(true);
    loadAppWeek({ apiBaseUrl, userId: selectedUser.id }).then((loaded) => {
      if (!ignore) {
        setLoadedWeek(loaded);
        setTrackActivities(loaded.week.track.activities);
        setWeekLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [selectedUser, weekReload]);

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

  function selectUser(user: LocalUser) {
    storeUserId(user.id);
    setSelectedUser(user);
    setProfileError(null);
    setProfilePhase("ready");
  }

  async function createUser(payload: LocalUserCreatePayload) {
    if (!apiBaseUrl) return;

    setProfileSaving(true);
    setProfileError(null);
    const result = await createLocalUser({ apiBaseUrl, payload });
    setProfileSaving(false);
    if (!result.ok || !result.data) {
      setProfileError(result.error);
      return;
    }

    setUsers((current) => [...current, result.data as LocalUser]);
    selectUser(result.data);
  }

  if (apiBaseUrl && profilePhase !== "ready") {
    return (
      <div className="app-viewport">
        <div className="phone-frame profile-frame">
          <LocalProfileScreen
            users={users}
            loading={profilePhase === "loading"}
            unavailable={profilePhase === "error"}
            saving={profileSaving}
            error={profileError}
            onSelect={selectUser}
            onCreate={createUser}
            onRetry={() => setProfileReload((value) => value + 1)}
          />
        </div>
      </div>
    );
  }

  const appWeek = loadedWeek.week;
  const reviewIsEmpty =
    loadedWeek.source === "empty" &&
    (activeTab === "review" || activeTab === "signals");
  const reviewIsError =
    loadedWeek.source === "error" &&
    (activeTab === "review" || activeTab === "signals");
  const notice = weekLoading
    ? "Loading"
    : reviewIsEmpty
      ? "No review"
      : loadedWeek.source === "error"
        ? "Load failed"
      : loadedWeek.source !== "api"
        ? "Sample data"
        : loadedWeek.error
          ? "Rule-based review"
          : undefined;

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      profileName={selectedUser?.display_name}
      onProfileChange={selectedUser ? () => setProfilePhase("choose") : undefined}
      notice={notice}
      noticeTitle={
        reviewIsEmpty
          ? "No saved review exists for the selected week"
          : reviewIsError
            ? loadedWeek.error ?? "Weekly review could not load"
          : loadedWeek.error ?? undefined
      }
    >
      {weekLoading ? <StateSurface icon="book" title="Loading review" /> : null}
      {!weekLoading && reviewIsEmpty ? (
        <StateSurface
          icon="calendar"
          title="No review for this week"
          actionLabel="Open plan"
          actionIcon="calendar"
          onAction={() => setActiveTab("plan")}
        />
      ) : null}
      {!weekLoading && reviewIsError ? (
        <StateSurface
          icon="info"
          title="Review could not load"
          actionLabel="Retry"
          actionIcon="activity"
          onAction={() => setWeekReload((value) => value + 1)}
        />
      ) : null}
      {!weekLoading && !reviewIsEmpty && !reviewIsError && activeTab === "review" ? <ReviewScreen review={appWeek.review} onPlan={openPlanSuggestion} /> : null}
      {!weekLoading && !reviewIsEmpty && !reviewIsError && activeTab === "signals" ? (
        <SignalsScreen
          signals={appWeek.signals}
          onPlan={openPlanSuggestion}
          onTrack={() => setActiveTab("track")}
        />
      ) : null}
      {!weekLoading && activeTab === "track" ? (
        <TrackScreen
          apiBaseUrl={apiBaseUrl}
          userId={selectedUser?.id}
          track={appWeek.track}
          activities={trackActivities}
          onActivitiesChange={setTrackActivities}
          onSessionSaved={() => setWeekReload((value) => value + 1)}
        />
      ) : null}
      {!weekLoading && activeTab === "plan" ? (
        <PlanScreen
          apiBaseUrl={apiBaseUrl}
          userId={selectedUser?.id}
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

function planItemKey(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "block";
}
