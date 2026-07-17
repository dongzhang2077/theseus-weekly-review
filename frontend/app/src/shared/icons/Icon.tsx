import type { ReactElement } from "react";

export type IconName =
  | "activity"
  | "book"
  | "briefcase"
  | "calendar"
  | "check"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "code"
  | "fileText"
  | "folder"
  | "gauge"
  | "globe"
  | "info"
  | "layers"
  | "leaf"
  | "pause"
  | "play"
  | "plus"
  | "route"
  | "sketchReview"
  | "sketchRisk"
  | "sketchWin"
  | "target"
  | "timer"
  | "trash"
  | "trophy"
  | "user"
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
  briefcase: (
    <>
      <rect {...strokeProps} x="3" y="7" width="18" height="13" rx="2" />
      <path {...strokeProps} d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
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
  code: (
    <>
      <path {...strokeProps} d="m16 18 6-6-6-6" />
      <path {...strokeProps} d="m8 6-6 6 6 6" />
    </>
  ),
  fileText: (
    <>
      <path {...strokeProps} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path {...strokeProps} d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
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
  globe: (
    <>
      <circle {...strokeProps} cx="12" cy="12" r="9" />
      <path {...strokeProps} d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
    </>
  ),
  info: (
    <>
      <circle {...strokeProps} cx="12" cy="12" r="10" />
      <path {...strokeProps} d="M12 16v-4M12 8h.01" />
    </>
  ),
  layers: (
    <>
      <path {...strokeProps} d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path {...strokeProps} d="m3 12 9 5 9-5M3 16l9 5 9-5" />
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
  plus: <path {...strokeProps} d="M12 5v14M5 12h14" />,
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
  sketchReview: (
    <>
      <path {...strokeProps} strokeWidth={1.9} d="M4.2 5.2c2.4-.9 5-.7 7.5.8v13c-2.5-1.6-5.1-1.8-7.5-.8Z" />
      <path {...strokeProps} strokeWidth={1.9} d="M19.8 5.2c-2.4-.9-5-.7-7.5.8v13c2.5-1.6 5.1-1.8 7.5-.8Z" />
      <path {...strokeProps} strokeWidth={1.9} d="M7.1 9.2c1-.2 1.8-.1 2.8.3M14.2 9.5c1-.4 1.9-.5 2.9-.3M7.1 12.1c1-.2 1.8-.1 2.8.3M14.2 12.4c1-.4 1.9-.5 2.9-.3" />
    </>
  ),
  sketchRisk: (
    <>
      <path {...strokeProps} strokeWidth={1.9} d="M11.2 4.5c.5-.8 1.4-.8 1.9 0l7 12.7c.5.8-.1 1.8-1.1 1.8H5c-1 0-1.6-1-1.1-1.8Z" />
      <path {...strokeProps} strokeWidth={1.9} d="M12 8.7v4.7M12 16.6h.01M8.3 18.9c2.4.5 5.3.5 7.6-.1" />
    </>
  ),
  sketchWin: (
    <>
      <path {...strokeProps} strokeWidth={1.9} d="M7.2 5.4c.7 5.4 2.4 8.2 4.9 8.2 2.4 0 4.1-2.8 4.8-8.2" />
      <path {...strokeProps} strokeWidth={1.9} d="M6.4 5.6h11.2M8 8.1c-2.7-.2-4.1.7-4 2.4.2 1.9 2.1 3.1 5 3.2M16 8.1c2.7-.2 4.1.7 4 2.4-.2 1.9-2.1 3.1-5 3.2M12 13.9v3.1M9.2 20.1c1.5-1.4 4.2-1.4 5.7 0M8.4 20.2h7.5" />
    </>
  ),
  timer: (
    <>
      <path {...strokeProps} d="M10 2h4M12 14l3-3" />
      <circle {...strokeProps} cx="12" cy="14" r="8" />
    </>
  ),
  trash: (
    <path {...strokeProps} d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
  ),
  trophy: (
    <>
      <path {...strokeProps} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16" />
      <path {...strokeProps} d="M10 14.66V17c0 .55-.47.98-.97 1.16C7.85 18.5 7 20.06 7 22M14 14.66V17c0 .55.47.98.97 1.16C16.15 18.5 17 20.06 17 22" />
      <path {...strokeProps} d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),
  user: (
    <>
      <circle {...strokeProps} cx="12" cy="8" r="4" />
      <path {...strokeProps} d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  x: (
    <>
      <path {...strokeProps} d="M18 6 6 18" />
      <path {...strokeProps} d="m6 6 12 12" />
    </>
  )
};
