import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import type { IconName } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import { chooseFocusActivity, formatClock, formatDuration, tickActivities, toggleActivity, type ActivityTimer } from "./timerModel";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import { saveActivitySession } from "../../shared/api/timeLogs";

const focusCharacterUrl = new URL("../../assets/character-steady.png", import.meta.url).href;

const categories = ["Project", "Study", "Health"];
const energyOptions = ["consume", "restore", "neutral"] as const;
const colorOptions = [
  { name: "Green", value: "#6f8f6b", className: "green" },
  { name: "Blue", value: "#8aa9c0", className: "blue" },
  { name: "Amber", value: "#c8a25f", className: "amber" },
  { name: "Pink", value: "#d69a9a", className: "pink" }
];
type TrackSheet = "logs" | "create" | "complete";
type SessionOutcome = "done" | "progress" | "stuck" | "draining";

const sessionOutcomes: Array<{ id: SessionOutcome; label: string; icon: IconName }> = [
  { id: "done", label: "Completed", icon: "check" },
  { id: "progress", label: "Made progress", icon: "leaf" },
  { id: "stuck", label: "Got stuck", icon: "route" },
  { id: "draining", label: "Very draining", icon: "gauge" }
];

interface TrackScreenProps {
  track: AppWeekViewModel["track"];
  activities?: ActivityTimer[];
  onActivitiesChange?: Dispatch<SetStateAction<ActivityTimer[]>>;
  preferredActivityId?: string | null;
  apiBaseUrl?: string;
  userId?: number;
  onSessionSaved?: () => void;
}

