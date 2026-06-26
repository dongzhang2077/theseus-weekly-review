import type { ReactElement } from "react";

export type IconName =
  | "activity"
  | "book"
  | "calendar"
  | "check"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "folder"
  | "gauge"
  | "info"
  | "leaf"
  | "pause"
  | "play"
  | "route"
  | "target"
  | "timer"
  | "x";

interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

const paths: Record<IconName, ReactElement> = {
  activity: <path {...strokeProps} d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  book: (
    <>
      <path {...strokeProps} d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path {...strokeProps} d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  calendar: (
    <>
      <rect {...strokeProps} width="18" height="18" x="3" y="4" rx="2" />
      <path {...strokeProps} d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  check: <path {...strokeProps} d="M20 6 9 17l-5-5" />,
  chevronDown: <path {...strokeProps} d="m6 9 6 6 6-6" />,
  chevronLeft: <path {...strokeProps} d="m15 18-6-6 6-6" />,
  chevronRight: <path {...strokeProps} d="m9 18 6-6-6-6" />,
  folder: (
    <path
      {...strokeProps}
      d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.5L10.5 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
    />
  ),
  gauge: (
    <>
      <path {...strokeProps} d="M4 14a8 8 0 0 1 16 0" />
      <path {...strokeProps} d="m12 14 4-4" />
      <path {...strokeProps} d="M5 19h14" />
    </>
  ),
  info: (
    <>
      <circle {...strokeProps} cx="12" cy="12" r="10" />
      <path {...strokeProps} d="M12 16v-4M12 8h.01" />
    </>
  ),
  leaf: (
    <>
      <path {...strokeProps} d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path {...strokeProps} d="M2 21c0-3 1.85-5.36 5.08-6" />
    </>
  ),
  pause: (
    <>
      <path fill="currentColor" d="M7 5h4v14H7z" />
      <path fill="currentColor" d="M13 5h4v14h-4z" />
    </>
  ),
  play: <path fill="currentColor" d="M8 5.5v13l10-6.5-10-6.5Z" />,
  route: (
    <>
      <circle {...strokeProps} cx="6" cy="19" r="3" />
      <path {...strokeProps} d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle {...strokeProps} cx="18" cy="5" r="3" />
    </>
  ),
  target: (
    <>
      <circle {...strokeProps} cx="12" cy="12" r="9" />
      <circle {...strokeProps} cx="12" cy="12" r="5" />
      <circle {...strokeProps} cx="12" cy="12" r="1" />
    </>
  ),
  timer: (
    <>
      <path {...strokeProps} d="M10 2h4M12 14l3-3" />
      <circle {...strokeProps} cx="12" cy="14" r="8" />
    </>
  ),
  x: (
    <>
      <path {...strokeProps} d="M18 6 6 18" />
      <path {...strokeProps} d="m6 6 12 12" />
    </>
  )
};
