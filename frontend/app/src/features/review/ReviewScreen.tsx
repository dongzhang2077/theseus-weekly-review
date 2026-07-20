import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import { StateSurface } from "../../shared/components/StateSurface";
import type { AppReviewItem, AppSignalAction, AppWeekViewModel } from "../../shared/api/weeklyReview";
import {
  formatReviewWeek,
  shiftReviewWeek,
  weekContainingDate,
  type ReviewWeekRange
} from "./reviewWeek";

const characterAttentionUrl = new URL("../../assets/character-attention.png", import.meta.url).href;

type ReviewSheet = "wins" | "risks" | "full";

interface ReviewScreenProps {
  review: AppWeekViewModel["review"] | null;
  weekRange: ReviewWeekRange;
  onWeekChange: (range: ReviewWeekRange) => void;
  onPlan: () => void;
  onAction: (action: AppSignalAction) => void;
  onDetailOpenChange?: (open: boolean) => void;
}

export function ReviewScreen({
  review,
  weekRange,
  onWeekChange,
  onPlan,
  onAction,
  onDetailOpenChange
}: ReviewScreenProps) {
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [sheet, setSheet] = useState<ReviewSheet | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [detailOrigin, setDetailOrigin] = useState<ReviewSheet | null>(null);
  const reviewDetails = useMemo(
    () => [...(review?.wins ?? []), ...(review?.risks ?? [])].reduce<Record<string, AppReviewItem>>((byId, item) => {
      byId[item.id] = item;
      return byId;
    }, {}),
    [review]
  );
  const selectedDetail = detail ? reviewDetails[detail] ?? null : null;

  useEffect(() => {
    onDetailOpenChange?.(selectedDetail !== null);
  }, [onDetailOpenChange, selectedDetail]);

  useEffect(() => () => onDetailOpenChange?.(false), [onDetailOpenChange]);

  function openDetail(itemId: string, origin: ReviewSheet) {
    setDetailOrigin(origin);
    setSheet(null);
    setDetail(itemId);
  }

  function closeDetail() {
    setDetail(null);
    setSheet(detailOrigin);
    setDetailOrigin(null);
  }

  if (selectedDetail) {
    return (
      <ReviewDetailPage
        item={selectedDetail}
        weekLabel={formatReviewWeek(weekRange)}
        onBack={closeDetail}
        onAction={onAction}
      />
    );
  }

  return (
    <section className="screen review-screen">
      <ReviewWeekHeader weekRange={weekRange} onWeekChange={onWeekChange} />

      {!review ? (
        <div className="h-[calc(100%-52px)]">
          <StateSurface
            icon="calendar"
            title="No review for this week"
            actionLabel="Create a plan"
            actionIcon="calendar"
            onAction={onPlan}
          />
        </div>
      ) : (
        <>
          <div className="review-cover">
            <div className="review-paper">
              <div className="review-status">{review.status}</div>
              <button className="character-button" aria-label="Week status summary" onClick={() => setBubbleOpen((open) => !open)}>
                <img src={characterAttentionUrl} alt={review.characterAlt} />
              </button>
              {bubbleOpen ? <div className="speech-bubble">{review.bubble}</div> : null}
              <div className="review-chapters" aria-label="Review chapters">
                <button className="chapter-button chapter-wins" aria-label="Wins" onClick={() => setSheet("wins")}>
                  <Icon name="sketchWin" />
                </button>
                <button className="chapter-button chapter-risks priority" aria-label="Risks" onClick={() => setSheet("risks")}>
                  <Icon name="sketchRisk" />
                </button>
                <button className="chapter-button chapter-full" aria-label="Full review" onClick={() => setSheet("full")}>
                  <Icon name="sketchReview" />
                </button>
              </div>
            </div>
          </div>

          <div className="rhythm-pill" aria-label="Week rhythm">
            {review.rhythm.map((state, index) => (
              <span key={index} className={state === "amber" ? "soft" : undefined} />
            ))}
          </div>

          <Sheet title={sheetTitle(sheet)} open={sheet !== null} onClose={() => setSheet(null)}>
            {sheet === "wins" ? (
              review.wins.length > 0 ? (
                <div className="sheet-list">
                  {review.wins.map((win) => (
                    <button key={win.id} className="list-row" onClick={() => openDetail(win.id, "wins")}>
                      <span><strong>{win.title}</strong></span>
                      <span className="row-dot green" />
                    </button>
                  ))}
                </div>
              ) : <EmptyReviewList label="No wins were generated for this week." />
            ) : null}
            {sheet === "risks" ? (
              review.risks.length > 0 ? (
                <div className="sheet-list">
                  {review.risks.map((risk) => (
                    <button key={risk.id} className="list-row" onClick={() => openDetail(risk.id, "risks")}>
                      <span>
                        <strong>{risk.title}</strong>
                        <small>{risk.severity}</small>
                      </span>
                      <span className={`row-dot ${risk.severity === "severe" ? "red" : "amber"}`} />
                    </button>
                  ))}
                </div>
              ) : <EmptyReviewList label="No risks were generated for this week." />
            ) : null}
            {sheet === "full" ? (
              <div className="review-narrative">
                {review.narrative.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <button className="paper-action" onClick={onPlan}>Open plan</button>
              </div>
            ) : null}
          </Sheet>
        </>
      )}
    </section>
  );
}

function ReviewWeekHeader({
  weekRange,
  onWeekChange
}: {
  weekRange: ReviewWeekRange;
  onWeekChange: (range: ReviewWeekRange) => void;
}) {
  return (
    <header className="screen-header">
      <IconButton
        label="Previous week"
        icon="chevronLeft"
        onClick={() => onWeekChange(shiftReviewWeek(weekRange, -1))}
      />
      <label className="relative col-start-2 flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-paper px-2 text-[17px] font-bold leading-[22px] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-desk-accent">
        <span>{formatReviewWeek(weekRange)}</span>
        <Icon name="calendar" className="size-4 text-desk-muted" />
        <input
          className="absolute inset-0 cursor-pointer opacity-0"
          type="date"
          aria-label="Choose review week"
          value={weekRange.start}
          onChange={(event) => {
            const selectedWeek = weekContainingDate(event.target.value);
            if (selectedWeek) onWeekChange(selectedWeek);
          }}
        />
      </label>
      <IconButton
        label="Next week"
        icon="chevronRight"
        onClick={() => onWeekChange(shiftReviewWeek(weekRange, 1))}
      />
    </header>
  );
}

function ReviewDetailPage({
  item,
  weekLabel,
  onBack,
  onAction
}: {
  item: AppReviewItem;
  weekLabel: string;
  onBack: () => void;
  onAction: (action: AppSignalAction) => void;
}) {
  return (
    <section className="screen h-full bg-desk-paper" aria-label={item.title}>
      <header className="screen-header">
        <IconButton label="Back" icon="chevronLeft" onClick={onBack} />
        <div className="screen-title truncate px-2">{item.title}</div>
      </header>
      <div className="grid gap-5 px-1 py-6">
        {item.severity ? (
          <span className={`status-chip severity-${item.severity}`}>{item.severity}</span>
        ) : null}
        <section className="grid gap-3 rounded-paper border border-desk-line bg-desk-raised p-4" aria-labelledby="review-evidence-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="review-evidence-title" className="m-0 text-base font-bold">Evidence</h2>
            <span className="text-xs font-semibold text-desk-muted">{weekLabel}</span>
          </div>
          <dl className="evidence-list">
            {item.evidence.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        {item.action ? (
          <button className="paper-action" onClick={() => onAction(item.action as AppSignalAction)}>
            {item.action.label}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function EmptyReviewList({ label }: { label: string }) {
  return <p className="m-0 py-6 text-center text-sm text-desk-muted">{label}</p>;
}

function sheetTitle(sheet: ReviewSheet | null): string {
  if (sheet === "wins") return "Wins";
  if (sheet === "risks") return "Risks";
  return "Review";
}
