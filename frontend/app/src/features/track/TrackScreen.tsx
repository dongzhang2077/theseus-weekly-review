import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import { chooseFocusActivity, formatClock, formatDuration, tickActivities, toggleActivity, type ActivityTimer } from "./timerModel";

const initialActivities: ActivityTimer[] = [
  {
    id: "frontend",
    name: "Frontend build",
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

export function TrackScreen() {
  const [activities, setActivities] = useState(initialActivities);
  const [sheetOpen, setSheetOpen] = useState(false);
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
        <IconButton label="Log" icon="book" onClick={() => setSheetOpen(true)} />
      </header>

      <div className="timer-focus" style={{ "--activity-color": focus.color } as CSSProperties}>
        <button className="timer-orb" aria-label={focus.running ? "Pause" : "Start"} onClick={() => onToggle(focus.id)}>
          <Icon name={focus.running ? "pause" : "timer"} />
        </button>
        <div className="timer-clock">{formatClock(focus.sessionSeconds)}</div>
        <button className="timer-toggle" aria-label={focus.running ? "Pause" : "Start"} onClick={() => onToggle(focus.id)}>
          <Icon name={focus.running ? "pause" : "play"} />
        </button>
      </div>

      <button className={`activity-card ${focus.running ? "running" : ""}`} onClick={() => onToggle(focus.id)}>
        <span className="activity-dot" style={{ background: focus.color }} />
        <span>
          <strong>{focus.name}</strong>
          <small>{focus.category}</small>
        </span>
        <strong>{formatDuration(focus.todaySeconds + focus.sessionSeconds)}</strong>
      </button>

      <button className="total-pill" aria-label="Today total" onClick={() => setSheetOpen(true)}>
        <span />
        {formatDuration(todayTotal)}
      </button>

      <Sheet title="Today" open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="activity-list">
          {activities.map((activity) => (
            <div key={activity.id} className={`activity-row ${activity.running ? "running" : ""}`}>
              <button className="activity-row-main" onClick={() => onToggle(activity.id)}>
                <span className="activity-icon" style={{ color: activity.color }}>
                  <Icon name="activity" />
                </span>
                <span>
                  <strong>{activity.name}</strong>
                  <small>{activity.category}</small>
                </span>
                <strong>{formatDuration(activity.todaySeconds + activity.sessionSeconds)}</strong>
              </button>
              <IconButton label="Detail" icon="info" onClick={() => setDetail(activity)} />
            </div>
          ))}
        </div>
      </Sheet>

      <DetailPanel title={detail?.name ?? "Activity"} open={detail !== null} onBack={() => setDetail(null)}>
        {detail ? (
          <div className="detail-stack">
            <span className="status-chip">{detail.energy}</span>
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
              <textarea rows={3} placeholder="What happened?" />
            </label>
            <button className="paper-action">Save</button>
          </div>
        ) : null}
      </DetailPanel>
    </section>
  );
}
