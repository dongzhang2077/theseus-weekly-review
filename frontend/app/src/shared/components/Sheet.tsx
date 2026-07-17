import type { ReactNode } from "react";
import { Icon } from "../icons/Icon";
import { IconButton } from "./IconButton";

interface SheetProps {
  title: string;
  open: boolean;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

export function Sheet({ title, open, onClose, actions, children }: SheetProps) {
  if (!open) return null;

  return (
    <>
      <button className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <section className="sheet open" aria-label={title}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <button className="sheet-back-control" type="button" onClick={onClose}>
            <Icon name="chevronLeft" />
            <span>Back</span>
          </button>
          <div className="sheet-title">{title}</div>
          <div className="sheet-actions">
            {actions}
            <IconButton label="Close" icon="chevronDown" onClick={onClose} />
          </div>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </>
  );
}
