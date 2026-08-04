import type { TimeDaySummary, TimeWeekSummary } from "./timeAggregation";
import { timeChartColor } from "./timeChartPalette";
import { formatEvidenceDate, formatRecordedDuration } from "./timeFormat";

interface WeekBarsProps {
  summary: TimeWeekSummary;
  onOpenDay: (day: TimeDaySummary) => void;
}

export function WeekBars({ summary, onOpenDay }: WeekBarsProps) {
  const maximumSeconds = Math.max(1, ...summary.days.map((day) => day.totalSeconds));

  return (
    <section
      className="rounded-paper border border-desk-line bg-desk-raised p-4 shadow-paper"
      aria-labelledby="recorded-time-by-day-title"
    >
      <header>
        <h2 id="recorded-time-by-day-title" className="text-base font-semibold text-desk-ink">
          Recorded time by day
        </h2>
        <p className="mt-0.5 text-sm text-desk-muted">
          {formatRecordedDuration(summary.totalSeconds)}
        </p>
      </header>
      <p className="sr-only">
        {summary.days
          .map((day) =>
            day.status === "unavailable"
              ? `${formatEvidenceDate(day.date, { weekday: true })}: unavailable`
              : `${formatEvidenceDate(day.date, { weekday: true })}: ${formatRecordedDuration(day.totalSeconds)}`
          )
          .join(". ")}
      </p>

      <div className="mt-4 grid grid-cols-7 gap-1" aria-label="Week time records">
        {summary.days.map((day) => (
          <DayBar
            key={day.date}
            day={day}
            maximumSeconds={maximumSeconds}
            onOpen={() => onOpenDay(day)}
          />
        ))}
      </div>
    </section>
  );
}

function DayBar({
  day,
  maximumSeconds,
  onOpen,
}: {
  day: TimeDaySummary;
  maximumSeconds: number;
  onOpen: () => void;
}) {
  const weekday = formatEvidenceDate(day.date, { weekday: true }).split(",")[0];
  const barHeight = day.totalSeconds > 0
    ? Math.max(8, Math.round((day.totalSeconds / maximumSeconds) * 104))
    : 2;
  const visual = (
    <>
      <span className="flex h-28 w-full items-end justify-center" aria-hidden="true">
        {day.status === "unavailable" ? (
          <span className="mb-1 h-px w-5 bg-desk-line" />
        ) : (
          <span
            className="flex w-5 flex-col-reverse overflow-hidden rounded-t"
            style={{ height: `${barHeight}px` }}
          >
            {day.buckets.map((bucket) => (
              <span
                key={bucket.key}
                style={{
                  backgroundColor: timeChartColor(bucket.key),
                  flexGrow: bucket.seconds,
                }}
              />
            ))}
            {day.buckets.length === 0 ? <span className="h-0.5 bg-desk-subtle" /> : null}
          </span>
        )}
      </span>
      <span className="text-xs font-medium text-desk-muted">{weekday}</span>
    </>
  );

  if (day.status === "unavailable") {
    return (
      <div
        className="flex min-w-0 flex-col items-center opacity-60"
        aria-label={`${formatEvidenceDate(day.date, { weekday: true })}, unavailable`}
      >
        {visual}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex min-h-40 min-w-11 flex-col items-center rounded-lg hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink"
      aria-label={`Open ${formatEvidenceDate(day.date, { weekday: true })} time records, ${formatRecordedDuration(day.totalSeconds)}`}
      onClick={onOpen}
    >
      {visual}
    </button>
  );
}
