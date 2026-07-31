import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { TodayScreen } from "../features/today/TodayScreen";
import type { ApiTimeLogRead } from "../shared/api/timeLogs";
import type { ActivityTimer, FocusSessionDraft } from "../shared/domain/track";
import type { PlanProject } from "../shared/domain/plan";
import { AppShell } from "../shared/shell/AppShell";
import "../styles/tailwind.css";
import "../styles/global.css";

const projects: PlanProject[] = [
  project(1, "Theseus", "sprint"),
  project(2, "Coursework", "stable"),
  project(3, "Recovery", "stable"),
];

const activitySeed: ActivityTimer[] = [
  activity("backend", 1, "Backend schema", "Theseus", "#5f7f5b", true, 1122),
  activity("course", 2, "Course reading", "Coursework", "#6b879d", true, 435),
  activity("walk", 3, "Walk and reset", "Recovery", "#b07b45", false, 0),
];

const logSeed: ApiTimeLogRead[] = [
  timeLog(401, "2026-07-27", 1, 5400, "Backend schema"),
  timeLog(402, "2026-07-27", 2, 2700, "Course reading"),
  timeLog(403, "2026-07-28", 2, 4200, "Research reading"),
  timeLog(404, "2026-07-29", 1, 6300, "Today workspace"),
  timeLog(405, "2026-07-30", 1, 7800, "Backend schema"),
  timeLog(406, "2026-07-30", 2, 5100, "Course reading"),
  timeLog(407, "2026-07-30", 3, 3600, "Walk and reset"),
];

function Story041Visual() {
  const [activities, setActivities] = useState(activitySeed);
  const [timeLogs, setTimeLogs] = useState(logSeed);
  const [foregroundActivityId, setForegroundActivityId] = useState<string | null>("backend");
  const [sessionDrafts, setSessionDrafts] = useState<Record<string, FocusSessionDraft>>({});
  const [trackerOpen, setTrackerOpen] = useState(false);

  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    window.setTimeout(() => {
      if (view === "week") {
        findButton("Week")?.click();
      }
      if (view === "tracker") {
        document
          .querySelector<HTMLButtonElement>('[aria-label^="Open Focus tracker"]')
          ?.click();
      }
      if (view === "running") {
        findButton("2 running")?.click();
      }
      if (view === "evidence") {
        document
          .querySelector<HTMLButtonElement>('[aria-label^="Open Theseus time records"]')
          ?.click();
      }
      window.setTimeout(() => {
        for (const element of document.querySelectorAll<HTMLElement>("*")) {
          if (element.scrollTop > 0) element.scrollTop = 0;
        }
        window.scrollTo(0, 0);
      }, 80);
    }, 60);
  }, []);

  return (
    <AppShell
      activeTab="track"
      onTabChange={() => undefined}
      navigationHidden={trackerOpen}
      interactionLocked={trackerOpen}
    >
      <TodayScreen
        apiBaseUrl="http://127.0.0.1:8000"
        timeZone="America/Los_Angeles"
        todayDate="2026-07-30"
        fetchImpl={async () => ({
          ok: false,
          status: 503,
          json: async () => ({}),
        })}
        track={{ activities }}
        activities={activities}
        projects={projects}
        timeLogs={timeLogs}
        onRetryHistory={() => undefined}
        onActivitiesChange={setActivities}
        onTimeLogsChange={setTimeLogs}
        sessionDrafts={sessionDrafts}
        onSessionDraftChange={(activityId, draft) =>
          setSessionDrafts((current) => {
            const next = { ...current };
            if (draft) next[activityId] = draft;
            else delete next[activityId];
            return next;
          })
        }
        onResultModalChange={() => undefined}
        onSessionSaved={() => undefined}
        foregroundActivityId={foregroundActivityId}
        onForegroundActivityChange={setForegroundActivityId}
        onTrackerOpenChange={setTrackerOpen}
      />
    </AppShell>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<Story041Visual />);

function findButton(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent?.trim() === label);
}

function project(
  id: number,
  title: string,
  stage: PlanProject["stage"]
): PlanProject {
  return {
    id,
    title,
    stage,
    status: "active",
    weeklyMinMinutes: 60,
    weeklyTargetMinutes: 180,
  };
}

function activity(
  id: string,
  projectId: number,
  name: string,
  projectTitle: string,
  color: string,
  running: boolean,
  sessionSeconds: number
): ActivityTimer {
  return {
    id,
    activityId: projectId + 20,
    activityVersion: 1,
    projectId,
    projectTitle,
    name,
    category: "Project",
    energy: "neutral",
    color,
    todayDate: "2026-07-30",
    todaySeconds: 0,
    sessionSeconds,
    runSeconds: sessionSeconds,
    focusSessionId: running ? projectId + 600 : undefined,
    focusSessionVersion: running ? 1 : undefined,
    focusStartedAt: running ? "2026-07-30T17:00:00Z" : undefined,
    running,
    recommended: id === "backend",
  };
}

function timeLog(
  id: number,
  date: string,
  projectId: number,
  durationSeconds: number,
  activityName: string
): ApiTimeLogRead {
  return {
    id,
    user_id: 1,
    project_id: projectId,
    date,
    duration_minutes: Math.floor(durationSeconds / 60),
    duration_seconds: durationSeconds,
    activity_name: activityName,
    activity_type: "neutral",
    type_source: "user_selected",
    note: "",
    version: 1,
    deleted_at: null,
    created_at: `${date}T10:00:00Z`,
    updated_at: `${date}T10:00:00Z`,
  };
}
