import type { IconName } from "../icons/Icon";
import { Icon } from "../icons/Icon";

interface StateSurfaceProps {
  icon: IconName;
  title: string;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void;
}

export function StateSurface({ icon, title, actionLabel, actionIcon = "check", onAction }: StateSurfaceProps) {
  return (
    <div className="state-surface">
      <Icon name={icon} className="state-icon" />
      <div className="state-title">{title}</div>
      {actionLabel && onAction ? (
        <button className="state-action" onClick={onAction}>
          <Icon name={actionIcon} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
