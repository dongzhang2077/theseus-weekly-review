import type { ReactNode } from "react";
import { BottomNav } from "../navigation/BottomNav";
import type { AppTab } from "../navigation/tabs";

interface AppShellProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: ReactNode;
  profileName?: string;
  onProfileChange?: () => void;
  notice?: string;
  noticeTitle?: string;
  overlay?: ReactNode;
}

export function AppShell({
  activeTab,
  onTabChange,
  children,
  profileName,
  onProfileChange,
  notice,
  noticeTitle,
  overlay
}: AppShellProps) {
  const hasProfileControl = Boolean(profileName && onProfileChange);
  const hasUtilityBar = hasProfileControl || Boolean(notice);

  return (
    <div className="grid min-h-dvh place-items-center bg-desk-canvas min-[431px]:p-6">
      <div className="relative h-dvh w-full max-w-[430px] overflow-hidden bg-desk-paper text-desk-ink min-[431px]:h-[min(932px,calc(100dvh-48px))] min-[431px]:min-h-[720px] min-[431px]:rounded-[28px] min-[431px]:border min-[431px]:border-desk-line min-[431px]:shadow-[0_18px_48px_rgb(66_58_45/0.16)]">
        <main
          className={hasUtilityBar
            ? "h-[calc(100%-98px)] overflow-hidden"
            : "h-[calc(100%-66px)] overflow-hidden"}
        >
          {children}
        </main>
        {hasUtilityBar ? (
          <div className="absolute inset-x-0 bottom-[66px] z-20 flex h-8 items-center justify-between border-t border-desk-line bg-desk-raised px-3 text-[11px]">
            {hasProfileControl ? (
              <button
                className="inline-flex min-w-0 items-center gap-2 rounded-paper border-0 bg-transparent font-bold text-desk-accent hover:text-desk-ink"
                type="button"
                aria-label={`Open account. Signed in as ${profileName}`}
                title="Open account"
                onClick={onProfileChange}
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-desk-accent-soft" aria-hidden="true">
                  {profileInitial(profileName ?? "")}
                </span>
                <span className="max-w-32 truncate">{profileName}</span>
              </button>
            ) : <span />}
            {notice ? (
              <span className="font-bold text-desk-warn" role="status" title={noticeTitle}>
                {notice}
              </span>
            ) : null}
          </div>
        ) : null}
        <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
        {overlay}
      </div>
    </div>
  );
}

function profileInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase() || "U";
}
