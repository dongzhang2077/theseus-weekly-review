import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import type { IconName } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import {
  chooseFocusActivity,
  completeActivity,
  formatCompactClock,
  formatDuration,
  pauseActivity,
  startActivity,
  tickActivities,
  type ActivityTimer
} from "./timerModel";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import { saveActivitySession } from "../../shared/api/timeLogs";

const categories = ["Project", "Study", "Health"];
const energyOptions = ["consume", "restore", "neutral"] as const;
const colorOptions = [
  { name: "Green", value: "#6f8f6b" },
  { name: "Blue", value: "#8aa9c0" },
  { name: "Amber", value: "#c8a25f" },
  { name: "Pink", value: "#d69a9a" }
];

type TrackSheet = "logs" | "create" | "complete";
type SessionOutcome = "done" | "progress" | "stuck";

interface TrackScreenProps {
  track: AppWeekViewModel["track"];
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
  activities?: ActivityTimer[];
  onActivitiesChange?: Dispatch<SetStateAction<ActivityTimer[]>>;
  onSessionSaved?: () => void;
}

export function TrackScreen({
  apiBaseUrl,
  fetchImpl,
  track,
  activities: controlledActivities,
  onActivitiesChange,
  onSessionSaved
}: TrackScreenProps) {
  const [localActivities, setLocalActivities] = useState(track.activities);
  const [activeSheet, setActiveSheet] = useState<TrackSheet | null>(null);
  const [detail, setDetail] = useState<ActivityTimer | null>(null);
  const [newName, setNewName] = useState("Design polish block");
  const [newCategory, setNewCategory] = useState("Project");
  const [newEnergy, setNewEnergy] = useState<ActivityTimer["energy"]>("consume");
  const [newColor, setNewColor] = useState(colorOptions[0].value);
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null);
  const [manualFocusId, setManualFocusId] = useState<string | null>(null);
  const [recommendationNotice, setRecommendationNotice] = useState<string | null>(null);
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [pendingSession, setPendingSession] = useState<ActivityTimer | null>(null);
  const [sessionOutcome, setSessionOutcome] = useState<SessionOutcome>("progress");
  const [sessionNote, setSessionNote] = useState("");
  const [sessionSaveState, setSessionSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const activities = controlledActivities ?? localActivities;
  const focus = useMemo(
    () => chooseFocusActivity(activities, { preferredId: manualFocusId }),
    [activities, manualFocusId]
  );
  const hasRunningActivity = activities.some((activity) => activity.running);
  const todayTotal = activities.reduce(
    (total, activity) => total + activity.todaySeconds + activity.sessionSeconds,
    0
  );

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
      lastTick += elapsedSeconds * 1000;
      setLocalActivities((current) => tickActivities(current, elapsedSeconds));
    }, 250);

    return () => window.clearInterval(interval);
  }, [hasRunningActivity, onActivitiesChange]);

  useEffect(() => {
    if (onActivitiesChange) return;
    setLocalActivities((current) =>
      current.some((activity) => activity.running) ? current : track.activities
    );
  }, [onActivitiesChange, track.activities]);

  useEffect(() => {
    setTargetMinutes(25);
  }, [focus.id]);

  function showNotice(message: string) {
    setRecommendationNotice(message);
    window.setTimeout(() => setRecommendationNotice(null), 1400);
  }

  function selectNext(message: string) {
    if (activities.length < 2) {
      showNotice("No other activity yet");
      return;
    }
    const currentIndex = activities.findIndex((activity) => activity.id === focus.id);
    const next = activities[(currentIndex + 1) % activities.length];
    setManualFocusId(next.id);
    showNotice(message);
  }

  function onStart(activityId: string) {
    updateActivities((current) => startActivity(current, activityId));
  }

  function onPause(activityId: string) {
    updateActivities((current) => pauseActivity(current, activityId));
    showNotice("Paused");
  }

  function onEnd(activityId: string) {
    const activity = activities.find((item) => item.id === activityId);
    if (!activity || activity.sessionSeconds <= 0) return;
    updateActivities((current) => pauseActivity(current, activityId));
    setPendingSession({ ...activity, running: false });
    setSessionOutcome("progress");
    setSessionNote("");
    setSessionSaveState("idle");
    setActiveSheet("complete");
  }

  async function onSaveSession() {
    if (!pendingSession) return;
    setSessionSaveState("saving");

    if (apiBaseUrl) {
      const result = await saveActivitySession({
        apiBaseUrl,
        activity: pendingSession,
        note: buildSessionNote(sessionOutcome, sessionNote),
        fetchImpl
      });
      if (!result.saved) {
        setSessionSaveState("error");
        return;
      }
    }

    updateActivities((current) => completeActivity(current, pendingSession.id));
    setPendingSession(null);
    setSessionSaveState("saved");
    setActiveSheet(null);
    onSessionSaved?.();
    showNotice(apiBaseUrl ? "Session recorded" : "Session kept in this demo");
  }

  function onCreateActivity() {
    const name = newName.trim();
    if (!name) return;

    const activity: ActivityTimer = {
      id: `activity-${Date.now()}`,
      name,
      category: newCategory,
      energy: newEnergy,
      color: newColor,
      todaySeconds: 0,
      sessionSeconds: 0,
      running: false
    };

    updateActivities((current) => [...current, activity]);
    setManualFocusId(activity.id);
    setNewName("");
    setActiveSheet(null);
  }

  function onSaveDetail() {
    if (!detail) return;
    setSavedActivityId(detail.id);
    window.setTimeout(() => setSavedActivityId(null), 1200);
  }

  return (
    <section className="relative min-h-full overflow-y-auto bg-desk-paper pb-6 font-work text-desk-ink">
      <header className="grid h-[52px] grid-cols-[44px_1fr_44px] items-center border-b border-desk-line bg-desk-raised/90 px-3">
        <button
          className="col-start-1 grid size-10 place-items-center rounded-full border-0 bg-transparent text-desk-muted hover:bg-desk-sunk"
          type="button"
          aria-label="Choose activity"
          onClick={() => setActiveSheet("logs")}
        >
          <Icon name="layers" className="size-5" />
        </button>
        <h1 className="col-start-2 m-0 text-center text-[17px] font-bold">Today</h1>
        <IconButton
          className="col-start-3"
          label="Activity detail"
          icon="fileText"
          onClick={() => setDetail(focus)}
        />
      </header>

      <div className="mx-auto flex w-full flex-col gap-4 px-4 py-4">
        <div className="flex flex-col gap-4">
          <section className="rounded-paper border border-desk-line bg-desk-raised p-4 shadow-paper" aria-label="Recommended focus">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-paper bg-desk-accent-soft text-desk-accent" aria-hidden="true">
                <Icon name={activityIcon(focus.id)} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold uppercase tracking-wide text-desk-accent">
                  {focus.running ? "In focus" : "Recommended"}
                </span>
                <h2 className="mt-1 truncate text-xl font-bold leading-tight">{focus.name}</h2>
                <p className="mt-1 text-sm leading-5 text-desk-muted">{recommendationReason(focus)}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-[100px_1fr] gap-x-3 gap-y-2 border-t border-desk-line pt-3 text-sm">
              <dt className="text-desk-muted">Focus window</dt>
              <dd className="m-0 font-semibold">{targetMinutes} min</dd>
              <dt className="text-desk-muted">Done when</dt>
              <dd className="m-0 font-semibold">One clear result is recorded</dd>
            </dl>
          </section>

          <div className="grid grid-cols-4 gap-1 border-b border-desk-line pb-3" aria-label="Recommendation controls">
            {[
              ["Next", () => selectNext("Showing the next activity")],
              ["Delay", () => selectNext("Delayed for this view")],
              ["Skip", () => selectNext("Skipped for this view")],
              ["Choose", () => setActiveSheet("logs")]
            ].map(([label, action]) => (
              <button
                className="min-h-9 rounded-paper border-0 bg-transparent px-2 text-xs font-bold text-desk-muted transition-colors duration-150 hover:bg-desk-sunk hover:text-desk-ink disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                disabled={focus.running}
                key={label as string}
                onClick={action as () => void}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section className="border-y border-desk-line py-4" aria-label="Focus timer">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="tabular-nums text-[36px] font-semibold leading-none tracking-tight">
                  {formatCompactClock(focus.sessionSeconds)}
                </div>
                <div className="mt-1 text-xs font-semibold text-desk-muted">of {targetMinutes}:00</div>
              </div>
              <button
                className="inline-flex min-h-12 items-center gap-2 rounded-full border-0 bg-desk-accent px-5 font-bold text-white shadow-paper transition-colors duration-150 hover:bg-desk-accent/90"
                type="button"
                aria-label={focus.running ? "Pause" : focus.sessionSeconds > 0 ? "Resume" : "Start"}
                onClick={() => (focus.running ? onPause(focus.id) : onStart(focus.id))}
              >
                <Icon name={focus.running ? "pause" : "play"} className="size-5" />
                <span>{focus.running ? "Pause" : focus.sessionSeconds > 0 ? "Resume" : "Start"}</span>
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                className="min-h-9 rounded-paper border border-desk-line bg-desk-raised px-3 text-sm font-bold text-desk-muted hover:bg-desk-sunk"
                type="button"
                aria-label="Add five minutes"
                onClick={() => setTargetMinutes((minutes) => minutes + 5)}
              >
                +5 min
              </button>
              <button
                className="min-h-9 rounded-paper border border-desk-line bg-transparent px-3 text-sm font-bold text-desk-danger hover:bg-desk-danger-soft disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                aria-label="End focus"
                disabled={focus.sessionSeconds === 0}
                onClick={() => onEnd(focus.id)}
              >
                End
              </button>
            </div>
          </section>

          <button
            className="flex min-h-11 items-center justify-between rounded-paper border-0 bg-desk-sunk px-3 text-left"
            type="button"
            aria-label="Open today's activity list"
            onClick={() => setActiveSheet("logs")}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-desk-muted">
              <span className={`size-2 rounded-full ${hasRunningActivity ? "bg-desk-accent" : "bg-desk-subtle"}`} aria-hidden="true" />
              Today total
            </span>
            <strong className="tabular-nums">{formatDuration(todayTotal)}</strong>
          </button>
          {recommendationNotice ? (
            <div className="rounded-paper bg-desk-accent-soft px-3 py-2 text-center text-sm font-semibold text-desk-accent" role="status">
              {recommendationNotice}
            </div>
          ) : null}
        </div>
      </div>

      <Sheet
        title="Choose activity"
        open={activeSheet === "logs"}
        onClose={() => setActiveSheet(null)}
        actions={<IconButton label="New activity" icon="plus" onClick={() => setActiveSheet("create")} />}
      >
        <div className="divide-y divide-desk-line">
          {categories.map((category) => (
            <section className="py-2" key={category}>
              <h3 className="m-0 px-1 py-2 text-xs font-bold uppercase tracking-wide text-desk-muted">{category}</h3>
              {activities
                .filter((activity) => activity.category === category)
                .map((activity) => (
                  <div className="flex min-h-14 items-center gap-2" key={activity.id}>
                    <button
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-paper border-0 bg-transparent px-1 py-2 text-left hover:bg-desk-sunk"
                      type="button"
                      aria-label={`Choose ${activity.name}`}
                      onClick={() => {
                        setManualFocusId(activity.id);
                        setActiveSheet(null);
                      }}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-paper bg-desk-sunk" style={{ color: activity.color }}>
                        <Icon name={activityIcon(activity.id)} className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{activity.name}</strong>
                        <small className="text-desk-muted">{formatDuration(activity.todaySeconds + activity.sessionSeconds)}</small>
                      </span>
                    </button>
                    <IconButton
                      label={activity.running ? `Pause ${activity.name}` : `Start ${activity.name}`}
                      icon={activity.running ? "pause" : "play"}
                      onClick={() => (activity.running ? onPause(activity.id) : onStart(activity.id))}
                    />
                    <IconButton label={`View ${activity.name}`} icon="info" onClick={() => setDetail(activity)} />
                  </div>
                ))}
            </section>
          ))}
        </div>
      </Sheet>

      <Sheet title="New activity" open={activeSheet === "create"} onClose={() => setActiveSheet("logs")}>
        <div className="grid gap-4">
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
            onChange={(value) => setNewEnergy(energyOptions.find((energy) => energyLabel(energy) === value) ?? "neutral")}
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
            Create activity
          </button>
        </div>
      </Sheet>

      <Sheet title="Session result" open={activeSheet === "complete"} onClose={() => setActiveSheet(null)}>
        <div className="grid gap-4">
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-wide text-desk-muted">Focus completed</p>
            <h2 className="mt-1 text-lg font-bold">{pendingSession?.name}</h2>
            <p className="mt-1 text-sm text-desk-muted">{pendingSession ? formatDuration(pendingSession.sessionSeconds) : "0m"}</p>
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
                onClick={() => setSessionOutcome(outcome)}
              >
                {outcomeLabel(outcome)}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-semibold">
            <span>Result note</span>
            <textarea
              className="rounded-paper border border-desk-line bg-desk-raised p-3"
              rows={3}
              value={sessionNote}
              onChange={(event) => setSessionNote(event.currentTarget.value)}
            />
          </label>
          {sessionSaveState === "error" ? (
            <p className="m-0 rounded-paper bg-desk-danger-soft px-3 py-2 text-sm font-semibold text-desk-danger" role="alert">
              Session could not be saved. Try again.
            </p>
          ) : null}
          <button
            className="min-h-11 rounded-paper border-0 bg-desk-accent px-4 font-bold text-white disabled:opacity-50"
            type="button"
            disabled={sessionSaveState === "saving"}
            onClick={() => void onSaveSession()}
          >
            {sessionSaveState === "saving" ? "Saving" : "Save result"}
          </button>
        </div>
      </Sheet>

      <DetailPanel title={detail?.name ?? "Activity"} open={detail !== null} onBack={() => setDetail(null)}>
        {detail ? (
          <div className="grid gap-4">
            <span className="w-fit rounded-full bg-desk-accent-soft px-3 py-1 text-xs font-bold text-desk-accent">
              {energyLabel(detail.energy)}
            </span>
            <dl className="divide-y divide-desk-line border-y border-desk-line">
              <DetailRow label="Today" value={formatDuration(detail.todaySeconds + detail.sessionSeconds)} />
              <DetailRow label="Type" value={detail.category} />
              <DetailRow label="Energy" value={energyLabel(detail.energy)} />
            </dl>
            <label className="grid gap-1 text-sm font-semibold">
              <span>Note</span>
              <textarea className="rounded-paper border border-desk-line bg-desk-raised p-3" rows={3} defaultValue="Capture one clear result from this focus block." />
            </label>
            <button className="min-h-11 rounded-paper border-0 bg-desk-accent font-bold text-white" type="button" onClick={onSaveDetail}>
              {savedActivityId === detail.id ? "Saved" : "Save"}
            </button>
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
      <dd className="m-0 text-sm font-bold">{value}</dd>
    </div>
  );
}

function recommendationReason(activity: ActivityTimer): string {
  if (activity.running) return "Session in progress";
  if (activity.recommended && activity.projectTitle) return `${activity.projectTitle} · planned this week`;
  if (activity.recommended) return "Marked as a weekly priority";
  return `${activity.category} · ${energyLabel(activity.energy)} energy`;
}

function buildSessionNote(outcome: SessionOutcome, note: string): string {
  const prefix = `Outcome: ${outcomeLabel(outcome)}.`;
  return note.trim() ? `${prefix} ${note.trim()}` : prefix;
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
