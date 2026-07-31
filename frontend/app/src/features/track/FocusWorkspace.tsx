import { Icon, type IconName } from "../../shared/icons/Icon";
import type { ActivityTimer } from "../../shared/domain/track";
import { currentRunSeconds, formatClock, formatDuration } from "./timerModel";

interface FocusWorkspaceProps {
  focus: ActivityTimer;
  targetMinutes: number | null;
  todayTotalSeconds: number;
  runningCount: number;
  notice: string | null;
  timerLocked: boolean;
  onToggle: () => void;
  onChooseActivity: () => void;
  onOpenToday: () => void;
}

export function FocusWorkspace({
  focus,
  targetMinutes,
  todayTotalSeconds,
  runningCount,
  notice,
  timerLocked,
  onToggle,
  onChooseActivity,
  onOpenToday
}: FocusWorkspaceProps) {
  const actionLabel = focus.running
    ? "End focus activity"
    : "Start focus activity";
  const meta = focus.running
    ? `${focus.category}${runningCount > 1 ? ` · ${runningCount} running` : ""}`
    : focus.recommended
      ? "Recommended now"
      : focus.projectTitle ?? focus.category;
  const softColor = activitySoftColor(focus.color);
  const targetSeconds = targetMinutes === null ? null : targetMinutes * 60;
  const targetDelta = targetSeconds === null ? null : targetSeconds - focus.sessionSeconds;
  const timerText = targetDelta === null
    ? formatClock(currentRunSeconds(focus))
    : targetDelta >= 0
      ? formatClock(targetDelta)
      : `+${formatClock(Math.abs(targetDelta))}`;

  return (
    <div
      className="relative mx-auto flex h-[calc(100%-52px)] min-h-[520px] w-full max-w-[400px] flex-col items-center justify-center gap-5 px-5 py-8"
      role="region"
      aria-label="Current focus"
    >
      <button
        className="grid min-h-[58px] w-full max-w-[292px] grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-[18px] border px-3 py-2 text-left shadow-[0_4px_14px_rgb(76_62_38/0.05)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: focus.color, backgroundColor: softColor }}
        type="button"
        aria-label="Change focus activity"
        disabled={timerLocked}
        onClick={onChooseActivity}
      >
        <span
          className="grid size-9 place-items-center rounded-full border border-desk-line bg-desk-raised/75"
          style={{ color: focus.color }}
          aria-hidden="true"
        >
          <Icon name={activityIcon(focus.id)} className="size-5" />
        </span>
        <span className="min-w-0">
          <strong className="block break-words text-sm font-bold leading-5 text-desk-ink">
            {focus.name}
          </strong>
          <small className="block text-xs font-semibold text-desk-muted">{meta}</small>
        </span>
      </button>

      <div
        className="flex min-h-[132px] w-full max-w-[340px] flex-col items-center justify-center gap-3"
        role="timer"
        aria-label={`Current focus duration ${timerText}`}
      >
        <span
          className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${
            focus.running ? "w-16" : "w-10"
          }`}
          style={{ backgroundColor: focus.running ? focus.color : "rgba(150,155,145,0.28)" }}
          aria-hidden="true"
        />
        <span className="tabular-nums text-[60px] font-bold leading-[1.05] tracking-[-0.035em] text-desk-ink min-[390px]:text-[68px]">
          {timerText}
        </span>
      </div>

      <button
        className="grid size-[76px] place-items-center rounded-full border shadow-[0_7px_20px_rgb(76_62_38/0.08)] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: focus.color, backgroundColor: softColor, color: focus.color }}
        type="button"
        aria-label={actionLabel}
        disabled={timerLocked}
        onClick={onToggle}
      >
        <Icon name={focus.running ? "stop" : "play"} className="size-7" />
      </button>

      <button
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-desk-line bg-desk-raised/75 px-4 text-sm font-semibold text-desk-muted shadow-[0_3px_12px_rgb(76_62_38/0.04)]"
        type="button"
        aria-label="Open Today history"
        onClick={onOpenToday}
      >
        <span className="size-2 rounded-full" style={{ backgroundColor: focus.color }} aria-hidden="true" />
        <span>Today total</span>
        <strong className="tabular-nums text-desk-ink">{formatDuration(todayTotalSeconds)}</strong>
      </button>

      <div className="absolute inset-x-5 bottom-3 min-h-9" aria-live="polite">
        {notice ? (
          <div
            className="rounded-paper bg-desk-accent-soft px-3 py-2 text-center text-sm font-semibold text-desk-accent"
            role="status"
          >
            {notice}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function activitySoftColor(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}1f` : "rgba(231,240,227,0.74)";
}

function activityIcon(activityId: string): IconName {
  if (activityId === "frontend") return "code";
  if (activityId === "backend") return "briefcase";
  if (activityId === "walk") return "leaf";
  return "book";
}
