import { useState } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";

const characterAttentionUrl = new URL("../../assets/character-attention.png", import.meta.url).href;

type ReviewSheet = "wins" | "risks" | "full";
type ReviewDetail = "win-backend" | "win-deep-work" | "risk-resume" | "risk-frontend" | null;

interface ReviewScreenProps {
  onPlan: () => void;
}

export function ReviewScreen({ onPlan }: ReviewScreenProps) {
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [sheet, setSheet] = useState<ReviewSheet | null>(null);
  const [detail, setDetail] = useState<ReviewDetail>(null);

  return (
    <section className="screen review-screen">
      <header className="screen-header">
        <IconButton label="Previous" icon="chevronLeft" />
        <div className="screen-title">Jun 8 - Jun 14</div>
        <IconButton label="Next" icon="chevronRight" />
      </header>

      <div className="review-cover">
        <div className="review-paper">
          <div className="review-status">Needs attention</div>
          <button className="character-button" aria-label="Week status summary" onClick={() => setBubbleOpen((open) => !open)}>
            <img src={characterAttentionUrl} alt="Week needs attention" />
          </button>
          {bubbleOpen ? <div className="speech-bubble">You moved Theseus forward, but your resume work needs a restart.</div> : null}
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
        <span />
        <span />
        <span />
        <span className="soft" />
        <span />
        <span />
        <span />
      </button>

      <Sheet title={sheetTitle(sheet)} open={sheet !== null} onClose={() => setSheet(null)}>
        {sheet === "wins" ? (
          <div className="sheet-list">
            <button className="list-row" onClick={() => setDetail("win-backend")}>
              <span>
                <strong>Backend progress on track</strong>
              </span>
              <span className="row-dot green" />
            </button>
            <button className="list-row" onClick={() => setDetail("win-deep-work")}>
              <span>
                <strong>Deep-work blocks protected</strong>
              </span>
              <span className="row-dot green" />
            </button>
          </div>
        ) : null}
        {sheet === "risks" ? (
          <div className="sheet-list">
            <button className="list-row" onClick={() => setDetail("risk-resume")}>
              <span>
                <strong>Resume dormant</strong>
                <small>Severe</small>
              </span>
              <span className="row-dot red" />
            </button>
            <button className="list-row" onClick={() => setDetail("risk-frontend")}>
              <span>
                <strong>Frontend drift</strong>
                <small>Attention</small>
              </span>
              <span className="row-dot amber" />
            </button>
          </div>
        ) : null}
        {sheet === "full" ? (
          <div className="review-narrative">
            <p>Theseus backend moved forward with consistent deep-work blocks.</p>
            <p>Resume work needs a small restart before the week gets crowded.</p>
            <button className="paper-action" onClick={onPlan}>Plan</button>
          </div>
        ) : null}
      </Sheet>

      <DetailPanel title={detailTitle(detail)} open={detail !== null} onBack={() => setDetail(null)}>
        {detail === "win-backend" ? (
          <div className="detail-stack">
            <h2>Backend progress on track</h2>
            <p>Consistent work kept the demo path healthy.</p>
            <dl className="evidence-list">
              <div>
                <dt>Planned</dt>
                <dd>8h</dd>
              </div>
              <div>
                <dt>Logged</dt>
                <dd>9.5h</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>On track</dd>
              </div>
            </dl>
          </div>
        ) : null}
        {detail === "win-deep-work" ? (
          <div className="detail-stack">
            <h2>Deep-work blocks protected</h2>
            <p>Repeated focus blocks kept implementation moving without fragmenting the week.</p>
            <dl className="evidence-list">
              <div>
                <dt>Blocks</dt>
                <dd>4</dd>
              </div>
              <div>
                <dt>Longest</dt>
                <dd>2h</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Consistent</dd>
              </div>
            </dl>
          </div>
        ) : null}
        {detail === "risk-resume" ? (
          <div className="detail-stack">
            <span className="status-chip severity-severe">severe</span>
            <h2>Resume dormant</h2>
            <p>The project had no logged work this week.</p>
            <dl className="evidence-list">
              <div>
                <dt>Logged</dt>
                <dd>0h</dd>
              </div>
              <div>
                <dt>Inactive</dt>
                <dd>5d</dd>
              </div>
              <div>
                <dt>Minimum</dt>
                <dd>3h</dd>
              </div>
            </dl>
            <button className="paper-action" onClick={onPlan}>Plan</button>
          </div>
        ) : null}
        {detail === "risk-frontend" ? (
          <div className="detail-stack">
            <span className="status-chip severity-attention">attention</span>
            <h2>Frontend drift</h2>
            <p>Frontend work landed below the planned target while backend took priority.</p>
            <dl className="evidence-list">
              <div>
                <dt>Planned</dt>
                <dd>8h</dd>
              </div>
              <div>
                <dt>Logged</dt>
                <dd>2h</dd>
              </div>
              <div>
                <dt>Delta</dt>
                <dd>-6h</dd>
              </div>
            </dl>
            <button className="paper-action" onClick={onPlan}>Plan</button>
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
  if (detail === "risk-resume" || detail === "risk-frontend") return "Risk";
  if (detail === "win-backend" || detail === "win-deep-work") return "Win";
  return "Review";
}
