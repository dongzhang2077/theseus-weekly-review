import { Icon } from "../../shared/icons/Icon";
import type { ProjectTimeBucket, TimeRangeSummary } from "./timeAggregation";
import { collapseProjectBuckets } from "./timeAggregation";
import { timeChartColor } from "./timeChartPalette";
import { formatRecordedDuration } from "./timeFormat";

interface TimeDonutProps {
  summary: TimeRangeSummary;
  onOpenBucket: (bucket: ProjectTimeBucket) => void;
  onOpenAll: () => void;
}

export function TimeDonut({ summary, onOpenBucket, onOpenAll }: TimeDonutProps) {
  const buckets = collapseProjectBuckets(summary.buckets);
  let offset = 0;

  return (
    <section
      className="rounded-paper border border-desk-line bg-desk-raised p-4 shadow-paper"
      aria-labelledby="time-by-project-title"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="time-by-project-title" className="text-base font-semibold text-desk-ink">
            Time by project
          </h2>
          <p className="mt-0.5 text-sm text-desk-muted">
            {formatRecordedDuration(summary.totalSeconds)}
          </p>
        </div>
        <button
          type="button"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-desk-muted hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-desk-ink"
          aria-label="Open all time records"
          onClick={onOpenAll}
        >
          <Icon name="fileText" className="h-5 w-5" />
        </button>
      </header>

      {summary.totalSeconds === 0 ? (
        <div className="flex min-h-44 items-center justify-center">
          <p className="text-sm text-desk-muted">No recorded time</p>
        </div>
      ) : (
        <>
          <p className="sr-only">
            {`Recorded time totals ${formatRecordedDuration(summary.totalSeconds)} across ${summary.buckets.length} projects or categories.`}
          </p>
          <div className="mt-4 grid grid-cols-[8.75rem_minmax(0,1fr)] items-center gap-4">
            <div className="relative h-36 w-36" aria-hidden="true">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 42 42">
                <circle
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  stroke="#eee9df"
                  strokeWidth="6"
                />
                {buckets.map((bucket) => {
                  const dashOffset = -offset;
                  offset += bucket.percentage;
                  return (
                    <circle
                      key={bucket.key}
                      cx="21"
                      cy="21"
                      r="15.9155"
                      fill="none"
                      pathLength="100"
                      stroke={timeChartColor(bucket.key)}
                      strokeDasharray={`${bucket.percentage} ${100 - bucket.percentage}`}
                      strokeDashoffset={dashOffset}
                      strokeWidth="6"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <span className="max-w-20 text-sm font-semibold leading-tight text-desk-ink">
                  {formatRecordedDuration(summary.totalSeconds)}
                </span>
              </div>
            </div>

            <div className="min-w-0 space-y-1">
              {buckets.map((bucket) => (
                <button
                  type="button"
                  key={bucket.key}
                  className="grid min-h-11 w-full grid-cols-[0.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1.5 text-left hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink"
                  aria-label={`Open ${bucket.title} time records, ${formatRecordedDuration(bucket.seconds)}, ${bucket.percentage}%`}
                  onClick={() => onOpenBucket(bucket)}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: timeChartColor(bucket.key) }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 whitespace-normal text-sm leading-tight text-desk-ink">
                    {bucket.title}
                  </span>
                  <span className="text-xs tabular-nums text-desk-muted">
                    {bucket.percentage}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
