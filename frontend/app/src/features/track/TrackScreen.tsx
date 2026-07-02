import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import type { IconName } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import { chooseFocusActivity, formatClock, formatDuration, tickActivities, toggleActivity, type ActivityTimer } from "./timerModel";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import { saveActivitySession } from "../../shared/api/timeLogs";

const categories = ["Project", "Study", "Health"];
const energyOptions = ["consume", "restore", "neutral"] as const;
const colorOptions = [
  { name: "Green", value: "#6f8f6b", className: "green" },
  { name: "Blue", value: "#8aa9c0", className: "blue" },
  { name: "Amber", value: "#c8a25f", className: "amber" },
  { name: "Pink", value: "#d69a9a", className: "pink" }
];
type TrackSheet = "logs" | "create";

interface TrackScreenProps {
  track: AppWeekViewModel["track"];
  apiBaseUrl?: string;
}

export function TrackScreen({ apiBaseUrl, track }: TrackScreenProps) {
  const [activities, setActivities] = useState(track.activities);
  const [activeSheet, setActiveSheet] = useState<TrackSheet | null>(null);
  const [detail, setDetail] = useState<ActivityTimer | null>(null);
  const [newName, setNewName] = useState("Design polish block");
  const [newCategory, setNewCategory] = useState("Project");
  const [newEnergy, setNewEnergy] = useState<ActivityTimer["energy"]>("consume");
  const [newColor, setNewColor] = useState(colorOptions[0].value);
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null);
  const focus = useMemo(() => chooseFocusActivity(activities), [activities]);
  const hasRunningActivity = activities.some((activity) => activity.running);
  const todayTotal = activities.reduce((total, activity) => total + activity.todaySeconds + activity.sessionSeconds, 0);

  useEffect(() => {
    if (!hasRunningActivity) return;
    const interval = window.setInterval(() => {
      setActivities((current) => tickActivities(current));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [hasRunningActivity]);

  useEffect(() => {
    setActivities(track.activities);
  }, [track.activities]);

  function onToggle(activityId: string) {
    setActivities((current) => {
      const activity = current.find((item) => item.id === activityId);
      if (activity?.running && apiBaseUrl) {
        void saveActivitySession({ apiBaseUrl, activity });
      }

      return toggleActivity(current, activityId);
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

  function onSaveDetail() {
    if (!detail) return;
    setSavedActivityId(detail.id);
    window.setTimeout(() => setSavedActivityId(null), 1200);
  }

  return (
    <section className="screen track-screen">
      <header className="screen-header">
        <div className="screen-title">Today</div>
        <IconButton label="Detail" icon="fileText" onClick={() => setDetail(focus)} />
      </header>

      <div className="track-l1" style={{ "--activity-color": focus.color } as CSSProperties}>
        <button className={`recommended-activity ${focus.running ? "running" : ""}`} aria-label="Start recommended activity" onClick={() => onToggle(focus.id)}>
          <span className="recommend-mark">
            <Icon name={activityIcon(focus.id)} />
          </span>
          <span className="recommend-copy">
            <strong>{focus.name}</strong>
            <small>{focus.running ? "Running" : "Recommended now"}</small>
          </span>
        </button>

        <button className="timer-core" aria-label={focus.running ? "Pause" : "Start"} onClick={() => onToggle(focus.id)}>
          <span className="timer-clock">{formatClock(focus.sessionSeconds)}</span>
        </button>

        <button className="timer-toggle" aria-label={focus.running ? "Pause" : "Start"} onClick={() => onToggle(focus.id)}>
          <Icon name={focus.running ? "pause" : "play"} />
        </button>

        <button className="total-pill" aria-label="Today total" onClick={() => setActiveSheet("logs")}>
          <span />
          {formatDuration(todayTotal)}
        </button>
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
