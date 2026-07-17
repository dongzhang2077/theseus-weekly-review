import { useEffect, useState } from "react";
import { AppShell } from "./shared/shell/AppShell";
import { ReviewScreen } from "./features/review/ReviewScreen";
import { SignalsScreen } from "./features/signals/SignalsScreen";
import { TrackScreen } from "./features/track/TrackScreen";
import { tickActivities } from "./features/track/timerModel";
import { PlanScreen, type PlanDetail } from "./features/plan/PlanScreen";
import { resolveInitialTab, type AppTab } from "./shared/navigation/tabs";
import { demoWeek } from "./shared/demo/demoWeek";
import { loadAppWeek } from "./shared/api/loadAppWeek";
import type { LoadedAppWeek } from "./shared/api/loadAppWeek";
import { createLocalUser, listLocalUsers, type LocalUser, type LocalUserCreatePayload } from "./shared/api/users";
import { LocalProfileScreen } from "./features/profile/LocalProfileScreen";
import { StateSurface } from "./shared/components/StateSurface";
import { clearStoredUserId, readStoredUserId, storeUserId } from "./shared/profile/localProfilePreference";
import type { ActivityTimer } from "./shared/domain/track";
import type { PlanItem } from "./shared/domain/plan";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const apiBaseUrl = env.VITE_THESEUS_API_BASE_URL?.trim();
const browserProfilesKey = "theseus.localProfiles";

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
  const [trackPreferredActivityId, setTrackPreferredActivityId] = useState<string | null>(null);

  function openPlanSuggestion() {
    setPlanEntryRequest({ id: Date.now(), detail: "suggestion" });
    setActiveTab("plan");
  }

  function focusPlanItem(item: PlanItem, projectTitle: string | null) {
    const activityId = `plan-${item.id ?? `${item.projectId ?? "flex"}-${planItemKey(item.title)}`}`;
    setTrackActivities((current) => {
      const existing = current.find((activity) => activity.id === activityId);
      if (existing) {
        return current.map((activity) => activity.id === activityId
          ? {
              ...activity,
              name: item.title,
              projectId: item.projectId ?? undefined,
              category: "Project",
              recommended: true,
              recommendationReason: projectTitle ? `Planned for ${projectTitle}` : "Planned for this week",
              completionStandard: `Capture one clear result for ${item.title}.`,
              suggestedMinutes: item.plannedMinutes
            }
          : activity);
      }
      return [{
        id: activityId,
        projectId: item.projectId ?? undefined,
        name: item.title,
        category: "Project",
        energy: "consume",
        color: "#6f8f6b",
        todaySeconds: 0,
        sessionSeconds: 0,
        running: false,
        recommended: true,
        recommendationReason: projectTitle ? `Planned for ${projectTitle}` : "Planned for this week",
        completionStandard: `Capture one clear result for ${item.title}.`,
        suggestedMinutes: item.plannedMinutes
      }, ...current];
    });
    setTrackPreferredActivityId(activityId);
    setActiveTab("track");
  }

  useEffect(() => {
    if (!apiBaseUrl) {
      const localUsers = readBrowserProfiles();
      setUsers(localUsers);
      const storedId = readStoredUserId();
      const restored = localUsers.find((user) => user.id === storedId) ?? null;
      if (restored) {
        setSelectedUser(restored);
        setProfilePhase("ready");
      }
      return;
    }

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
        setWeekLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [selectedUser, weekReload]);

  useEffect(() => {
    setTrackActivities((current) =>
      current.some((activity) => activity.running)
        ? current
        : loadedWeek.week.track.activities
    );
  }, [loadedWeek.week.track.activities]);

  useEffect(() => {
    if (!trackActivities.some((activity) => activity.running)) return;
    const interval = window.setInterval(() => {
      setTrackActivities((current) => tickActivities(current));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [trackActivities]);

  function selectUser(user: LocalUser) {
    storeUserId(user.id);
    setSelectedUser(user);
    setProfileError(null);
    setProfilePhase("ready");
  }

  async function createUser(payload: LocalUserCreatePayload) {
    if (!apiBaseUrl) {
      setProfileSaving(true);
      setProfileError(null);
      const created = createBrowserProfile(payload);
      setUsers((current) => [...current, created]);
      setProfileSaving(false);
      selectUser(created);
      return;
    }

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

  if ((apiBaseUrl && profilePhase !== "ready") || (!apiBaseUrl && profilePhase === "choose")) {
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
            onClose={selectedUser || !apiBaseUrl ? () => setProfilePhase(selectedUser ? "ready" : "demo") : undefined}
          />
        </div>
      </div>
    );
  }

  const appWeek = {
    ...loadedWeek.week,
    track: {
      ...loadedWeek.week.track,
      activities: trackActivities
    }
  };
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
      profileName={selectedUser?.display_name ?? "Account"}
      onProfileChange={() => setProfilePhase("choose")}
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
          preferredActivityId={trackPreferredActivityId}
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

function readBrowserProfiles(): LocalUser[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(browserProfilesKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalUser[];
    return Array.isArray(parsed) ? parsed.filter(isLocalUser) : [];
  } catch {
    return [];
  }
}

function createBrowserProfile(payload: LocalUserCreatePayload): LocalUser {
  const current = readBrowserProfiles();
  const now = new Date().toISOString();
  const next: LocalUser = {
    id: Date.now(),
    display_name: payload.display_name,
    timezone: payload.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    locale: payload.locale || (typeof navigator === "undefined" ? "en" : navigator.language || "en"),
    created_at: now,
    updated_at: now
  };
  writeBrowserProfiles([...current, next]);
  return next;
}

function writeBrowserProfiles(users: LocalUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(browserProfilesKey, JSON.stringify(users));
}

function isLocalUser(value: unknown): value is LocalUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<LocalUser>;
  return typeof user.id === "number" && typeof user.display_name === "string";
}
