import type { KeyboardEvent } from "react";
import { Icon } from "../../shared/icons/Icon";
import type {
  MonthIntensity,
  TimeMonthDaySummary,
  TimeMonthSummary,
} from "./timeAggregation";
import { formatEvidenceDate, formatRecordedDuration } from "./timeFormat";

interface MonthHeatmapProps {
  summary: TimeMonthSummary;
  selectedDate: string | null;
  onOpenDay: (day: TimeMonthDaySummary) => void;
  onOpenAll: () => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function MonthHeatmap({
  summary,
  selectedDate,
  onOpenDay,
  onOpenAll,
}: MonthHeatmapProps) {
  const leadingBlanks = mondayIndex(summary.range.start);

  return (
    <section
      className="rounded-paper border border-desk-line bg-desk-raised p-3 shadow-paper"
      aria-labelledby="recorded-time-intensity-title"
    >
      <header className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2
            id="recorded-time-intensity-title"
            className="text-base font-semibold text-desk-ink"
          >
            Recorded time intensity
          </h2>
          <p className="mt-0.5 text-sm text-desk-muted">
            {formatRecordedDuration(summary.totalSeconds)}
          </p>
        </div>
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-full text-desk-muted hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-desk-ink"
          aria-label="View monthly recorded time data"
          onClick={onOpenAll}
        >
          <Icon name="fileText" className="h-5 w-5" />
        </button>
      </header>

      {summary.hasEnoughDensity ? (
        <>
          <p className="sr-only">
            {summary.days
              .map((day) =>
                day.status === "unavailable"
                  ? `${formatEvidenceDate(day.date)}: unavailable`
                  : `${formatEvidenceDate(day.date)}: ${formatRecordedDuration(day.totalSeconds)}, ${day.intensity} intensity`
              )
              .join(". ")}
          </p>
          <div
            className="mt-4 grid grid-cols-7 gap-0.5 text-center"
            aria-hidden="true"
          >
            {WEEKDAYS.map((weekday, index) => (
              <span key={`${weekday}-${index}`} className="py-1 text-[11px] font-semibold text-desk-muted">
                {weekday}
              </span>
            ))}
          </div>
          <div
            className="grid grid-cols-7 gap-0.5"
            aria-label="Monthly recorded time calendar"
          >
            {Array.from({ length: leadingBlanks }, (_, index) => (
              <span key={`blank-${index}`} aria-hidden="true" />
            ))}
            {summary.days.map((day) => (
              <MonthDay
                key={day.date}
                day={day}
                selected={day.date === selectedDate}
                onOpen={() => onOpenDay(day)}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 px-1 text-xs text-desk-muted min-[360px]:grid-cols-4">
            <Legend intensity="none" label="None" />
            <Legend intensity="low" label="Low <2h" />
            <Legend intensity="medium" label="Med 2–6h" />
            <Legend intensity="high" label="High 6h+" />
          </div>
        </>
      ) : (
        <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center">
          <h3 className="text-sm font-semibold text-desk-ink">More days are needed</h3>
          <p className="mt-1 max-w-56 text-sm text-desk-muted">
            Record time on 7 days to show a monthly pattern.
          </p>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-desk-line px-1 pt-3">
        <div>
          <dt className="text-xs text-desk-muted">Active days</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-desk-ink">
            {summary.activeDayCount}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-desk-muted">Daily average</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-desk-ink">
            {formatRecordedDuration(summary.averageActiveDaySeconds)}
          </dd>
        </div>
      </dl>

      {selectedDate ? (
        <p className="mt-3 border-t border-desk-line px-1 pt-3 text-sm text-desk-muted">
          Selected · <span className="font-medium text-desk-ink">{formatEvidenceDate(selectedDate)}</span>
        </p>
      ) : null}
    </section>
  );
}

function MonthDay({
  day,
  selected,
  onOpen,
}: {
  day: TimeMonthDaySummary;
  selected: boolean;
  onOpen: () => void;
}) {
  const dayNumber = Number(day.date.slice(-2));
  if (day.status === "unavailable") {
    return (
      <span
        className="grid min-h-10 place-items-center rounded-lg text-xs text-desk-subtle opacity-45"
        aria-label={`${formatEvidenceDate(day.date)}, unavailable`}
      >
        {dayNumber}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`relative grid min-h-10 min-w-0 place-items-center overflow-hidden rounded-lg border text-xs font-semibold tabular-nums focus-visible:z-[1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink ${intensityClass(day.intensity)} ${
        selected ? "ring-2 ring-desk-ink ring-offset-1 ring-offset-desk-raised" : ""
      }`}
      aria-label={`Open ${formatEvidenceDate(day.date, { weekday: true })} time records, ${formatRecordedDuration(day.totalSeconds)}, ${day.intensity} intensity`}
      aria-pressed={selected}
      onClick={onOpen}
      onKeyDown={moveCalendarFocus}
    >
      <span>{dayNumber}</span>
      <span
        className={`absolute inset-x-1 bottom-1 rounded-full ${intensityMarkClass(day.intensity)}`}
        aria-hidden="true"
      />
    </button>
  );
}

function Legend({ intensity, label }: { intensity: MonthIntensity; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span
        className={`relative size-3.5 shrink-0 overflow-hidden rounded border ${intensityClass(intensity)}`}
        aria-hidden="true"
      >
        <span className={`absolute inset-x-0.5 bottom-0.5 rounded-full ${intensityMarkClass(intensity)}`} />
      </span>
      {label}
    </span>
  );
}

function intensityClass(intensity: MonthIntensity): string {
  if (intensity === "high") return "border-[#9eb398] bg-[#c9d8c4] text-desk-ink";
  if (intensity === "medium") return "border-[#bdccb8] bg-[#e0e9dc] text-desk-ink";
  if (intensity === "low") return "border-[#d1dccd] bg-[#eff3ed] text-desk-ink";
  return "border-desk-line bg-desk-sunk text-desk-muted";
}

function intensityMarkClass(intensity: MonthIntensity): string {
  if (intensity === "high") return "h-1.5 bg-desk-accent";
  if (intensity === "medium") return "h-1 bg-desk-accent";
  if (intensity === "low") return "h-0.5 bg-desk-accent";
  return "h-px bg-desk-line";
}

function mondayIndex(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

function moveCalendarFocus(event: KeyboardEvent<HTMLButtonElement>) {
  const step = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  }[event.key];
  if (step === undefined && event.key !== "Home" && event.key !== "End") return;
  const calendar = event.currentTarget.parentElement;
  if (!calendar) return;
  const buttons = Array.from(calendar.querySelectorAll<HTMLButtonElement>("button"));
  const currentIndex = buttons.indexOf(event.currentTarget);
  const targetIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? buttons.length - 1
      : Math.min(buttons.length - 1, Math.max(0, currentIndex + (step ?? 0)));
  event.preventDefault();
  buttons[targetIndex]?.focus();
}
