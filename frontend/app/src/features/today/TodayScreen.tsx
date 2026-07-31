import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import {
  applyFocusSession,
  createIdempotencyKey,
  endFocusSession,
  loadOpenFocusSessions,
  startFocusSession,
} from "../../shared/api/focusSessions";
import type { ApiTimeLogRead } from "../../shared/api/timeLogs";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import { Sheet } from "../../shared/components/Sheet";
import { Icon } from "../../shared/icons/Icon";
import type { ActivityTimer, FocusSessionDraft } from "../../shared/domain/track";
import type { PlanProject } from "../../shared/domain/plan";
import { TrackScreen } from "../track/TrackScreen";
import {
  chooseFocusActivity,
  completeActivity,
  currentRunSeconds,
  formatLiveClock,
} from "../track/timerModel";
import { TimeDonut } from "./TimeDonut";
import { TimeEvidenceSheet } from "./TimeEvidenceSheet";
import { WeekBars } from "./WeekBars";
import {
  aggregateProjectTime,
  aggregateTimeWeek,
  type ProjectTimeBucket,
  type TimeDaySummary,
} from "./timeAggregation";
import { formatEvidenceDate, formatRecordedDuration } from "./timeFormat";

type TodayMode = "day" | "week";

interface EvidenceSelection {
  title: string;
  recordIds: number[];
}

interface TodayScreenProps {
  apiBaseUrl: string;
  timeZone: string;
  todayDate: string;
  fetchImpl: FetchLike;
  track: AppWeekViewModel["track"];
  activities: ActivityTimer[];
  projects: PlanProject[];
  timeLogs: ApiTimeLogRead[];
  historyError?: string | null;
  onRetryHistory: () => void;
  onActivitiesChange: Dispatch<SetStateAction<ActivityTimer[]>>;
  onTimeLogsChange: Dispatch<SetStateAction<ApiTimeLogRead[]>>;
  sessionDrafts: Record<string, FocusSessionDraft>;
  onSessionDraftChange: (activityId: string, draft: FocusSessionDraft | null) => void;
  onResultModalChange: (open: boolean) => void;
  onSessionSaved: () => void;
  foregroundActivityId: string | null;
  onForegroundActivityChange: (activityId: string | null) => void;
  onTrackerOpenChange: (open: boolean) => void;
}

