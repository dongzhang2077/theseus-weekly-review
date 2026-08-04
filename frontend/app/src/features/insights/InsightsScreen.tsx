import { useEffect, useMemo, useState } from "react";
import type {
  AppReviewItem,
  AppSignalAction,
  AppSignalEvidence,
  AppWeekViewModel,
} from "../../shared/api/weeklyReview";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import { StateSurface } from "../../shared/components/StateSurface";
import { Icon } from "../../shared/icons/Icon";
import { ReviewDetailPage } from "../review/ReviewScreen";
import {
  formatReviewWeek,
  shiftReviewWeek,
  weekContainingDate,
  type ReviewWeekRange,
} from "../review/reviewWeek";
import {
  PrioritySignalCard,
  SignalEvidencePage,
  SignalIssueRow,
  SignalSummaryPage,
} from "../signals/SignalsScreen";
import { selectSignalIssues } from "../signals/signalModel";

type InsightsSheet = "wins" | "other" | "steady" | "review";
type SignalDetailLevel = "summary" | "evidence";

interface InsightsScreenProps {
  review: AppWeekViewModel["review"] | null;
  signals: AppWeekViewModel["signals"] | null;
  weekRange: ReviewWeekRange;
  accountToday: string;
  hasTimeLogs: boolean;
  onWeekChange: (range: ReviewWeekRange) => void;
  onGenerate: () => void;
  onAction: (action: AppSignalAction) => void;
  onTrack: () => void;
  onDetailOpenChange?: (open: boolean) => void;
}

export function InsightsScreen({
  review,
  signals,
  weekRange,
  accountToday,
  hasTimeLogs,
  onWeekChange,
  onGenerate,
  onAction,
  onTrack,
  onDetailOpenChange,
}: InsightsScreenProps) {
  const issues = useMemo(
    () => selectSignalIssues(signals?.evidence ?? []),
    [signals?.evidence]
  );
  const steady = useMemo(
    () => (signals?.evidence ?? []).filter((row) => row.severity === "normal"),
    [signals?.evidence]
  );
  const [sheet, setSheet] = useState<InsightsSheet | null>(null);
  const [reviewDetail, setReviewDetail] = useState<AppReviewItem | null>(null);
  const [signalDetail, setSignalDetail] = useState<AppSignalEvidence | null>(null);
  const [signalDetailLevel, setSignalDetailLevel] = useState<SignalDetailLevel>("summary");

  useEffect(() => {
    onDetailOpenChange?.(reviewDetail !== null || signalDetail !== null);
  }, [onDetailOpenChange, reviewDetail, signalDetail]);

  useEffect(() => () => onDetailOpenChange?.(false), [onDetailOpenChange]);

  function openSignalDetail(signal: AppSignalEvidence) {
    setSheet(null);
    setSignalDetail(signal);
    setSignalDetailLevel("summary");
  }

  function closeSignalDetail() {
    setSignalDetail(null);
    setSignalDetailLevel("summary");
  }

  function openReviewDetail(item: AppReviewItem) {
    setSheet(null);
    setReviewDetail(item);
  }

  if (reviewDetail) {
    return (
      <ReviewDetailPage
        item={reviewDetail}
        weekLabel={formatReviewWeek(weekRange)}
        onBack={() => {
          setReviewDetail(null);
          setSheet("wins");
        }}
        onAction={onAction}
      />
    );
  }

  if (signalDetail) {
    return signalDetailLevel === "summary" ? (
      <SignalSummaryPage
        evidence={signalDetail}
        weekLabel={formatReviewWeek(weekRange)}
        onBack={closeSignalDetail}
        onEvidence={() => setSignalDetailLevel("evidence")}
        onAction={onAction}
      />
    ) : (
      <SignalEvidencePage
        evidence={signalDetail}
        weekLabel={formatReviewWeek(weekRange)}
        onBack={() => setSignalDetailLevel("summary")}
      />
    );
  }

  return (
    <section className="h-full overflow-y-auto bg-desk-paper pb-5 font-work text-desk-ink">
      <h1 className="sr-only">Insights</h1>
      <InsightsWeekHeader
        weekRange={weekRange}
        accountToday={accountToday}
        onWeekChange={(range) => {
          setSheet(null);
          onWeekChange(range);
        }}
      />

      {!review ? (
        <div className="h-[calc(100%-76px)]">
          <StateSurface
            icon={hasTimeLogs ? "book" : "calendar"}
            title={hasTimeLogs ? "Review not created" : "No week evidence"}
            actionLabel={hasTimeLogs ? "Generate" : "Open Today"}
            actionIcon={hasTimeLogs ? "book" : "timer"}
            onAction={hasTimeLogs ? onGenerate : onTrack}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[400px] space-y-4 px-4 py-4">
          <section
            className="rounded-paper border border-desk-line bg-desk-raised px-4 py-3 shadow-paper"
            aria-label="Week insight status"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-desk-muted">
              {issues.length > 0 ? "Needs attention" : "Steady"}
            </p>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <strong className="text-sm text-desk-ink">
                {review.wins.length} {review.wins.length === 1 ? "win" : "wins"}
              </strong>
              <strong className={issues.length > 0 ? "text-sm text-desk-danger" : "text-sm text-desk-accent"}>
                {issues.length} {issues.length === 1 ? "risk" : "risks"}
              </strong>
            </div>
          </section>

          {issues.length > 0 ? (
            <section className="space-y-2" aria-labelledby="insights-priority-title">
              <h2
                id="insights-priority-title"
                className="text-xs font-bold uppercase tracking-[0.14em] text-desk-muted"
              >
                Priority
              </h2>
              <PrioritySignalCard
                issue={issues[0]}
                onAction={onAction}
                onDetails={() => openSignalDetail(issues[0])}
              />
            </section>
          ) : null}

          <section
            className="overflow-hidden rounded-paper border border-desk-line bg-desk-raised shadow-paper"
            aria-label="Insight collections"
          >
            <CollectionRow
              label="Wins"
              count={review.wins.length}
              onClick={() => setSheet("wins")}
            />
            <CollectionRow
              label="Other issues"
              count={Math.max(0, issues.length - 1)}
              onClick={() => setSheet("other")}
            />
            <CollectionRow
              label="Steady checks"
              count={steady.length}
              onClick={() => setSheet("steady")}
            />
            <CollectionRow label="Weekly review" onClick={() => setSheet("review")} />
          </section>
        </div>
      )}

      <Sheet title={sheetTitle(sheet)} open={sheet !== null} onClose={() => setSheet(null)}>
        {sheet === "wins" ? (
          review && review.wins.length > 0 ? (
            <div className="space-y-1">
              {review.wins.map((win) => (
                <ReviewRow key={win.id} item={win} onClick={() => openReviewDetail(win)} />
              ))}
            </div>
          ) : <EmptyCollection title="No wins" />
        ) : null}
        {sheet === "other" ? (
          issues.length > 1 ? (
            <div className="overflow-hidden rounded-paper border border-desk-line bg-desk-raised">
              {issues.slice(1).map((issue) => (
                <SignalIssueRow
                  key={issue.id}
                  issue={issue}
                  onDetails={() => openSignalDetail(issue)}
                />
              ))}
            </div>
          ) : <EmptyCollection title="No other issues" />
        ) : null}
        {sheet === "steady" ? (
          steady.length > 0 ? (
            <div className="overflow-hidden rounded-paper border border-desk-line bg-desk-raised">
              {steady.map((check) => (
                <SignalIssueRow
                  key={check.id}
                  issue={check}
                  onDetails={() => openSignalDetail(check)}
                />
              ))}
            </div>
          ) : <EmptyCollection title="No steady checks" />
        ) : null}
        {sheet === "review" ? (
          review ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-desk-muted">
                {formatReviewWeek(weekRange)}
              </p>
              <div className="space-y-3 text-sm leading-6 text-desk-ink">
                {review.narrative.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ) : <EmptyCollection title="No weekly review" />
        ) : null}
      </Sheet>
    </section>
  );
}

