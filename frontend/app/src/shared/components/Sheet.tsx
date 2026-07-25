import type { ReactNode } from "react";
import { IconButton } from "./IconButton";

interface SheetProps {
  title: string;
  open: boolean;
  onClose: () => void;
  closeDisabled?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

export function Sheet({ title, open, onClose, closeDisabled = false, actions, children }: SheetProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="sheet-backdrop disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Close"
        disabled={closeDisabled}
        onClick={onClose}
      />
      <section className="sheet open" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div className="sheet-title">{title}</div>
          <div className="sheet-actions">
            {actions}
            <IconButton
              label="Close"
              icon="chevronDown"
              className="disabled:cursor-not-allowed disabled:opacity-40"
              disabled={closeDisabled}
              onClick={onClose}
            />
          </div>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </>
  );
}