export function TodayScreen({
  apiBaseUrl,
  timeZone,
  todayDate,
  fetchImpl,
  track,
  activities,
  projects,
  timeLogs,
  historyError,
  onRetryHistory,
  onActivitiesChange,
  onTimeLogsChange,
  sessionDrafts,
  onSessionDraftChange,
  onResultModalChange,
  onSessionSaved,
  foregroundActivityId,
  onForegroundActivityChange,
  onTrackerOpenChange,
}: TodayScreenProps) {
  const [mode, setMode] = useState<TodayMode>("day");
  const [selectedDay, setSelectedDay] = useState(todayDate);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfIsoWeek(todayDate));
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [runningOpen, setRunningOpen] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceSelection | null>(null);
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  const [focusError, setFocusError] = useState<string | null>(null);
  const currentWeekStart = startOfIsoWeek(todayDate);
  const focus = useMemo(
    () => chooseFocusActivity(activities, { preferredId: foregroundActivityId }),
    [activities, foregroundActivityId]
  );
  const runningActivities = activities.filter((activity) => activity.running);
  const daySummary = useMemo(
    () => aggregateProjectTime(timeLogs, projects, { start: selectedDay, end: selectedDay }),
    [projects, selectedDay, timeLogs]
  );
  const weekSummary = useMemo(
    () => aggregateTimeWeek(timeLogs, projects, selectedWeekStart, todayDate),
    [projects, selectedWeekStart, timeLogs, todayDate]
  );

  useEffect(() => {
    if (selectedDay > todayDate) setSelectedDay(todayDate);
    if (selectedWeekStart > currentWeekStart) setSelectedWeekStart(currentWeekStart);
  }, [currentWeekStart, selectedDay, selectedWeekStart, todayDate]);

  useEffect(() => {
    onTrackerOpenChange(trackerOpen);
    return () => {
      if (trackerOpen) onTrackerOpenChange(false);
    };
  }, [onTrackerOpenChange, trackerOpen]);

  function openTracker() {
    setRunningOpen(false);
    setTrackerOpen(true);
  }

  function openEvidence(selection: EvidenceSelection) {
    setEvidence(selection);
  }

  function openBucket(bucket: ProjectTimeBucket) {
    openEvidence({
      title: `${bucket.title} · ${formatEvidenceDate(selectedDay)}`,
      recordIds: bucket.recordIds,
    });
  }

  function openDay(day: TimeDaySummary) {
    openEvidence({
      title: `${formatEvidenceDate(day.date, { weekday: true })} time records`,
      recordIds: day.recordIds,
    });
  }

  async function toggleActivity(activity: ActivityTimer) {
    if (pendingActivityId !== null) return;
    setFocusError(null);
    onForegroundActivityChange(activity.id);

    if (!activity.activityId) {
      openTracker();
      return;
    }

    setPendingActivityId(activity.id);
    if (activity.running) {
      const ended = await endPersistedActivity(activity);
      setPendingActivityId(null);
      if (ended) onSessionSaved();
      return;
    }

    const result = await startFocusSession({
      apiBaseUrl,
      fetchImpl,
      activityId: activity.activityId,
      ...(activity.taskId ? { taskId: activity.taskId } : {}),
      idempotencyKey: createIdempotencyKey("start"),
    });
    if (result.status === "ok" && result.data) {
      const startedSession = result.data;
      onActivitiesChange((current) =>
        current.map((item) =>
          item.activityId === activity.activityId
            ? applyFocusSession(item, startedSession, timeZone)
            : item
        )
      );
      setPendingActivityId(null);
      return;
    }

    if (result.code === "activity_already_open") {
      const open = await loadOpenFocusSessions({ apiBaseUrl, fetchImpl });
      const running = open.data?.find((session) => session.activity_id === activity.activityId);
      if (running) {
        onActivitiesChange((current) =>
          current.map((item) =>
            item.activityId === activity.activityId
              ? applyFocusSession(item, running, timeZone)
              : item
          )
        );
        setPendingActivityId(null);
        return;
      }
    }

    setFocusError(result.error ?? "Focus could not start");
    setPendingActivityId(null);
  }

  async function endPersistedActivity(activity: ActivityTimer): Promise<boolean> {
    if (!activity.focusSessionId || !activity.focusSessionVersion) {
      setFocusError("Reload Focus before ending this session");
      return false;
    }
    const result = await endFocusSession({
      apiBaseUrl,
      fetchImpl,
      sessionId: activity.focusSessionId,
      expectedVersion: activity.focusSessionVersion,
      idempotencyKey: createIdempotencyKey("end"),
    });
    if (result.status !== "ok" || !result.data) {
      setFocusError(result.error ?? "Focus could not end");
      return false;
    }
    const completed = result.data.session;
    const completedTimeLogs = result.data.time_logs;
    onActivitiesChange((current) =>
      completeActivity(
        current.map((item) =>
          item.id === activity.id
            ? { ...item, sessionSeconds: completed.accumulated_seconds }
            : item
        ),
        activity.id,
        todayDate
      )
    );
    onTimeLogsChange((current) => mergeTimeLogs(current, completedTimeLogs));
    return true;
  }

  if (trackerOpen) {
    return (
      <TrackScreen
        apiBaseUrl={apiBaseUrl}
        timeZone={timeZone}
        todayDate={todayDate}
        fetchImpl={fetchImpl}
        track={track}
        activities={activities}
        timeLogs={timeLogs}
        projects={projects}
        onActivitiesChange={onActivitiesChange}
        onTimeLogsChange={onTimeLogsChange}
        sessionDrafts={sessionDrafts}
        onSessionDraftChange={onSessionDraftChange}
        onResultModalChange={onResultModalChange}
        onSessionSaved={onSessionSaved}
        onBack={() => setTrackerOpen(false)}
        foregroundActivityId={foregroundActivityId}
        onForegroundActivityChange={onForegroundActivityChange}
      />
    );
  }

  const summary = mode === "day" ? daySummary : weekSummary;
  const selectedRangeIsCurrent = mode === "day"
    ? selectedDay === todayDate
    : selectedWeekStart === currentWeekStart;
  const periodLabel = mode === "day"
    ? formatEvidenceDate(selectedDay, { weekday: true })
    : formatWeekRange(selectedWeekStart);

  return (
    <section className="h-full overflow-y-auto bg-desk-paper pb-5 font-work text-desk-ink">
      <header className="sticky top-0 z-10 border-b border-desk-line bg-desk-raised/95 px-4 pb-3 pt-3 backdrop-blur-sm">
        <h1 className="text-center text-[17px] font-bold">Today</h1>
        <div className="mt-3 grid grid-cols-2 rounded-xl bg-desk-sunk p-1" aria-label="Time range">
          {(["day", "week"] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={`min-h-11 rounded-lg text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink ${
                mode === item
                  ? "bg-desk-raised text-desk-ink shadow-paper"
                  : "text-desk-muted"
              }`}
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
            >
              {item === "day" ? "Day" : "Week"}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[400px] space-y-4 px-4 pt-4">
        <section aria-labelledby="now-title">
          <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
            <h2 id="now-title" className="text-xs font-bold tracking-[0.14em] text-desk-muted">
              NOW
            </h2>
            {runningActivities.length >= 2 ? (
              <button
                type="button"
                className="min-h-8 rounded-full bg-desk-accent-soft px-3 text-xs font-semibold text-desk-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-desk-ink"
                onClick={() => setRunningOpen(true)}
              >
                {runningActivities.length} running
              </button>
            ) : null}
          </div>
          {focus ? (
            <div className="grid grid-cols-[minmax(0,1fr)_3rem] overflow-hidden rounded-paper border border-desk-line bg-desk-raised shadow-paper">
              <button
                type="button"
                className="min-h-[68px] min-w-0 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-desk-ink"
                aria-label={`Open Focus tracker for ${focus.name}`}
                onClick={openTracker}
              >
                <span className="block whitespace-normal text-sm font-semibold leading-snug text-desk-ink">
                  {focus.name}
                </span>
                <span className="mt-1 block whitespace-normal text-xs text-desk-muted">
                  {focus.projectTitle ?? focus.category} · {focus.running ? "Focus" : "Ready"}
                </span>
              </button>
              <button
                type="button"
                className="grid min-h-[68px] min-w-12 place-items-center border-l border-desk-line text-desk-ink focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-desk-ink disabled:cursor-wait disabled:opacity-45"
                aria-label={focus.running ? `End ${focus.name}` : `Start ${focus.name}`}
                disabled={pendingActivityId !== null}
                onClick={() => void toggleActivity(focus)}
              >
                <Icon name={focus.running ? "stop" : "play"} className="h-5 w-5" />
              </button>
              <div className="col-span-2 flex items-center justify-between border-t border-desk-line px-4 py-2 text-xs">
                <span className="text-desk-muted">Current focus</span>
                <span className="font-semibold tabular-nums text-desk-ink">
                  {focus.running ? formatLiveClock(currentRunSeconds(focus)) : "00:00"}
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="flex min-h-[68px] w-full items-center justify-between rounded-paper border border-desk-line bg-desk-raised px-4 text-left shadow-paper"
              onClick={openTracker}
            >
              <span>
                <strong className="block text-sm">Choose an Activity</strong>
                <span className="mt-1 block text-xs text-desk-muted">Nothing selected</span>
              </span>
              <Icon name="chevronRight" className="h-5 w-5 text-desk-muted" />
            </button>
          )}
          {focusError ? (
            <p role="status" className="mt-2 rounded-lg bg-desk-danger-soft px-3 py-2 text-sm text-desk-ink">
              {focusError}
            </p>
          ) : null}
        </section>

        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink"
            aria-label={`Previous ${mode}`}
            onClick={() => {
              if (mode === "day") setSelectedDay((value) => addIsoDays(value, -1));
              else setSelectedWeekStart((value) => addIsoDays(value, -7));
            }}
          >
            <Icon name="chevronLeft" className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-desk-ink">{periodLabel}</p>
            {!selectedRangeIsCurrent ? (
              <button
                type="button"
                className="mt-1 min-h-8 rounded-full px-3 text-xs font-semibold text-desk-accent hover:bg-desk-accent-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink"
                onClick={() => {
                  setSelectedDay(todayDate);
                  setSelectedWeekStart(currentWeekStart);
                }}
              >
                {mode === "day" ? "Today" : "This week"}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Next ${mode}`}
            disabled={selectedRangeIsCurrent}
            onClick={() => {
              if (mode === "day") setSelectedDay((value) => addIsoDays(value, 1));
              else setSelectedWeekStart((value) => addIsoDays(value, 7));
            }}
          >
            <Icon name="chevronRight" className="h-5 w-5" />
          </button>
        </div>

        {historyError ? (
          <section className="rounded-paper border border-desk-line bg-desk-raised p-4">
            <h2 className="text-sm font-semibold">Time summary could not load</h2>
            <button
              type="button"
              className="mt-3 min-h-11 rounded-full bg-desk-accent-soft px-4 text-sm font-semibold text-desk-ink"
              onClick={onRetryHistory}
            >
              Retry
            </button>
          </section>
        ) : mode === "day" ? (
          <>
            <TimeDonut
              summary={daySummary}
              onOpenBucket={openBucket}
              onOpenAll={() =>
                openEvidence({
                  title: `${formatEvidenceDate(selectedDay, { weekday: true })} time records`,
                  recordIds: daySummary.recordIds,
                })
              }
            />
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between rounded-paper border border-desk-line bg-desk-raised px-4 text-left shadow-paper focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink"
              onClick={() =>
                openEvidence({
                  title: `${formatEvidenceDate(selectedDay, { weekday: true })} time records`,
                  recordIds: daySummary.recordIds,
                })
              }
            >
              <span>
                <strong className="block whitespace-normal text-sm">
                  {selectedDay === todayDate
                    ? "Today timeline"
                    : `${formatEvidenceDate(selectedDay, { weekday: true })} timeline`}
                </strong>
                <span className="mt-1 block text-xs text-desk-muted">
                  {daySummary.recordIds.length} {daySummary.recordIds.length === 1 ? "record" : "records"}
                </span>
              </span>
              <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-desk-muted" />
            </button>
          </>
        ) : (
          <>
            <WeekBars summary={weekSummary} onOpenDay={openDay} />
            {weekSummary.buckets.length > 0 ? (
              <TimeDonut
                summary={weekSummary}
                onOpenBucket={(bucket) =>
                  openEvidence({
                    title: `${bucket.title} · ${formatWeekRange(selectedWeekStart)}`,
                    recordIds: bucket.recordIds,
                  })
                }
                onOpenAll={() =>
                  openEvidence({
                    title: `${formatWeekRange(selectedWeekStart)} time records`,
                    recordIds: summary.recordIds,
                  })
                }
              />
            ) : null}
          </>
        )}
      </div>

      <TimeEvidenceSheet
        open={evidence !== null}
        title={evidence?.title ?? "Time records"}
        recordIds={evidence?.recordIds ?? []}
        logs={timeLogs}
        projects={projects}
        onClose={() => setEvidence(null)}
      />

      <Sheet title="Running Activities" open={runningOpen} onClose={() => setRunningOpen(false)}>
        <div className="space-y-2">
          {runningActivities.length === 0 ? (
            <p className="py-6 text-center text-sm text-desk-muted">No running Activities</p>
          ) : (
            runningActivities.map((activity) => (
              <div
                key={activity.id}
                className="grid grid-cols-[minmax(0,1fr)_3rem] overflow-hidden rounded-paper border border-desk-line bg-desk-raised"
              >
                <button
                  type="button"
                  className="min-h-14 min-w-0 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-desk-ink"
                  aria-pressed={activity.id === focus?.id}
                  onClick={() => {
                    onForegroundActivityChange(activity.id);
                    setRunningOpen(false);
                  }}
                >
                  <strong className="block whitespace-normal text-sm leading-snug">
                    {activity.name}
                  </strong>
                  <span className="mt-1 block text-xs tabular-nums text-desk-muted">
                    {formatLiveClock(currentRunSeconds(activity))}
                    {activity.id === focus?.id ? " · foreground" : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="grid min-h-14 min-w-12 place-items-center border-l border-desk-line focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-desk-ink disabled:opacity-40"
                  aria-label={`End ${activity.name}`}
                  disabled={pendingActivityId !== null}
                  onClick={() => void toggleActivity(activity)}
                >
                  <Icon name="stop" className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-between rounded-paper px-3 text-left text-sm font-semibold hover:bg-desk-sunk"
            onClick={openTracker}
          >
            Choose another Activity
            <Icon name="plus" className="h-5 w-5" />
          </button>
        </div>
      </Sheet>
    </section>
  );
}

function mergeTimeLogs(current: ApiTimeLogRead[], incoming: ApiTimeLogRead[]): ApiTimeLogRead[] {
  const byId = new Map(current.map((record) => [record.id, record]));
  for (const record of incoming) {
    if (record.deleted_at === null) byId.set(record.id, record);
    else byId.delete(record.id);
  }
  return [...byId.values()].sort(
    (left, right) =>
      left.date.localeCompare(right.date)
      || (left.start_time ?? "").localeCompare(right.start_time ?? "")
      || left.id - right.id
  );
}

function startOfIsoWeek(value: string): string {
  const date = parseIsoDate(value);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function addIsoDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatWeekRange(weekStart: string): string {
  return `${formatEvidenceDate(weekStart)} – ${formatEvidenceDate(addIsoDays(weekStart, 6))}`;
}