export function TrackScreen({ activities: controlledActivities, apiBaseUrl, onActivitiesChange, preferredActivityId, userId, track, onSessionSaved }: TrackScreenProps) {
  const [localActivities, setLocalActivities] = useState(track.activities);
  const [activeSheet, setActiveSheet] = useState<TrackSheet | null>(null);
  const [detail, setDetail] = useState<ActivityTimer | null>(null);
  const [newName, setNewName] = useState("Design polish block");
  const [newCategory, setNewCategory] = useState("Project");
  const [newEnergy, setNewEnergy] = useState<ActivityTimer["energy"]>("consume");
  const [newColor, setNewColor] = useState(colorOptions[0].value);
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<ActivityTimer | null>(null);
  const [sessionOutcome, setSessionOutcome] = useState<SessionOutcome>("progress");
  const [sessionNote, setSessionNote] = useState("");
  const [sessionSaveState, setSessionSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [ignoredRecommendationIds, setIgnoredRecommendationIds] = useState<string[]>([]);
  const [manualFocusId, setManualFocusId] = useState<string | null>(null);
  const [recommendationNotice, setRecommendationNotice] = useState<string | null>(null);
  const [targetBonusMinutes, setTargetBonusMinutes] = useState(0);
  const activities = controlledActivities ?? localActivities;
  const setActivities = (update: ActivityTimer[] | ((current: ActivityTimer[]) => ActivityTimer[])) => {
    if (onActivitiesChange) {
      onActivitiesChange(update);
      return;
    }
    setLocalActivities(update);
  };
  const focus = useMemo(
    () => chooseFocusActivity(activities, { ignoredIds: ignoredRecommendationIds, preferredId: manualFocusId }),
    [activities, ignoredRecommendationIds, manualFocusId]
  );
  const hasRunningActivity = activities.some((activity) => activity.running);
  const todayTotal = activities.reduce((total, activity) => total + activity.todaySeconds + activity.sessionSeconds, 0);

  useEffect(() => {
    if (onActivitiesChange) return;
    if (!hasRunningActivity) return;
    const interval = window.setInterval(() => {
      setActivities((current) => tickActivities(current));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [hasRunningActivity, onActivitiesChange]);

  useEffect(() => {
    if (onActivitiesChange) return;
    setLocalActivities(track.activities);
  }, [onActivitiesChange, track.activities]);

  useEffect(() => {
    setTargetBonusMinutes(0);
  }, [focus.id]);

  useEffect(() => {
    if (!preferredActivityId || !activities.some((activity) => activity.id === preferredActivityId)) return;
    setManualFocusId(preferredActivityId);
    setIgnoredRecommendationIds([]);
  }, [preferredActivityId]);

  function onToggle(activityId: string) {
    setActivities((current) => {
      const activity = current.find((item) => item.id === activityId);
      if (activity?.running && activity.sessionSeconds > 0) {
        setPendingSession(activity);
        setSessionOutcome("progress");
        setSessionNote("");
        setSessionSaveState("idle");
        setActiveSheet("complete");
      }

      return toggleActivity(current, activityId);
    });
  }

  function onStartFocus(activityId: string) {
    setActivities((current) =>
      current.map((activity) =>
        activity.id === activityId
          ? { ...activity, running: true }
          : { ...activity, running: false }
      )
    );
  }

  function onPauseFocus(activityId: string) {
    setActivities((current) =>
      current.map((activity) =>
        activity.id === activityId ? { ...activity, running: false } : activity
      )
    );
    showRecommendationNotice("Paused");
  }

  function onAddFocusTime() {
    setTargetBonusMinutes((current) => current + 5);
    showRecommendationNotice("+5 minutes");
  }

  function onEndFocus(activityId: string) {
    setActivities((current) => {
      const activity = current.find((item) => item.id === activityId);
      if (activity && activity.sessionSeconds > 0) {
        setPendingSession(activity);
        setSessionOutcome("progress");
        setSessionNote("");
        setSessionSaveState("idle");
        setActiveSheet("complete");
      }

      return current.map((item) =>
        item.id === activityId
          ? {
              ...item,
              todaySeconds: item.todaySeconds + item.sessionSeconds,
              sessionSeconds: 0,
              running: false
            }
          : item
      );
    });
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

    setActivities((current) => [...current, activity]);
    setDetail(activity);
    setNewName("");
    setActiveSheet(null);
  }

  function onNextRecommendation() {
    setManualFocusId(null);
    setIgnoredRecommendationIds((current) => rotateIgnoredIds(current, focus.id, activities));
    showRecommendationNotice("Recommendation changed");
  }

  function onDelayRecommendation() {
    setManualFocusId(null);
    setIgnoredRecommendationIds((current) => addIgnoredId(current, focus.id));
    showRecommendationNotice("Delayed for today");
  }

  function onSkipRecommendation() {
    setManualFocusId(null);
    setIgnoredRecommendationIds((current) => addIgnoredId(current, focus.id));
    showRecommendationNotice("Skipped for today");
  }

  function onChooseActivity(activity: ActivityTimer) {
    setManualFocusId(activity.id);
    setIgnoredRecommendationIds([]);
    setActiveSheet(null);
    showRecommendationNotice("Manual choice");
  }

  function showRecommendationNotice(message: string) {
    setRecommendationNotice(message);
    window.setTimeout(() => setRecommendationNotice(null), 1200);
  }

  function onSaveDetail() {
    if (!detail) return;
    setSavedActivityId(detail.id);
    window.setTimeout(() => setSavedActivityId(null), 1200);
  }

  async function onSaveSession() {
    if (!pendingSession) return;

    const note = buildSessionNote(sessionOutcome, sessionNote);
    setSessionSaveState("saving");
    if (apiBaseUrl) {
      const result = await saveActivitySession({ apiBaseUrl, userId, activity: pendingSession, note });
      if (!result.saved) {
        setSessionSaveState("error");
        return;
      }
    }
    setSavedActivityId(pendingSession.id);
    setPendingSession(null);
    setSessionSaveState("saved");
    setActiveSheet(null);
    onSessionSaved?.();
    window.setTimeout(() => setSavedActivityId(null), 1200);
  }

  return (
    <section className="screen track-screen">
      <header className="screen-header">
        <div className="screen-title">Today</div>
        <IconButton label="Detail" icon="fileText" onClick={() => setDetail(focus)} />
      </header>

      <div className={`track-l1 ${focus.running ? "focus-running" : ""}`} style={{ "--activity-color": focus.color } as CSSProperties}>
        <div className="focus-hero">
          <button className="focus-close" type="button" aria-label="Choose task" onClick={() => setActiveSheet("logs")}>
            <Icon name="x" />
          </button>
          <button className="focus-tool" type="button" aria-label="Task detail" onClick={() => setDetail(focus)}>
            <Icon name="fileText" />
          </button>
          <button className="focus-menu" type="button" aria-label="More focus options" onClick={() => setActiveSheet("logs")}>
            <Icon name="chevronDown" />
          </button>
          <div className="focus-title-card">
            <strong>{focus.name}</strong>
            <span>
              <small>{focus.suggestedMinutes ? `${focus.suggestedMinutes + targetBonusMinutes} min` : `${25 + targetBonusMinutes} min`}</small>
              <small>{focus.energy === "consume" ? "Deep work" : energyLabel(focus.energy)}</small>
            </span>
          </div>
          <img className="focus-character" src={focusCharacterUrl} alt="" aria-hidden="true" />
        </div>

        <div className="recommend-controls" aria-label="Recommendation controls">
          <button type="button" onClick={onNextRecommendation}>Next</button>
          <button type="button" onClick={onDelayRecommendation}>Delay</button>
          <button type="button" onClick={onSkipRecommendation}>Skip</button>
          <button type="button" onClick={() => setActiveSheet("logs")}>Choose</button>
        </div>
        {recommendationNotice ? (
          <div className="recommendation-status" role="status">
            {recommendationNotice}
          </div>
        ) : null}

        <div className="focus-brief" aria-label="Focus setup">
          <div>
            <dt>Suggested</dt>
            <dd>{focus.suggestedMinutes ? `${focus.suggestedMinutes}m` : "25m"}</dd>
          </div>
          <div>
            <dt>Done when</dt>
            <dd>{focus.completionStandard ?? "One clear result is captured."}</dd>
          </div>
        </div>

        <button className="timer-core" aria-label={focus.running ? "Pause" : "Start"} onClick={() => (focus.running ? onPauseFocus(focus.id) : onStartFocus(focus.id))}>
          <span className="timer-clock">{formatClock(focus.sessionSeconds).slice(3)}</span>
          <span className="timer-target">/ {formatTargetClock(focusTargetMinutes(focus, targetBonusMinutes))}</span>
        </button>

        <div className="focus-control-row" aria-label="Focus controls">
          <button className="focus-control" type="button" aria-label={focus.running ? "Pause" : "Start"} onClick={() => (focus.running ? onPauseFocus(focus.id) : onStartFocus(focus.id))}>
            <Icon name={focus.running ? "pause" : "play"} />
            <span>{focus.running ? "Pause" : focus.sessionSeconds > 0 ? "Resume" : "Start"}</span>
          </button>
          <button className="focus-control" type="button" aria-label="Add five minutes" onClick={onAddFocusTime}>
            <Icon name="plus" />
            <span>+5 min</span>
          </button>
          <button className="focus-control end" type="button" aria-label="End focus" onClick={() => onEndFocus(focus.id)} disabled={focus.sessionSeconds === 0}>
            <Icon name="x" />
            <span>End</span>
          </button>
        </div>

        <button className="total-pill" aria-label="Today total" onClick={() => setActiveSheet("logs")}>
          <span />
          {formatDuration(todayTotal)}
        </button>
        {sessionSaveState === "saved" ? (
          <div className="track-save-status" role="status">
            Session recorded
          </div>
        ) : null}
      </div>

      <Sheet
        title="Today"
        open={activeSheet === "logs"}
        onClose={() => setActiveSheet(null)}
        actions={<IconButton label="New" icon="plus" onClick={() => setActiveSheet("create")} />}
      >
        <div className="activity-list">
          {categories.map((category) => (
            <div key={category} className="tracker-category">
              <div className="category-head">
                <span className={`cat-dot ${category.toLowerCase()}`} />
                <span>{category}</span>
              </div>
              {activities
                .filter((activity) => activity.category === category)
                .map((activity) => (
                  <div key={activity.id} className={`activity-row ${activity.running ? "running" : ""}`}>
                    <button className="activity-row-main" onClick={() => onToggle(activity.id)}>
                      <span className="activity-icon" style={{ color: activity.color }}>
                        <Icon name={activityIcon(activity.id)} />
                      </span>
                      <span>
                        <strong>{activity.name}</strong>
                      </span>
                      <strong className={activity.running ? "running-time" : ""}>
                        {activity.running ? `• ${formatClock(activity.sessionSeconds).slice(3)}` : formatDuration(activity.todaySeconds)}
                      </strong>
                    </button>
                    <button
                      className="activity-pick"
                      type="button"
                      aria-label={`Choose ${activity.name}`}
                      onClick={() => onChooseActivity(activity)}
                    >
                      Choose
                    </button>
                    <IconButton label="Detail" icon="info" onClick={() => setDetail(activity)} />
                  </div>
                ))}
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet title="New" open={activeSheet === "create"} onClose={() => setActiveSheet("logs")}>
        <div className="create-body">
          <label className="paper-field">
            <span>Name</span>
            <input type="text" value={newName} aria-label="Activity name" onChange={(event) => setNewName(event.currentTarget.value)} />
          </label>
          <div className="chip-section" aria-label="Category">
            {categories.map((category) => (
              <button
                key={category}
                className={`choice-chip ${newCategory === category ? "selected" : ""}`}
                aria-pressed={newCategory === category}
                onClick={() => setNewCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="chip-section" aria-label="Energy">
            {energyOptions.map((energy) => (
              <button
                key={energy}
                className={`choice-chip ${newEnergy === energy ? "selected" : ""}`}
                aria-pressed={newEnergy === energy}
                onClick={() => setNewEnergy(energy)}
              >
                {energyLabel(energy)}
              </button>
            ))}
          </div>
          <div className="swatch-row" aria-label="Color">
            {colorOptions.map((color) => (
              <button
                key={color.name}
                className={`color-swatch ${color.className} ${newColor === color.value ? "selected" : ""}`}
                aria-label={color.name}
                aria-pressed={newColor === color.value}
                onClick={() => setNewColor(color.value)}
              />
            ))}
          </div>
          <button className="create-action" aria-label="Create activity" onClick={onCreateActivity}>
            <Icon name="plus" />
          </button>
        </div>
      </Sheet>

      {activeSheet === "complete" && pendingSession ? (
        <section className="completion-page" aria-label="Session result">
          <header className="completion-header">
            <button className="completion-back-control" type="button" aria-label="Back" onClick={() => setActiveSheet(null)}>
              <Icon name="chevronLeft" />
            </button>
            <strong>Focus</strong>
            <button className="completion-menu-control" type="button" aria-label="Session options">
              <Icon name="chevronDown" />
            </button>
          </header>

          <div className="completion-body">
            <div className="completion-hero" aria-hidden="true">
              <span className="completion-check">
                <Icon name="check" />
              </span>
              <img className="completion-character" src={focusCharacterUrl} alt="" />
              <span className="completion-confetti one" />
              <span className="completion-confetti two" />
              <span className="completion-confetti three" />
              <span className="completion-confetti four" />
              <span className="completion-confetti five" />
            </div>

            <div className="completion-copy">
              <h2>Focus session completed</h2>
              <p>You made steady progress.</p>
            </div>

            <div className="completion-summary-card">
              <span className="completion-summary-icon">
                <Icon name="timer" />
              </span>
              <div>
                <strong>{pendingSession.name}</strong>
                <span>{formatDuration(pendingSession.sessionSeconds)} · {pendingSession.energy === "consume" ? "Deep work" : energyLabel(pendingSession.energy)}</span>
              </div>
              <button
                className="completion-edit-control"
                type="button"
                aria-label="Edit session task"
                onClick={() => {
                  setDetail(pendingSession);
                  setActiveSheet(null);
                }}
              >
                <Icon name="fileText" />
              </button>
            </div>

            <div className="completion-outcomes" aria-label="Session outcome">
              {sessionOutcomes.map((outcome) => (
                <button
                  key={outcome.id}
                  className={`completion-outcome ${sessionOutcome === outcome.id ? "selected" : ""}`}
                  type="button"
                  aria-pressed={sessionOutcome === outcome.id}
                  onClick={() => setSessionOutcome(outcome.id)}
                >
                  <Icon name={outcome.icon} />
                  <span>{outcome.label}</span>
                </button>
              ))}
            </div>

            <label className="completion-note-field">
              <span>Result note</span>
              <textarea
                rows={3}
                value={sessionNote}
                aria-label="Result note"
                placeholder="Add a note about what happened..."
                onChange={(event) => setSessionNote(event.currentTarget.value)}
              />
            </label>

            {sessionSaveState === "error" ? (
              <div className="session-error" role="alert">
                Session could not be saved.
              </div>
            ) : null}

            <button className="completion-save-action" type="button" onClick={onSaveSession}>
              {sessionSaveState === "saving" ? "Saving" : "Save result"}
            </button>
          </div>
        </section>
      ) : null}

      <DetailPanel title={detail?.name ?? "Activity"} open={detail !== null} onBack={() => setDetail(null)}>
        {detail ? (
          <div className="detail-stack">
            <span className={`status-chip energy-${detail.energy}`}>{detail.energy}</span>
            <dl className="evidence-list">
              <div>
                <dt>Today</dt>
                <dd>{formatDuration(detail.todaySeconds + detail.sessionSeconds)}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{detail.category}</dd>
              </div>
              <div>
                <dt>Energy</dt>
                <dd>{detail.energy}</dd>
              </div>
            </dl>
            <label className="note-field">
              <span>Note</span>
              <textarea rows={3} defaultValue="Built the app-first tracker prototype and checked the tab timing flow." />
            </label>
            <button className="paper-action" onClick={onSaveDetail}>
              {savedActivityId === detail.id ? "Saved" : "Save"}
            </button>
          </div>
        ) : null}
      </DetailPanel>
    </section>
  );
}

function recommendationLine(activity: ActivityTimer): string {
  const minutes = activity.suggestedMinutes ? `${activity.suggestedMinutes}m` : "25m";
  return `Recommended now · ${minutes}`;
}

function focusTargetMinutes(activity: ActivityTimer, bonusMinutes: number): number {
  return (activity.suggestedMinutes ?? 25) + bonusMinutes;
}

function formatTargetClock(minutes: number): string {
  return `${String(minutes).padStart(2, "0")}:00`;
}

function buildSessionNote(outcome: SessionOutcome, note: string): string {
  const trimmed = note.trim();
  const label = sessionOutcomes.find((item) => item.id === outcome)?.label ?? "Progress";
  return trimmed ? `${label}: ${trimmed}` : label;
}

function addIgnoredId(current: string[], activityId: string): string[] {
  return current.includes(activityId) ? current : [...current, activityId];
}

function rotateIgnoredIds(current: string[], activityId: string, activities: ActivityTimer[]): string[] {
  const next = addIgnoredId(current, activityId);
  return next.length >= activities.length ? [] : next;
}

function energyLabel(energy: ActivityTimer["energy"]): string {
  if (energy === "consume") return "Consume";
  if (energy === "restore") return "Restore";
  return "Neutral";
}

function activityIcon(activityId: string): IconName {
  if (activityId === "frontend") return "code";
  if (activityId === "backend") return "briefcase";
  if (activityId === "walk") return "leaf";
  return "book";
}
