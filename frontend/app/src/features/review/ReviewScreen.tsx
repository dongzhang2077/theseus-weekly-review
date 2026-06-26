import { Icon } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";

export function ReviewScreen() {
  return (
    <section className="screen review-screen">
      <header className="screen-header">
        <IconButton label="Previous" icon="chevronLeft" />
        <div className="screen-title">Jun 8 - Jun 14</div>
        <IconButton label="Next" icon="chevronRight" />
      </header>

      <div className="review-cover">
        <div className="review-status">Needs attention</div>
        <div className="paper-character" aria-label="Weekly status">
          <div className="character-head" />
          <div className="character-body" />
        </div>
        <div className="review-chapters" aria-label="Review chapters">
          <button className="chapter-button chapter-wins" aria-label="Wins">
            <Icon name="check" />
          </button>
          <button className="chapter-button chapter-risks priority" aria-label="Risks">
            <Icon name="gauge" />
          </button>
          <button className="chapter-button chapter-full" aria-label="Full review">
            <Icon name="book" />
          </button>
        </div>
      </div>

      <button className="rhythm-pill" aria-label="Week rhythm">
        <span />
        Steady
      </button>
    </section>
  );
}
