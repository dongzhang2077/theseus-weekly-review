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
  pauseActivity,
  startActivity,
  tickActivitiesByDate,
  todayActivitySeconds,
  type ActivityTimer
} from "./timerModel";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import {
  calendarDate,
  saveActivitySession,
  splitElapsedSecondsByDate
} from "../../shared/api/timeLogs";
import { FocusWorkspace } from "./FocusWorkspace";
import type { FocusSessionDraft } from "../../shared/domain/track";

const categories = ["Project", "Study", "Health"];
const energyOptions = ["consume", "restore", "neutral"] as const;
const colorOptions = [
  { name: "Green", value: "#6f8f6b" },
  { name: "Blue", value: "#8aa9c0" },
  { name: "Amber", value: "#c8a25f" },
  { name: "Pink", value: "#d69a9a" }
];
const targetOptions = [15, 25, 45, 60] as const;

type TrackSheet = "logs" | "create" | "setup" | "complete";
type SessionOutcome = "done" | "progress" | "stuck";

interface TrackScreenProps {
  track: AppWeekViewModel["track"];
  apiBaseUrl?: string;
  timeZone?: string;
  todayDate?: string;
  fetchImpl?: FetchLike;
  activities?: ActivityTimer[];
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
  const [newCategory, setNewCategory] = useState("Project");
  const [newEnergy, setNewEnergy] = useState<ActivityTimer["energy"]>("neutral");
  const [newColor, setNewColor] = useState(colorOptions[0].value);
  const [manualFocusId, setManualFocusId] = useState<string | null>(null);
  const [recommendationNotice, setRecommendationNotice] = useState<string | null>(null);
  const [localSessionDrafts, setLocalSessionDrafts] = useState<Record<string, FocusSessionDraft>>({});
  const [pendingSession, setPendingSession] = useState<ActivityTimer | null>(null);
  const [sessionOutcome, setSessionOutcome] = useState<SessionOutcome>("progress");
  const [sessionNote, setSessionNote] = useState("");
  const [sessionSaveState, setSessionSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [sessionSaveError, setSessionSaveError] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const saveRequestIdRef = useRef(0);
  const saveInFlightRef = useRef(false);

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

  function onStart(activityId: string) {
    updateActivities((current) => startActivity(current, activityId));
  }

  function onPause(activityId: string) {
    updateActivities((current) => pauseActivity(current, activityId));
    showNotice("Session paused");
  }

  function onToggleActivity(activity: ActivityTimer) {
    if (backgroundLocked) return;
    setManualFocusId(activity.id);
    if (activity.running) {
      onPause(activity.id);
      return;
    }
    onStart(activity.id);
    showNotice("Session started");
  }

  function onEnd(activityId: string) {
    const activity = activities.find((item) => item.id === activityId);
    if (!activity || activity.sessionSeconds <= 0) return;
    updateActivities((current) => pauseActivity(current, activityId));
    setPendingSession({ ...activity, running: false });
    setDetail(null);
    setSessionOutcome("progress");
    setSessionNote("");
    setSessionSaveError(null);
    setSessionSaveState("idle");
    setActiveSheet("complete");
  }

  async function onSaveSession() {
    if (!pendingSession || saveInFlightRef.current) return;
    const requestId = ++saveRequestIdRef.current;
    const session = pendingSession;
    saveInFlightRef.current = true;
    setSessionSaveState("saving");
    setSessionSaveError(null);

    if (apiBaseUrl) {
      const result = await saveActivitySession({
        apiBaseUrl,
        activity: session,
        timeZone,
        note: buildSessionNote(sessionOutcome, sessionIntent, sessionNote),
        fetchImpl
      });
      if (requestId !== saveRequestIdRef.current) return;
      if (!result.saved) {
        saveInFlightRef.current = false;
        setSessionSaveState("error");
        setSessionSaveError(result.error);
        return;
      }
    }

    if (requestId !== saveRequestIdRef.current) return;
    updateActivities((current) => completeActivity(current, session.id, todayDate));
    saveInFlightRef.current = false;
    setPendingSession(null);
    setSessionSaveState("idle");
    setActiveSheet(null);
    updateSessionDraft(session.id, null);
    onSessionSaved?.();
    showNotice(apiBaseUrl ? "Session recorded" : "Session kept in this demo");
  }

  function closeResultSheet() {
    if (sessionSaveState === "saving") return;
    setPendingSession(null);
    setSessionSaveError(null);
    setSessionSaveState("idle");
    setActiveSheet(null);
  }

  function onCreateActivity() {
    const name = newName.trim();
    if (!name || recommendationLocked) return;

    const activity: ActivityTimer = {
      id: `activity-${Date.now()}`,
      name,
      category: newCategory,
      energy: newEnergy,
      color: newColor,
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
    setActiveSheet(null);
    showNotice("Activity added to this view");
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
            onAction={() => setActiveSheet("create")}
          />
        </div>
      )}

      <Sheet
        title="Today"
        open={activeSheet === "logs"}
        onClose={() => setActiveSheet(null)}
        actions={<IconButton label="New activity" icon="plus" onClick={() => setActiveSheet("create")} />}
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
                        aria-label={`${activity.running ? "Pause" : "Start"} ${activity.name}`}
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

      <Sheet title="Quick activity" open={activeSheet === "create"} onClose={() => setActiveSheet("logs")}>
        <div className="grid gap-4">
          <p className="m-0 rounded-paper bg-desk-warn-soft px-3 py-2 text-sm leading-5 text-desk-muted">
            Quick activities stay in this view. Completed sessions are saved to your account.
          </p>
          <label className="grid gap-1 text-sm font-semibold">
            <span>Name</span>
            <input
              className="min-h-11 rounded-paper border border-desk-line bg-desk-raised px-3"
              type="text"
              value={newName}
              aria-label="Activity name"
              onChange={(event) => setNewName(event.currentTarget.value)}
            />
          </label>
          <ChoiceGroup label="Category" options={categories} value={newCategory} onChange={setNewCategory} />
          <ChoiceGroup
            label="Energy"
            options={energyOptions.map(energyLabel)}
            value={energyLabel(newEnergy)}
            onChange={(value) =>
              setNewEnergy(energyOptions.find((energy) => energyLabel(energy) === value) ?? "neutral")
            }
          />
          <div className="flex gap-3" aria-label="Color">
            {colorOptions.map((color) => (
              <button
                className={`size-9 rounded-full border-2 ${newColor === color.value ? "border-desk-ink" : "border-transparent"}`}
                style={{ backgroundColor: color.value }}
                key={color.name}
                type="button"
                aria-label={color.name}
                aria-pressed={newColor === color.value}
                onClick={() => setNewColor(color.value)}
              />
            ))}
          </div>
          <button
            className="min-h-11 rounded-paper border-0 bg-desk-accent px-4 font-bold text-white disabled:opacity-40"
            type="button"
            disabled={!newName.trim()}
            onClick={onCreateActivity}
          >
            Add to this view
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
            Use this setup
          </button>
        </div>
      </Sheet>

      <Sheet
        title="Session result"
        open={activeSheet === "complete"}
        closeDisabled={sessionSaveState === "saving"}
        onClose={closeResultSheet}
      >
        <div className="grid gap-4">
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-wide text-desk-muted">Focus completed</p>
            <h2 className="mt-1 text-lg font-bold">{pendingSession?.name}</h2>
            <p className="mt-1 text-sm text-desk-muted">
              {pendingSession ? formatDuration(pendingSession.sessionSeconds) : "0m"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2" aria-label="Session outcome">
            {(["done", "progress", "stuck"] as const).map((outcome) => (
              <button
                className={`min-h-10 rounded-paper border px-2 text-sm font-bold ${
                  sessionOutcome === outcome
                    ? "border-desk-accent bg-desk-accent-soft text-desk-accent"
                    : "border-desk-line bg-desk-raised text-desk-muted"
                }`}
                type="button"
                key={outcome}
                aria-pressed={sessionOutcome === outcome}
                disabled={sessionSaveState === "saving"}
                onClick={() => setSessionOutcome(outcome)}
              >
                {outcomeLabel(outcome)}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-semibold">
            <span>Result note</span>
            <textarea
              className="rounded-paper border border-desk-line bg-desk-raised p-3 disabled:opacity-60"
              rows={3}
              value={sessionNote}
              disabled={sessionSaveState === "saving"}
              onChange={(event) => setSessionNote(event.currentTarget.value)}
            />
          </label>
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
            {sessionSaveState === "saving" ? "Saving" : sessionSaveState === "error" ? "Retry save" : "Save result"}
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
                  label="Session setup"
                  icon="target"
                  onClick={() => {
                    setManualFocusId(detailActivity.id);
                    setDetail(null);
                    setActiveSheet("setup");
                  }}
                />
                {detailActivity.sessionSeconds > 0 ? (
                  <button
                    className="min-h-9 rounded-full border border-desk-danger/30 bg-desk-danger-soft px-4 text-sm font-bold text-desk-danger"
                    type="button"
                    aria-label="End focus"
                    onClick={() => onEnd(detailActivity.id)}
                  >
                    End
                  </button>
                ) : null}
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
  onChange
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2" aria-label={label}>
        {options.map((option) => (
          <button
            className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${
              value === option
                ? "border-desk-accent bg-desk-accent-soft text-desk-accent"
                : "border-desk-line bg-desk-raised text-desk-muted"
            }`}
            type="button"
            key={option}
            aria-pressed={value === option}
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

function buildSessionNote(outcome: SessionOutcome, intent: string, note: string): string {
  const parts = [`Outcome: ${outcomeLabel(outcome)}.`];
  if (intent.trim()) parts.push(`Session goal: ${intent.trim()}.`);
  if (note.trim()) parts.push(note.trim());
  return parts.join(" ");
}

function outcomeLabel(outcome: SessionOutcome): string {
  if (outcome === "done") return "Completed";
  if (outcome === "stuck") return "Stuck";
  return "Progress";
}

function energyLabel(energy: ActivityTimer["energy"]): string {
  if (energy === "consume") return "Focused";
  if (energy === "restore") return "Restorative";
  if (energy === "destroy") return "Draining";
  return "Neutral";
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
  targetMinutes: 25,
  intent: ""
};
