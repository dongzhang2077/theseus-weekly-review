import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import type { IconName } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import { StateSurface } from "../../shared/components/StateSurface";
import {
  chooseFocusActivity,
  completeActivity,
  currentRunSeconds,
  formatDuration,
  formatLiveClock,
  startActivity,
  stopActivity,
  tickActivitiesByDate,
  todayActivitySeconds,
  type ActivityTimer
} from "./timerModel";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import {
  activityRecordToTimer,
  createActivity,
  updateActivity
} from "../../shared/api/activities";
import {
  calendarDate,
  splitElapsedSecondsByDate
} from "../../shared/api/timeLogs";
import {
  applyFocusSession,
  createIdempotencyKey,
  endFocusSession,
  loadOpenFocusSessions,
  startFocusSession
} from "../../shared/api/focusSessions";
import { FocusWorkspace } from "./FocusWorkspace";
import type { FocusSessionDraft } from "../../shared/domain/track";
import type { PlanProject } from "../../shared/domain/plan";

const categories = ["Project", "Study", "Health"];
const energyOptions = ["consume", "restore", "neutral", "destroy"] as const;
const targetOptions = [15, 25, 45, 60] as const;

type TrackSheet = "logs" | "create" | "setup" | "complete";
type ActivityFormMode = "new" | "save" | "edit";

interface TrackScreenProps {
  track: AppWeekViewModel["track"];
  apiBaseUrl?: string;
  timeZone?: string;
  todayDate?: string;
  fetchImpl?: FetchLike;
  activities?: ActivityTimer[];
  projects?: PlanProject[];
  onActivitiesChange?: Dispatch<SetStateAction<ActivityTimer[]>>;
  sessionDrafts?: Record<string, FocusSessionDraft>;
  onSessionDraftChange?: (activityId: string, draft: FocusSessionDraft | null) => void;
  onResultModalChange?: (open: boolean) => void;
  onSessionSaved?: () => void;
}

