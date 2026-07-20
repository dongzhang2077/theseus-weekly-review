import { Icon, type IconName } from "../../shared/icons/Icon";
import type { ActivityTimer } from "../../shared/domain/track";
import { formatCompactClock, formatDuration } from "./timerModel";

interface FocusWorkspaceProps {
  focus: ActivityTimer;
  targetMinutes: number | null;
  todayTotalSeconds: number;
  notice: string | null;
  recommendationLocked: boolean;
  timerLocked: boolean;
  onNext: () => void;
  onDelay: () => void;
  onSkip: () => void;
  onChoose: () => void;
  onOpenSetup: () => void;
  onStart: () => void;
  onPause: () => void;
  onEnd: () => void;
  onOpenToday: () => void;
}

export function FocusWorkspace({
  focus,
  targetMinutes,
  todayTotalSeconds,
  notice,
  recommendationLocked,
  timerLocked,
  onNext,
  onDelay,
  onSkip,
  onChoose,
  onOpenSetup,
  onStart,
  onPause,
  onEnd,
  onOpenToday
}: FocusWorkspaceProps) {
  const hasSession = focus.sessionSeconds > 0;
  const stateLabel = focus.running ? "Focus running" : hasSession ? "Session paused" : "Ready to focus";
  const actionLabel = focus.running ? "Pause focus" : hasSession ? "Resume focus" : "Start focus activity";
  const targetSeconds = targetMinutes ? targetMinutes * 60 : null;
  const progress = targetSeconds ? Math.min(100, (focus.sessionSeconds / targetSeconds) * 100) : 0;
  const context = focus.focusContext;
  const reason = context?.reason;

  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col px-4 pb-6 pt-4">
      <section
        className="rounded-[18px] border border-desk-line bg-desk-raised p-4 shadow-paper"
        aria-label="Current focus"
      >
        <div className="flex items-start gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-paper bg-desk-accent-soft text-desk-accent"
            aria-hidden="true"
          >
            <Icon name={activityIcon(focus.id)} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-desk-accent">
                {focus.running ? "In focus" : focus.recommended ? "Recommended" : "Selected"}
              </span>
              {context?.priority ? (
                <span className="rounded-full bg-desk-sunk px-2 py-1 text-[11px] font-bold text-desk-muted">
                  Priority {context.priority}
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 text-[20px] font-bold leading-tight text-desk-ink">{focus.name}</h2>
            {reason ? <p className="mt-1.5 text-sm leading-5 text-desk-muted">{reason}</p> : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-desk-line pt-3 text-xs font-semibold text-desk-muted">
          {focus.projectTitle ? <span>{focus.projectTitle}</span> : <span>{focus.category}</span>}
          {context?.plannedMinutes !== undefined ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{context.plannedMinutes} min planned this week</span>
            </>
          ) : null}
        </div>
      </section>

      <div className="mt-2 grid grid-cols-4 gap-1" aria-label="Recommendation controls">
        <RecommendationButton label="Next" disabled={recommendationLocked} onClick={onNext} />
        <RecommendationButton label="Delay" disabled={recommendationLocked} onClick={onDelay} />
        <RecommendationButton label="Skip" disabled={recommendationLocked} onClick={onSkip} />
        <RecommendationButton label="Choose" disabled={recommendationLocked} onClick={onChoose} />
      </div>

      <section className="flex flex-col items-center pb-5 pt-7 text-center" aria-label="Focus timer">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-desk-muted">{stateLabel}</span>
        <div className="mt-3 tabular-nums text-[64px] font-semibold leading-none tracking-[-0.055em] text-desk-ink">
          {formatCompactClock(focus.sessionSeconds)}
        </div>
        <button
          className="mt-3 min-h-9 rounded-full border border-desk-line bg-desk-raised px-3 text-xs font-bold text-desk-muted hover:bg-desk-sunk disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={recommendationLocked}
          onClick={onOpenSetup}
        >
          {targetMinutes ? `Session target · ${targetMinutes} min` : "Open-ended session"}
        </button>

        <div
          className="mt-6 grid size-[92px] place-items-center rounded-full p-[4px]"
          style={{
            background: targetSeconds
              ? `conic-gradient(#6f8f6b ${progress}%, #e2dccf ${progress}% 100%)`
              : "#e2dccf"
          }}
        >
          <button
            className="grid size-[82px] place-items-center rounded-full border-4 border-desk-paper bg-desk-accent text-white shadow-paper transition-transform duration-150 active:scale-95 disabled:cursor-not-allowed disabled:bg-desk-subtle disabled:active:scale-100"
            type="button"
            aria-label={actionLabel}
            disabled={timerLocked}
            onClick={focus.running ? onPause : onStart}
          >
            <Icon name={focus.running ? "pause" : "play"} className="size-8" />
          </button>
        </div>

        <span className="mt-2 text-sm font-bold text-desk-ink">
          {focus.running ? "Pause" : hasSession ? "Resume" : "Start"}
        </span>
        <button
          className="mt-3 min-h-9 rounded-full border-0 bg-transparent px-4 text-sm font-bold text-desk-danger hover:bg-desk-danger-soft disabled:cursor-not-allowed disabled:text-desk-subtle"
          type="button"
          aria-label="End focus"
          disabled={!hasSession || timerLocked}
          onClick={onEnd}
        >
          End session
        </button>
      </section>

      <button
        className="flex min-h-12 items-center justify-between rounded-paper border border-desk-line bg-desk-raised px-3 text-left shadow-paper disabled:cursor-not-allowed disabled:opacity-55"
        type="button"
        aria-label="Open today's activity list"
        disabled={recommendationLocked}
        onClick={onOpenToday}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-desk-muted">
          <span
            className={`size-2 rounded-full ${focus.running ? "bg-desk-accent" : "bg-desk-subtle"}`}
            aria-hidden="true"
          />
          Today total
        </span>
        <strong className="tabular-nums text-desk-ink">{formatDuration(todayTotalSeconds)}</strong>
      </button>

      <div className="min-h-10 pt-2" aria-live="polite">
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

function RecommendationButton({
  label,
  disabled,
  onClick
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="min-h-10 rounded-paper border-0 bg-transparent px-1 text-xs font-bold text-desk-muted hover:bg-desk-sunk hover:text-desk-ink disabled:cursor-not-allowed disabled:text-desk-subtle"
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function activityIcon(activityId: string): IconName {
  if (activityId === "frontend") return "code";
  if (activityId === "backend") return "briefcase";
  if (activityId === "walk") return "leaf";
  return "book";
}
