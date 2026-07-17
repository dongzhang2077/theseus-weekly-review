import type { ReactNode } from "react";
import { Icon } from "../icons/Icon";

interface DetailPanelProps {
  title: string;
  ariaLabel?: string;
  open: boolean;
  onBack: () => void;
  children: ReactNode;
}

export function DetailPanel({ title, ariaLabel, open, onBack, children }: DetailPanelProps) {
  if (!open) return null;

  return (
    <section className="detail open" aria-label={ariaLabel ?? title}>
      <header className="detail-header">
        <button className="detail-back-control" type="button" onClick={onBack}>
          <Icon name="chevronLeft" />
          <span>Back</span>
        </button>
        <div className="detail-title-bar">{title}</div>
      </header>
      <div className="detail-body">{children}</div>
    </section>
  );
}