export function TrackScreen({
  apiBaseUrl,
  timeZone,
  todayDate: controlledTodayDate,
  fetchImpl,
  track,
  activities: controlledActivities,
  projects = [],
  onActivitiesChange,
  sessionDrafts: controlledSessionDrafts,
  onSessionDraftChange,
  onResultModalChange,
  onSessionSaved
}: TrackScreenProps) {
  const [localActivities, setLocalActivities] = useState(track.activities);
  const [activeSheet, setActiveSheet] = useState<TrackSheet | null>(null);
  const [detail, setDetail] = useState<ActivityTimer | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newProjectId, setNewProjectId] = useState<number | null>(null);
  const [newEnergy, setNewEnergy] = useState<ActivityTimer["energy"]>("neutral");
  const [activityFormMode, setActivityFormMode] = useState<ActivityFormMode>("new");
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [activitySaveState, setActivitySaveState] = useState<
    "idle" | "saving" | "error" | "conflict"
  >("idle");
  const [activitySaveError, setActivitySaveError] = useState<string | null>(null);
  const [manualFocusId, setManualFocusId] = useState<string | null>(null);
  const [recommendationNotice, setRecommendationNotice] = useState<string | null>(null);
  const [localSessionDrafts, setLocalSessionDrafts] = useState<Record<string, FocusSessionDraft>>({});
  const [pendingSession, setPendingSession] = useState<ActivityTimer | null>(null);
  const [sessionSaveState, setSessionSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [sessionSaveError, setSessionSaveError] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const saveRequestIdRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const startKeysRef = useRef(new Map<string, string>());
  const endKeyRef = useRef<string | null>(null);

  const activities = controlledActivities ?? localActivities;
  const todayDate = controlledTodayDate ?? calendarDate(timeZone);
  const focus = useMemo(
    () => chooseFocusActivity(activities, { preferredId: manualFocusId }),
    [activities, manualFocusId]
  );
  const detailActivity = detail
    ? activities.find((activity) => activity.id === detail.id) ?? detail
    : null;
  const sessionDrafts = controlledSessionDrafts ?? localSessionDrafts;
  const sessionDraft = focus ? sessionDrafts[focus.id] ?? defaultSessionDraft : defaultSessionDraft;
  const targetMinutes = sessionDraft.targetMinutes;
  const sessionIntent = sessionDraft.intent;
  const hasRunningActivity = activities.some((activity) => activity.running);
  const runningCount = activities.filter((activity) => activity.running).length;
  const recommendationLocked = pendingSession !== null || sessionSaveState === "saving";
  const todayTotal = activities.reduce(
    (total, activity) => total + todayActivitySeconds(activity, todayDate),
    0
  );
  const activityCategories = [
    ...categories.filter((category) => activities.some((activity) => activity.category === category)),
    ...activities
      .map((activity) => activity.category)
      .filter((category, index, all) => !categories.includes(category) && all.indexOf(category) === index)
  ];
  const resultModalOpen = activeSheet === "complete";
  const backgroundLocked = pendingSession !== null || sessionSaveState === "saving";

  function updateActivities(update: SetStateAction<ActivityTimer[]>) {
    if (onActivitiesChange) {
      onActivitiesChange(update);
      return;
    }
    setLocalActivities(update);
  }

  useEffect(() => {
    if (onActivitiesChange || !hasRunningActivity) return;
    let lastTick = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastTick) / 1000);
      if (elapsedSeconds <= 0) return;
      const elapsedByDate = splitElapsedSecondsByDate(lastTick, elapsedSeconds, timeZone);
      lastTick += elapsedSeconds * 1000;
      setLocalActivities((current) => tickActivitiesByDate(current, elapsedByDate));
    }, 250);

    return () => window.clearInterval(interval);
  }, [hasRunningActivity, onActivitiesChange, timeZone]);

  useEffect(() => {
    if (onActivitiesChange) return;
    setLocalActivities((current) =>
      current.some((activity) => activity.running || activity.sessionSeconds > 0)
        ? current
        : track.activities
    );
  }, [onActivitiesChange, track.activities]);

  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    },
    []
  );

  useEffect(() => {
    onResultModalChange?.(resultModalOpen);
    return () => {
      if (resultModalOpen) onResultModalChange?.(false);
    };
  }, [onResultModalChange, resultModalOpen]);

  function updateSessionDraft(activityId: string, draft: FocusSessionDraft | null) {
    if (onSessionDraftChange) {
      onSessionDraftChange(activityId, draft);
      return;
    }
    setLocalSessionDrafts((current) => {
      if (draft) return { ...current, [activityId]: draft };
      const next = { ...current };
      delete next[activityId];
      return next;
    });
  }

  function showNotice(message: string) {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setRecommendationNotice(message);
    noticeTimerRef.current = window.setTimeout(() => setRecommendationNotice(null), 1800);
  }

  function onToggleActivity(activity: ActivityTimer) {
    if (backgroundLocked) return;
    setManualFocusId(activity.id);
    if (activity.running) {
      onEnd(activity.id);
      return;
    }
    void onStart(activity);
  }

  async function onStart(activity: ActivityTimer) {
    if (!apiBaseUrl) {
      updateActivities((current) => startActivity(current, activity.id));
      return;
    }
    if (sessionSaveState === "saving") return;
    setSessionSaveState("saving");
    setSessionSaveError(null);

    let target = activity;
    if (!target.activityId) {
      const created = await createActivity({
        apiBaseUrl,
        fetchImpl,
        draft: {
          projectId: target.projectId ?? null,
          name: target.name,
          description: target.activityDescription ?? "",
          activityType: energyToActivityType(target.energy)
        }
      });
      if (created.status !== "ok" || !created.data) {
        setSessionSaveState("error");
        setSessionSaveError(created.error);
        showNotice("Start failed");
        return;
      }
      target = preserveTimerState(
        activityRecordToTimer(created.data, projects),
        target
      );
      updateActivities((current) =>
        current.map((item) => item.id === activity.id ? target : item)
      );
      setManualFocusId(target.id);
    }

    const key = startKeysRef.current.get(target.id)
      ?? createIdempotencyKey("start");
    startKeysRef.current.set(target.id, key);
    const result = await startFocusSession({
      apiBaseUrl,
      fetchImpl,
      activityId: target.activityId as number,
      ...(target.taskId ? { taskId: target.taskId } : {}),
      idempotencyKey: key
    });

    if (result.status !== "ok" || !result.data) {
      if (result.code === "activity_already_open") {
        const open = await loadOpenFocusSessions({ apiBaseUrl, fetchImpl });
        const running = open.data?.find(
          (session) => session.activity_id === target.activityId
        );
        if (running) {
          updateActivities((current) =>
            current.map((item) =>
              item.activityId === target.activityId
                ? applyFocusSession(item, running, timeZone)
                : item
            )
          );
          startKeysRef.current.delete(target.id);
          setSessionSaveState("idle");
          return;
        }
      }
      setSessionSaveState("error");
      setSessionSaveError(result.error);
      showNotice("Start failed");
      return;
    }

    const startedSession = result.data;
    updateActivities((current) =>
      current.map((item) =>
        item.activityId === target.activityId
          ? applyFocusSession(item, startedSession, timeZone)
          : item
      )
    );
    startKeysRef.current.delete(target.id);
    setSessionSaveState("idle");
  }

  function onEnd(activityId: string) {
    const activity = activities.find((item) => item.id === activityId);
    if (!activity) return;
    if (!apiBaseUrl && activity.sessionSeconds <= 0) {
      updateActivities((current) => stopActivity(current, activityId));
      return;
    }
    const session = { ...activity, running: false };
    updateActivities((current) => stopActivity(current, activityId));
    setPendingSession(session);
    setDetail(null);
    setSessionSaveError(null);
    setSessionSaveState("idle");
    setActiveSheet(null);
    endKeyRef.current = createIdempotencyKey("end");
    void onSaveSession(session);
  }

  async function onSaveSession(sessionOverride?: ActivityTimer) {
    const session = sessionOverride ?? pendingSession;
    if (!session || saveInFlightRef.current) return;
    const requestId = ++saveRequestIdRef.current;
    saveInFlightRef.current = true;
    setSessionSaveState("saving");
    setSessionSaveError(null);

    if (apiBaseUrl) {
      if (!session.focusSessionId || !session.focusSessionVersion) {
        saveInFlightRef.current = false;
        setSessionSaveState("error");
        setSessionSaveError("Reload Focus before ending this session");
        setActiveSheet("complete");
        return;
      }
      const idempotencyKey = endKeyRef.current
        ?? createIdempotencyKey("end");
      endKeyRef.current = idempotencyKey;
      const result = await endFocusSession({
        apiBaseUrl,
        fetchImpl,
        sessionId: session.focusSessionId,
        expectedVersion: session.focusSessionVersion,
        idempotencyKey
      });
      if (requestId !== saveRequestIdRef.current) return;
      if (result.status !== "ok" || !result.data) {
        saveInFlightRef.current = false;
        updateActivities((current) =>
          current.map((item) =>
            item.id === session.id
              ? {
                  ...item,
                  runSeconds: session.runSeconds ?? session.sessionSeconds,
                  running: true
                }
              : item
          )
        );
        setSessionSaveState("error");
        setSessionSaveError(result.error);
        setActiveSheet("complete");
        return;
      }
      const completedSession = result.data.session;
      updateActivities((current) =>
        completeActivity(
          current.map((item) =>
            item.id === session.id
              ? {
                  ...item,
                  sessionSeconds: completedSession.accumulated_seconds
                }
              : item
          ),
          session.id,
          todayDate
        )
      );
    } else {
      updateActivities((current) => completeActivity(current, session.id, todayDate));
    }

    if (requestId !== saveRequestIdRef.current) return;
    saveInFlightRef.current = false;
    endKeyRef.current = null;
    setPendingSession(null);
    setSessionSaveState("idle");
    setActiveSheet(null);
    updateSessionDraft(session.id, null);
    onSessionSaved?.();
  }

  function closeResultSheet() {
    if (sessionSaveState === "saving") return;
    setPendingSession(null);
    setSessionSaveError(null);
    setSessionSaveState("idle");
    setActiveSheet(null);
    endKeyRef.current = null;
    onSessionSaved?.();
  }

  function openNewActivity() {
    setActivityFormMode("new");
    setEditingActivityId(null);
    setEditingViewId(null);
    setNewName("");
    setNewDescription("");
    setNewProjectId(null);
    setNewEnergy("neutral");
    setActivitySaveState("idle");
    setActivitySaveError(null);
    setActiveSheet("create");
  }

  function openEditActivity(activity: ActivityTimer) {
    setActivityFormMode(activity.activityId && activity.activityVersion ? "edit" : "save");
    setEditingActivityId(activity.activityId ?? null);
    setEditingViewId(activity.id);
    setNewName(activity.name);
    setNewDescription(activity.activityDescription ?? "");
    setNewProjectId(activity.projectId ?? null);
    setNewEnergy(activity.energy);
    setActivitySaveState("idle");
    setActivitySaveError(null);
    setActiveSheet("create");
  }

  async function onSaveActivity() {
    const name = newName.trim();
    if (!name || recommendationLocked || activitySaveState === "saving") return;

    if (apiBaseUrl) {
      setActivitySaveState("saving");
      setActivitySaveError(null);
      const current = editingActivityId === null
        ? null
        : activities.find((activity) => activity.activityId === editingActivityId) ?? null;
      const result = editingActivityId === null
        ? await createActivity({
            apiBaseUrl,
            fetchImpl,
            draft: {
              projectId: newProjectId,
              name,
              description: newDescription.trim(),
              activityType: energyToActivityType(newEnergy)
            }
          })
        : current?.activityVersion
          ? await updateActivity({
              apiBaseUrl,
              fetchImpl,
              activityId: editingActivityId,
              draft: {
                expectedVersion: current.activityVersion,
                projectId: newProjectId,
                name,
                description: newDescription.trim(),
                activityType: energyToActivityType(newEnergy)
              }
            })
          : {
              status: "error" as const,
              data: null,
              current: null,
              error: "Reload this activity before saving"
            };

      if (result.status !== "ok" || !result.data) {
        if (result.current) {
          const latest = activityRecordToTimer(result.current, projects);
          updateActivities((items) =>
            items.map((item) =>
              item.activityId === latest.activityId
                ? preserveTimerState(latest, item)
                : item
            )
          );
          setNewName(latest.name);
          setNewDescription(latest.activityDescription ?? "");
          setNewProjectId(latest.projectId ?? null);
          setNewEnergy(latest.energy);
        }
        setActivitySaveState(result.status === "conflict" ? "conflict" : "error");
        setActivitySaveError(result.error);
        return;
      }

      const saved = activityRecordToTimer(result.data, projects);
      updateActivities((items) => {
        const existing = items.find((item) => item.activityId === saved.activityId);
        if (!existing && editingViewId) {
          return items.map((item) =>
            item.id === editingViewId
              ? preserveTimerState(saved, item)
              : item
          );
        }
        if (!existing) return [...items, saved];
        return items.map((item) =>
          item.activityId === saved.activityId
            ? preserveTimerState(saved, item)
            : item
        );
      });
      setManualFocusId(saved.id);
      setActivityFormMode("new");
      setEditingActivityId(null);
      setEditingViewId(null);
      setNewName("");
      setNewDescription("");
      setActivitySaveState("idle");
      setActiveSheet(null);
      showNotice("Activity saved");
      return;
    }

    const activity: ActivityTimer = {
      id: `activity-${Date.now()}`,
      name,
      category: newProjectId ? "Project" : "Activity",
      ...(newProjectId ? { projectId: newProjectId } : {}),
      energy: newEnergy,
      color: "#6f8f6b",
      todayDate,
      todaySeconds: 0,
      sessionSeconds: 0,
      runSeconds: 0,
      running: false,
      focusContext: {
        source: "manual",
        reason: "Selected manually in this view"
      }
    };

    updateActivities((current) => [...current, activity]);
    setManualFocusId(activity.id);
    setNewName("");
    setNewDescription("");
    setActiveSheet(null);
    showNotice("Activity kept in this demo");
  }

  return (
    <section className="relative h-full overflow-y-auto bg-desk-paper font-work text-desk-ink">
      <header className="grid h-[52px] grid-cols-[44px_1fr_44px] items-center border-b border-desk-line bg-desk-raised/90 px-3">
        <button
          className="col-start-1 grid size-10 place-items-center rounded-full border-0 bg-transparent text-desk-muted hover:bg-desk-sunk disabled:cursor-not-allowed disabled:text-desk-subtle"
          type="button"
          aria-label="Choose activity"
          disabled={recommendationLocked || backgroundLocked}
          onClick={() => setActiveSheet("logs")}
        >
          <Icon name="layers" className="size-5" />
        </button>
        <h1 className="col-start-2 m-0 text-center text-[17px] font-bold">Today</h1>
        <IconButton
          className="col-start-3"
          label="Activity detail"
          icon="fileText"
          disabled={!focus || backgroundLocked}
          onClick={() => setDetail(focus)}
        />
      </header>

      {focus ? (
        <FocusWorkspace
          focus={focus}
          targetMinutes={targetMinutes}
          todayTotalSeconds={todayTotal}
          runningCount={runningCount}
          notice={recommendationNotice}
          timerLocked={backgroundLocked}
          onToggle={() => onToggleActivity(focus)}
          onOpenToday={() => setActiveSheet("logs")}
        />
      ) : (
        <div className="mx-auto w-full max-w-[400px]">
          <StateSurface
            icon="timer"
            title="No focus activity available"
            actionLabel="Add a quick activity"
            actionIcon="plus"
            onAction={openNewActivity}
          />
        </div>
      )}

      <Sheet
        title="Today"
        open={activeSheet === "logs"}
        onClose={() => setActiveSheet(null)}
        actions={<IconButton label="New activity" icon="plus" onClick={openNewActivity} />}
      >
        {activities.length > 0 ? (
          <div className="grid gap-4">
            {activityCategories.map((category) => {
              const categoryActivities = activities.filter((activity) => activity.category === category);
              return (
              <section className="grid gap-2" key={category}>
                <h3 className="m-0 flex items-center gap-2 px-1 text-xs font-bold text-desk-muted">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: categoryActivities[0]?.color ?? "#6f8f6b" }}
                    aria-hidden="true"
                  />
                  {category}
                </h3>
                {activities
                  .filter((activity) => activity.category === category)
                  .map((activity) => {
                    const activitySeconds = todayActivitySeconds(activity, todayDate);
                    const activityTime = activity.running
                      ? formatLiveClock(currentRunSeconds(activity))
                      : formatDuration(activitySeconds);
                    const selected = focus?.id === activity.id;

                    return (
                    <div
                      className="grid min-h-14 grid-cols-[minmax(0,1fr)_34px] items-center gap-1 rounded-[16px] border p-1 shadow-[0_3px_10px_rgb(76_62_38/0.04)]"
                      style={{
                        borderColor: activity.running || selected ? activity.color : "rgba(231,222,208,0.76)",
                        backgroundColor: activity.running || selected
                          ? activitySoftColor(activity.color)
                          : "rgba(255,253,248,0.76)"
                      }}
                      key={activity.id}
                    >
                      <button
                        className="grid min-h-[46px] min-w-0 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-paper border-0 bg-transparent px-1 text-left transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        aria-label={`${activity.running ? "End" : "Start"} ${activity.name}`}
                        aria-describedby={`activity-time-${activity.id}`}
                        aria-pressed={activity.running}
                        disabled={backgroundLocked}
                        onClick={() => onToggleActivity(activity)}
                      >
                        <span
                          className="grid size-[34px] shrink-0 place-items-center rounded-full border border-desk-line bg-desk-raised/75"
                          style={{ color: activity.color }}
                        >
                          <Icon name={activityIcon(activity.id)} className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block break-words text-sm leading-5">{activity.name}</strong>
                        </span>
                        <span
                          className={`min-w-[66px] shrink-0 whitespace-nowrap text-right text-xs font-bold tabular-nums ${
                            activity.running || selected ? "text-desk-ink" : "text-desk-muted"
                          }`}
                          id={`activity-time-${activity.id}`}
                        >
                          {activityTime}
                        </span>
                      </button>
                      <IconButton
                        className="!size-8"
                        label={`View ${activity.name}`}
                        icon="info"
                        style={{ color: activity.running || selected ? activity.color : undefined }}
                        onClick={() => setDetail(activity)}
                      />
                    </div>
                    );
                  })}
              </section>
              );
            })}
          </div>
        ) : (
          <p className="m-0 text-sm leading-6 text-desk-muted">Add a quick activity to start a local focus session.</p>
        )}
      </Sheet>

      <Sheet
        title={
          activityFormMode === "edit"
            ? "Edit activity"
            : activityFormMode === "save"
              ? "Save activity"
              : "New activity"
        }
        open={activeSheet === "create"}
        closeDisabled={activitySaveState === "saving"}
        onClose={() => setActiveSheet("logs")}
      >
        <div className="grid gap-4">
          {!apiBaseUrl ? (
            <p className="m-0 rounded-paper bg-desk-warn-soft px-3 py-2 text-sm leading-5 text-desk-muted">
              Local preview only.
            </p>
          ) : null}
          <label className="grid gap-1 text-sm font-semibold">
            <span>Name</span>
            <input
              className="min-h-11 rounded-paper border border-desk-line bg-desk-raised px-3 disabled:opacity-60"
              type="text"
              value={newName}
              aria-label="Activity name"
              disabled={activitySaveState === "saving"}
              onChange={(event) => setNewName(event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            <span>Project</span>
            <select
              className="min-h-11 min-w-0 rounded-paper border border-desk-line bg-desk-raised px-3 disabled:opacity-60"
              aria-label="Activity project"
              value={newProjectId ?? ""}
              disabled={activitySaveState === "saving"}
              onChange={(event) =>
                setNewProjectId(
                  event.currentTarget.value
                    ? Number(event.currentTarget.value)
                    : null
                )
              }
            >
              <option value="">None</option>
              {projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <ChoiceGroup
            label="Energy"
            options={energyOptions.map(energyLabel)}
            value={energyLabel(newEnergy)}
            disabled={activitySaveState === "saving"}
            onChange={(value) =>
              setNewEnergy(energyOptions.find((energy) => energyLabel(energy) === value) ?? "neutral")
            }
          />
          <label className="grid gap-1 text-sm font-semibold">
            <span>Note</span>
            <textarea
              className="rounded-paper border border-desk-line bg-desk-raised p-3 disabled:opacity-60"
              rows={3}
              value={newDescription}
              disabled={activitySaveState === "saving"}
              onChange={(event) => setNewDescription(event.currentTarget.value)}
            />
          </label>
          {activitySaveState === "error" || activitySaveState === "conflict" ? (
            <p
              className="m-0 rounded-paper bg-desk-danger-soft px-3 py-2 text-sm font-semibold text-desk-danger"
              role="alert"
            >
              {activitySaveState === "conflict"
                ? "Activity changed elsewhere. Current values loaded."
                : activitySaveError ?? "Activity could not be saved."}
            </p>
          ) : null}
          <button
            className="min-h-11 rounded-paper border-0 bg-desk-accent px-4 font-bold text-white disabled:opacity-40"
            type="button"
            disabled={!newName.trim() || activitySaveState === "saving"}
            onClick={() => void onSaveActivity()}
          >
            {activitySaveState === "saving"
              ? "Saving"
              : activitySaveState === "error" || activitySaveState === "conflict"
                ? "Retry"
                : "Save"}
          </button>
        </div>
      </Sheet>

      <Sheet title="Session setup" open={activeSheet === "setup"} onClose={() => setActiveSheet(null)}>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Session target</span>
            <div className="grid grid-cols-5 gap-2" aria-label="Session target">
              {targetOptions.map((minutes) => (
                <button
                  className={`min-h-10 rounded-paper border text-sm font-bold ${
                    targetMinutes === minutes
                      ? "border-desk-accent bg-desk-accent-soft text-desk-accent"
                      : "border-desk-line bg-desk-raised text-desk-muted"
                  }`}
                  type="button"
                  key={minutes}
                  aria-label={`${minutes} minute target`}
                  aria-pressed={targetMinutes === minutes}
                  onClick={() => {
                    if (focus) updateSessionDraft(focus.id, { ...sessionDraft, targetMinutes: minutes });
                  }}
                >
                  {minutes}
                </button>
              ))}
              <button
                className={`min-h-10 rounded-paper border text-xs font-bold ${
                  targetMinutes === null
                    ? "border-desk-accent bg-desk-accent-soft text-desk-accent"
                    : "border-desk-line bg-desk-raised text-desk-muted"
                }`}
                type="button"
                aria-pressed={targetMinutes === null}
                onClick={() => {
                  if (focus) updateSessionDraft(focus.id, { ...sessionDraft, targetMinutes: null });
                }}
              >
                Open
              </button>
            </div>
          </div>
          <label className="grid gap-1 text-sm font-semibold">
            <span>Goal for this session (optional)</span>
            <textarea
              className="rounded-paper border border-desk-line bg-desk-raised p-3"
              rows={3}
              value={sessionIntent}
              onChange={(event) => {
                if (focus) updateSessionDraft(focus.id, { ...sessionDraft, intent: event.currentTarget.value });
              }}
              placeholder="What would count as useful progress?"
            />
          </label>
          <button
            className="min-h-11 rounded-paper border-0 bg-desk-accent px-4 font-bold text-white"
            type="button"
            onClick={() => setActiveSheet(null)}
          >
            Save
          </button>
        </div>
      </Sheet>

      <Sheet
        title="Save failed"
        open={activeSheet === "complete"}
        closeDisabled={sessionSaveState === "saving"}
        onClose={closeResultSheet}
      >
        <div className="grid gap-4">
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-wide text-desk-muted">Session awaiting retry</p>
            <h2 className="mt-1 text-lg font-bold">{pendingSession?.name}</h2>
            <p className="mt-1 text-sm text-desk-muted">
              {pendingSession ? formatDuration(pendingSession.sessionSeconds) : "0m"}
            </p>
          </div>
          {sessionSaveState === "error" ? (
            <p className="m-0 rounded-paper bg-desk-danger-soft px-3 py-2 text-sm font-semibold text-desk-danger" role="alert">
              Session could not be saved{sessionSaveError ? `: ${sessionSaveError}` : ". Try again."}
            </p>
          ) : null}
          <button
            className="min-h-11 rounded-paper border-0 bg-desk-accent px-4 font-bold text-white disabled:opacity-50"
            type="button"
            disabled={sessionSaveState === "saving"}
            onClick={() => void onSaveSession()}
          >
            {sessionSaveState === "saving" ? "Saving" : "Retry"}
          </button>
        </div>
      </Sheet>

      <DetailPanel
        title={detailActivity?.name ?? "Activity"}
        open={detailActivity !== null}
        onBack={() => setDetail(null)}
      >
        {detailActivity ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="w-fit rounded-full bg-desk-accent-soft px-3 py-1 text-xs font-bold text-desk-accent">
                {energyLabel(detailActivity.energy)}
              </span>
              <div className="flex items-center gap-2">
                <IconButton
                  label="Edit activity"
                  icon="edit"
                  onClick={() => {
                    openEditActivity(detailActivity);
                    setDetail(null);
                  }}
                />
                <IconButton
                  label="Session setup"
                  icon="target"
                  onClick={() => {
                    setManualFocusId(detailActivity.id);
                    setDetail(null);
                    setActiveSheet("setup");
                  }}
                />
              </div>
            </div>
            <dl className="divide-y divide-desk-line border-y border-desk-line">
              <DetailRow label="Today" value={formatDuration(todayActivitySeconds(detailActivity, todayDate))} />
              <DetailRow label="Session" value={formatDuration(detailActivity.sessionSeconds)} />
              <DetailRow label="Type" value={detailActivity.category} />
              <DetailRow label="Energy" value={energyLabel(detailActivity.energy)} />
              {detailActivity.projectTitle ? <DetailRow label="Project" value={detailActivity.projectTitle} /> : null}
              {detailActivity.focusContext?.plannedMinutes !== undefined ? (
                <DetailRow label="Weekly plan" value={`${detailActivity.focusContext.plannedMinutes} min`} />
              ) : null}
            </dl>
            {detailActivity.focusContext?.reason ? (
              <div className="rounded-paper bg-desk-sunk p-3">
                <h3 className="m-0 text-xs font-bold uppercase tracking-wide text-desk-muted">Why this activity</h3>
                <p className="mb-0 mt-1 text-sm leading-6">{detailActivity.focusContext.reason}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </DetailPanel>
    </section>
  );
}

function ChoiceGroup({
  label,
  options,
  value,
  disabled = false,
  onChange
}: {
  label: string;
  options: readonly string[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2" aria-label={label}>
        {options.map((option) => (
          <button
            className={`min-h-9 rounded-full border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              value === option
                ? "border-desk-accent bg-desk-accent-soft text-desk-accent"
                : "border-desk-line bg-desk-raised text-desk-muted"
            }`}
            type="button"
            key={option}
            aria-pressed={value === option}
            disabled={disabled}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <dt className="text-sm text-desk-muted">{label}</dt>
      <dd className="m-0 text-right text-sm font-bold">{value}</dd>
    </div>
  );
}

function energyLabel(energy: ActivityTimer["energy"]): string {
  if (energy === "consume") return "Focused";
  if (energy === "restore") return "Restorative";
  if (energy === "destroy") return "Draining";
  return "Neutral";
}

function energyToActivityType(
  energy: ActivityTimer["energy"]
): "consuming" | "neutral" | "restore" | "destroy" {
  return energy === "consume" ? "consuming" : energy;
}

function preserveTimerState(
  saved: ActivityTimer,
  current: ActivityTimer
): ActivityTimer {
  return {
    ...saved,
    todayDate: current.todayDate,
    todaySeconds: current.todaySeconds,
    sessionSeconds: current.sessionSeconds,
    sessionSecondsByDate: current.sessionSecondsByDate,
    runSeconds: current.runSeconds,
    taskId: current.taskId,
    focusSessionId: current.focusSessionId,
    focusSessionVersion: current.focusSessionVersion,
    focusStartedAt: current.focusStartedAt,
    running: current.running,
    recommended: current.recommended,
    focusContext: current.focusContext ?? saved.focusContext
  };
}

function activityIcon(activityId: string): IconName {
  if (activityId === "frontend") return "code";
  if (activityId === "backend") return "briefcase";
  if (activityId === "walk") return "leaf";
  return "book";
}

function activitySoftColor(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}1f` : "rgba(231,240,227,0.74)";
}

const defaultSessionDraft: FocusSessionDraft = {
  targetMinutes: null,
  intent: ""
};
