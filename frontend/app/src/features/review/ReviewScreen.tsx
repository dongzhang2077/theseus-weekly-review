import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon } from "../../shared/icons/Icon";
import type { IconName } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import { EvidenceTrace } from "../../shared/components/EvidenceTrace";
import type { AppReviewItem, AppWeekViewModel } from "../../shared/api/weeklyReview";

const characterAttentionUrl = new URL("../../assets/character-attention.png", import.meta.url).href;
const characterSteadyUrl = new URL("../../assets/character-steady.png", import.meta.url).href;
const characterWaitingUrl = new URL("../../assets/character-waiting.png", import.meta.url).href;

type ReviewSheet = "wins" | "risks" | "full";
type ReviewDetail = string | null;

interface ReviewScreenProps {
  review: AppWeekViewModel["review"];
  onPlan: () => void;
}

export function ReviewScreen({ review, onPlan }: ReviewScreenProps) {
  const weekLabels = ["Jun 1 - Jun 7", review.weekLabel, "Jun 15 - Jun 21"];
  const [weekIndex, setWeekIndex] = useState(1);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [sheet, setSheet] = useState<ReviewSheet | null>(null);
  const [detail, setDetail] = useState<ReviewDetail>(null);
  const needsAttention = review.risks.some((risk) => risk.severity === "severe");
  const reviewCharacterUrl = needsAttention ? characterAttentionUrl : characterSteadyUrl;
  const reviewDetails = [...review.wins, ...review.risks].reduce<Record<string, AppReviewItem>>((byId, item) => {
    byId[item.id] = item;
    return byId;
  }, {});

  return (
    <section className="screen review-screen">
      <header className="screen-header">
        <IconButton label="Previous" icon="chevronLeft" onClick={() => setWeekIndex((index) => Math.max(0, index - 1))} />
        <div className="screen-title">{weekLabels[weekIndex]}</div>
        <IconButton label="Next" icon="chevronRight" onClick={() => setWeekIndex((index) => Math.min(weekLabels.length - 1, index + 1))} />
      </header>

      <div className="review-cover">
        <div className={`review-paper ${needsAttention ? "review-needs-attention" : "review-steady"}`}>
          <div className="review-paper-head">
            <span>Weekly review</span>
            <div className="review-status">
              <i aria-hidden="true" />
              {review.status}
            </div>
          </div>

          <div className="review-hero">
            <div className="review-summary">
              <span className="review-summary-label">This week</span>
              <h1>{needsAttention ? "Time to realign" : "Steady progress"}</h1>
              <dl className="review-summary-metrics">
                <div>
                  <dt>Wins</dt>
                  <dd>{review.wins.length}</dd>
                </div>
                <div>
                  <dt>Signals</dt>
                  <dd>{review.risks.length}</dd>
                </div>
              </dl>
            </div>

            <button
              className={`character-button${bubbleOpen ? " active" : ""}`}
              type="button"
              aria-label={bubbleOpen ? "Hide week status summary" : "Show week status summary"}
              aria-expanded={bubbleOpen}
              onClick={() => setBubbleOpen((open) => !open)}
            >
              <span className="review-character-halo" aria-hidden="true" />
              <span className="review-character-shadow" aria-hidden="true" />
              <img src={reviewCharacterUrl} alt={review.characterAlt} />
              <span className="review-character-cue" aria-hidden="true">
                <Icon name={needsAttention ? "activity" : "leaf"} />
              </span>
            </button>
          </div>

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
                  <strong>{displayWinTitle(win)}</strong>
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

      {detail?.startsWith("win-") && reviewDetails[detail] ? (
        <section className="win-detail-page" aria-label="Win">
          <header className="win-detail-header">
            <button className="win-back-control" type="button" onClick={() => setDetail(null)}>
              <Icon name="chevronLeft" />
              <span>Back</span>
            </button>
            <strong>Win</strong>
            <button className="win-menu-control" type="button" aria-label="Win options">
              <Icon name="chevronDown" />
            </button>
          </header>

          <div className="win-detail-body">
            <section className="win-hero-card">
              <div className="win-target-mark" aria-hidden="true">
                <Icon name="check" />
              </div>
              <div className="win-hero-copy">
                <h2>{displayWinTitle(reviewDetails[detail])}</h2>
                <p>{displayWinReason(reviewDetails[detail])}</p>
              </div>
              <img className="win-character" src={characterSteadyUrl} alt="" aria-hidden="true" />
              <span className="completion-confetti one" />
              <span className="completion-confetti two" />
              <span className="completion-confetti three" />
              <span className="completion-confetti four" />
            </section>

            <dl className="win-metric-card">
              {reviewDetails[detail].evidence.map((row) => (
                <div key={row.label}>
                  <dt>
                    <span aria-hidden="true">
                      <Icon name={winMetricIcon(row.label)} />
                    </span>
                    {row.label}
                  </dt>
                  <dd className={row.label.toLowerCase() === "status" ? "status" : undefined}>{row.value}</dd>
                </div>
              ))}
            </dl>

            <section className="win-evidence-card" aria-label="Evidence">
              <h3>Evidence</h3>
              <div className="win-evidence-grid">
                <div className="win-chart" aria-hidden="true">
                  {[7, 10, 8, 11, 9, 3, 2].map((value, index) => (
                    <span key={index} style={{ "--bar-height": `${value * 8}px` } as CSSProperties} />
                  ))}
                </div>
                <div className="win-evidence-copy">
                  <span>This week</span>
                  <strong>{evidenceValue(reviewDetails[detail], "Logged")}</strong>
                  <small>Logged deep work</small>
                  <small className="win-compare">vs planned {evidenceValue(reviewDetails[detail], "Planned")}</small>
                </div>
              </div>
            </section>

            <section className="win-note-card">
              <span aria-hidden="true">
                <Icon name="leaf" />
              </span>
              <div>
                <strong>Why it matters</strong>
                <p>Momentum stayed steady.</p>
              </div>
            </section>

            <section className="win-note-card">
              <span aria-hidden="true">
                <Icon name="chevronRight" />
              </span>
              <div>
                <strong>Next step</strong>
                <p>Protect one more block.</p>
              </div>
            </section>

            <button className="win-action-button" type="button" onClick={onPlan}>
              <Icon name="plus" />
              <span>Add next task</span>
            </button>
          </div>
        </section>
      ) : null}

      {detail?.startsWith("risk-") && reviewDetails[detail] ? (
        <section className={`risk-detail-page severity-${reviewDetails[detail].severity ?? "attention"}`} aria-label="Risk">
          <header className="risk-detail-header">
            <button className="risk-back-control" type="button" onClick={() => setDetail(null)}>
              <Icon name="chevronLeft" />
              <span>Back</span>
            </button>
            <strong>Risk</strong>
            <span className="risk-header-mark" aria-hidden="true">
              <Icon name="activity" />
            </span>
          </header>

          <div className="risk-detail-body">
            <section className="risk-hero-card">
              <div className="risk-alert-mark" aria-hidden="true">
                <Icon name="sketchRisk" />
              </div>
              <div className="risk-hero-copy">
                <span className="risk-severity-label">{severityLabel(reviewDetails[detail].severity)}</span>
                <h2>{reviewDetails[detail].title}</h2>
                <p>{reviewDetails[detail].reason}</p>
              </div>
              <img className="risk-character" src={characterWaitingUrl} alt="Calm reminder" />
              <span className="risk-motion-line one" aria-hidden="true" />
              <span className="risk-motion-line two" aria-hidden="true" />
            </section>

            <section className="risk-section" aria-labelledby="risk-evidence-title">
              <div className="risk-section-heading">
                <span aria-hidden="true"><Icon name="fileText" /></span>
                <h3 id="risk-evidence-title">Key evidence</h3>
              </div>
              <dl className="risk-metric-grid">
                {reviewDetails[detail].evidence.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="risk-section risk-trace-section" aria-label="Evidence source">
              <div className="risk-section-heading">
                <span aria-hidden="true"><Icon name="route" /></span>
                <h3>Source</h3>
              </div>
              <EvidenceTrace trace={reviewDetails[detail].trace} />
            </section>

            <section className="risk-next-step">
              <span aria-hidden="true"><Icon name="target" /></span>
              <div>
                <strong>Next step</strong>
                <p>Reduce the gap before adding more work.</p>
              </div>
            </section>

            {reviewDetails[detail].action === "Plan" ? (
              <button className="risk-action-button" type="button" onClick={onPlan}>
                <Icon name="calendar" />
                <span>Adjust plan</span>
                <Icon name="chevronRight" />
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function sheetTitle(sheet: ReviewSheet | null): string {
  if (sheet === "wins") return "Wins";
  if (sheet === "risks") return "Risks";
  if (sheet === "full") return "Review";
  return "Review";
}

function evidenceValue(item: AppReviewItem, label: string): string {
  return item.evidence.find((row) => row.label.toLowerCase() === label.toLowerCase())?.value ?? "0h";
}

function severityLabel(severity: AppReviewItem["severity"]): string {
  if (severity === "severe") return "Severe";
  if (severity === "attention") return "Needs attention";
  if (severity === "nodata") return "Check data";
  return "Monitor";
}

function displayWinTitle(item: AppReviewItem): string {
  if (item.id === "win-deep-work" || item.title.toLowerCase().includes("deep-work blocks")) return "Deep work protected";
  return item.title;
}

function displayWinReason(item: AppReviewItem): string {
  if (item.id === "win-deep-work" || item.reason.toLowerCase().includes("fragmenting")) return "Focus blocks kept progress moving.";
  return item.reason;
}

function winMetricIcon(label: string): IconName {
  const normalized = label.toLowerCase();
  if (normalized === "planned") return "timer";
  if (normalized === "logged") return "fileText";
  return "activity";
}
