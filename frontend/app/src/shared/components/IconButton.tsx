import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "../icons/Icon";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: IconName;
  variant?: "plain" | "soft" | "danger";
}

export function IconButton({ label, icon, variant = "plain", className = "", ...props }: IconButtonProps) {
  return (
    <button className={`icon-button icon-button-${variant} ${className}`} aria-label={label} title={label} {...props}>
      <Icon name={icon} />
    </button>
  );
}
