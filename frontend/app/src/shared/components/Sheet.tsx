import type { ReactNode } from "react";
import { IconButton } from "./IconButton";

interface SheetProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ title, open, onClose, children }: SheetProps) {
  if (!open) return null;

  return (
    <>
      <button className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <section className="sheet open" aria-label={title}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div className="sheet-title">{title}</div>
          <IconButton label="Close" icon="chevronDown" onClick={onClose} />
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </>
  );
}
