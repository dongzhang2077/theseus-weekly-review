export interface ReviewWeekRange {
  start: string;
  end: string;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function weekContainingDate(value: string): ReviewWeekRange | null {
  if (!isoDatePattern.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;

  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return { start, end: date.toISOString().slice(0, 10) };
}

export function shiftReviewWeek(range: ReviewWeekRange, weeks: number): ReviewWeekRange {
  return {
    start: shiftIsoDate(range.start, weeks * 7),
    end: shiftIsoDate(range.end, weeks * 7)
  };
}

export function formatReviewWeek(range: ReviewWeekRange): string {
  return `${formatMonthDay(range.start)} - ${formatMonthDay(range.end)}`;
}

function shiftIsoDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMonthDay(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}