function InsightsWeekHeader({
  weekRange,
  accountToday,
  onWeekChange,
}: {
  weekRange: ReviewWeekRange;
  accountToday: string;
  onWeekChange: (range: ReviewWeekRange) => void;
}) {
  const currentWeek = weekContainingDate(accountToday);
  const isCurrent = currentWeek?.start === weekRange.start;
  const nextDisabled = currentWeek ? weekRange.start >= currentWeek.start : false;

  return (
    <header className="sticky top-0 z-10 border-b border-desk-line bg-desk-raised/95 px-3 py-2 backdrop-blur-sm">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center">
        <IconButton
          label="Previous week"
          icon="chevronLeft"
          onClick={() => onWeekChange(shiftReviewWeek(weekRange, -1))}
        />
        <label className="relative flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-paper px-2 text-sm font-bold focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-desk-ink">
          <span>{formatReviewWeek(weekRange)}</span>
          <Icon name="calendar" className="size-4 text-desk-muted" />
          <input
            className="absolute inset-0 cursor-pointer opacity-0"
            type="date"
            aria-label="Choose insights week"
            value={weekRange.start}
            max={currentWeek?.start}
            onChange={(event) => {
              const selected = weekContainingDate(event.target.value);
              if (selected && (!currentWeek || selected.start <= currentWeek.start)) {
                onWeekChange(selected);
              }
            }}
          />
        </label>
        <IconButton
          label="Next week"
          icon="chevronRight"
          disabled={nextDisabled}
          onClick={() => onWeekChange(shiftReviewWeek(weekRange, 1))}
        />
      </div>
      {!isCurrent && currentWeek ? (
        <div className="flex justify-center">
          <button
            type="button"
            className="min-h-7 rounded-full px-3 text-xs font-semibold text-desk-accent hover:bg-desk-accent-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink"
            onClick={() => onWeekChange(currentWeek)}
          >
            This week
          </button>
        </div>
      ) : null}
    </header>
  );
}

function CollectionRow({
  label,
  count,
  onClick,
}: {
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-desk-line px-4 text-left last:border-b-0 hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-desk-ink"
      aria-label={`Open ${label}`}
      onClick={onClick}
    >
      <strong className="min-w-0 text-sm text-desk-ink">{label}</strong>
      {count !== undefined ? (
        <span className="text-sm tabular-nums text-desk-muted">{count}</span>
      ) : null}
      <Icon name="chevronRight" className="size-4 text-desk-subtle" />
    </button>
  );
}

function ReviewRow({
  item,
  onClick,
}: {
  item: AppReviewItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-paper px-3 text-left hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-desk-ink"
      onClick={onClick}
    >
      <strong className="min-w-0 whitespace-normal text-sm leading-5 text-desk-ink">
        {item.title}
      </strong>
      <Icon name="chevronRight" className="size-4 shrink-0 text-desk-subtle" />
    </button>
  );
}

function EmptyCollection({ title }: { title: string }) {
  return <p className="py-8 text-center text-sm text-desk-muted">{title}</p>;
}

function sheetTitle(sheet: InsightsSheet | null): string {
  if (sheet === "wins") return "Wins";
  if (sheet === "other") return "Other issues";
  if (sheet === "steady") return "Steady checks";
  return "Weekly review";
}
