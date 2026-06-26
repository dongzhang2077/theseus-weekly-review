import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import type { IconName } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import { chooseFocusActivity, formatClock, formatDuration, tickActivities, toggleActivity, type ActivityTimer } from "./timerModel";

const initialActivities: ActivityTimer[] = [
  {
    id: "frontend",
    name: "Frontend build block",
    category: "Project",
    energy: "consume",
    color: "#6f8f6b",
    todaySeconds: 42 * 60,
    sessionSeconds: 0,
    running: false,
    recommended: true
  },
  {
    id: "backend",
    name: "Backend polish",
    category: "Project",
    energy: "consume",
    color: "#8aa9c0",
    todaySeconds: 24 * 60,
    sessionSeconds: 0,
    running: false
  },
  {
    id: "research",
    name: "Research notes",
    category: "Study",
    energy: "neutral",
    color: "#c8a25f",
    todaySeconds: 55 * 60,
    sessionSeconds: 0,
    running: false
  },
  {
    id: "walk",
    name: "Health walk",
    category: "Health",
    energy: "restore",
    color: "#7f9f85",
    todaySeconds: 45 * 60,
    sessionSeconds: 0,
    running: false
  }
];

const categories = ["Project", "Study", "Health"];
type TrackSheet = "logs" | "create";

export function TrackScreen() {
  const [activities, setActivities] = useState(initialActivities);
  const [activeSheet, setActiveSheet] = useState<TrackSheet | null>(null);
  const [detail, setDetail] = useState<ActivityTimer | null>(null);
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

  function onToggle(activityId: string) {
    setActivities((current) => toggleActivity(current, activityId));
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
            <input type="text" defaultValue="Design polish block" aria-label="Activity name" />
          </label>
          <div className="chip-section" aria-label="Category">
            <button className="choice-chip selected" aria-pressed="true">Project</button>
            <button className="choice-chip" aria-pressed="false">Study</button>
            <button className="choice-chip" aria-pressed="false">Health</button>
          </div>
          <div className="chip-section" aria-label="Energy">
            <button className="choice-chip selected" aria-pressed="true">Consume</button>
            <button className="choice-chip" aria-pressed="false">Restore</button>
            <button className="choice-chip" aria-pressed="false">Neutral</button>
          </div>
          <div className="swatch-row" aria-label="Color">
            <button className="color-swatch green selected" aria-label="Green" />
            <button className="color-swatch blue" aria-label="Blue" />
            <button className="color-swatch amber" aria-label="Amber" />
            <button className="color-swatch pink" aria-label="Pink" />
          </div>
          <button className="create-action" aria-label="Create activity" onClick={() => setActiveSheet("logs")}>
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
            <button className="paper-action">Save</button>
          </div>
        ) : null}
      </DetailPanel>
    </section>
  );
}

function activityIcon(activityId: string): IconName {
  if (activityId === "frontend") return "code";
  if (activityId === "backend") return "briefcase";
  if (activityId === "walk") return "leaf";
  return "book";
}
