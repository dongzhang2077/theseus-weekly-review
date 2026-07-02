import type { ReactNode } from "react";
import { IconButton } from "./IconButton";

interface DetailPanelProps {
  title: string;
  open: boolean;
  onBack: () => void;
  children: ReactNode;
}

export function DetailPanel({ title, open, onBack, children }: DetailPanelProps) {
  if (!open) return null;

  return (
    <section className="detail open" aria-label={title}>
      <header className="detail-header">
        <IconButton label="Back" icon="chevronLeft" onClick={onBack} />
        <div className="detail-title-bar">{title}</div>
      </header>
      <div className="detail-body">{children}</div>
    </section>
  );
}
