import { useState } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import type { AppReviewItem, AppWeekViewModel } from "../../shared/api/weeklyReview";

const characterAttentionUrl = new URL("../../assets/character-attention.png", import.meta.url).href;

type ReviewSheet = "wins" | "risks" | "full";
type ReviewDetail = string | null;

interface ReviewScreenProps {
  review: AppWeekViewModel["review"];
  onPlan: () => void;
}

export function ReviewScreen({ review, onPlan }: ReviewScreenProps) {
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [sheet, setSheet] = useState<ReviewSheet | null>(null);
  const [detail, setDetail] = useState<ReviewDetail>(null);
  const reviewDetails = [...review.wins, ...review.risks].reduce<Record<string, AppReviewItem>>((byId, item) => {
    byId[item.id] = item;
    return byId;
  }, {});

  return (
    <section className="screen review-screen">
      <header className="screen-header">
        <IconButton label="Previous" icon="chevronLeft" />
        <div className="screen-title">{review.weekLabel}</div>
        <IconButton label="Next" icon="chevronRight" />
      </header>

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

      <button className="rhythm-pill" aria-label="Week rhythm">
        {review.rhythm.map((state, index) => (
          <span key={index} className={state === "amber" ? "soft" : undefined} />
        ))}
      </button>

      <Sheet title={sheetTitle(sheet)} open={sheet !== null} onClose={() => setSheet(null)}>
        {sheet === "wins" ? (
          <div className="sheet-list">
            {review.wins.map((win) => (
              <button key={win.id} className="list-row" onClick={() => setDetail(win.id)}>
                <span>
                  <strong>{win.title}</strong>
                </span>
                <span className="row-dot green" />
              </button>
            ))}
          </div>
        ) : null}
        {sheet === "risks" ? (
          <div className="sheet-list">
            {review.risks.map((risk) => (
              <button key={risk.id} className="list-row" onClick={() => setDetail(risk.id)}>
                <span>
                  <strong>{risk.title}</strong>
                  <small>{risk.severity}</small>
                </span>
                <span className={`row-dot ${risk.severity === "severe" ? "red" : "amber"}`} />
              </button>
            ))}
          </div>
        ) : null}
        {sheet === "full" ? (
          <div className="review-narrative">
            {review.narrative.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <button className="paper-action" onClick={onPlan}>Plan</button>
          </div>
        ) : null}
      </Sheet>

      <DetailPanel title={detailTitle(detail)} open={detail !== null} onBack={() => setDetail(null)}>
        {detail && reviewDetails[detail] ? (
          <div className="detail-stack">
            {reviewDetails[detail].severity ? (
              <span className={`status-chip severity-${reviewDetails[detail].severity}`}>{reviewDetails[detail].severity}</span>
            ) : null}
            <h2>{reviewDetails[detail].title}</h2>
            <p>{reviewDetails[detail].reason}</p>
            <dl className="evidence-list">
              {reviewDetails[detail].evidence.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            {reviewDetails[detail].action === "Plan" ? <button className="paper-action" onClick={onPlan}>Plan</button> : null}
          </div>
        ) : null}
      </DetailPanel>
    </section>
  );
}

function sheetTitle(sheet: ReviewSheet | null): string {
  if (sheet === "wins") return "Wins";
  if (sheet === "risks") return "Risks";
  if (sheet === "full") return "Review";
  return "Review";
}

function detailTitle(detail: ReviewDetail): string {
  if (detail?.startsWith("risk-")) return "Risk";
  if (detail?.startsWith("win-")) return "Win";
  return "Review";
}
