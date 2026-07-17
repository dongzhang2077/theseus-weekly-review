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
}

export function AppShell({
  activeTab,
  onTabChange,
  children,
  profileName,
  onProfileChange,
  notice,
  noticeTitle
}: AppShellProps) {
  const hasProfileControl = Boolean(profileName && onProfileChange);
  const hasUtilityBar = hasProfileControl || Boolean(notice);

  return (
    <div className="min-h-dvh bg-desk-canvas sm:grid sm:place-items-center sm:p-6">
      <div className="relative h-dvh w-full overflow-hidden bg-desk-paper text-desk-ink sm:h-[min(844px,calc(100dvh-48px))] sm:min-h-[720px] sm:max-w-[390px] sm:rounded-[28px] sm:border sm:border-desk-line sm:shadow-[0_18px_48px_rgb(66_58_45/0.16)] lg:max-w-[1024px]">
        <main
          className={hasUtilityBar
            ? "h-[calc(100%-98px)] overflow-hidden lg:h-[calc(100%-32px)] lg:pl-[72px]"
            : "h-[calc(100%-66px)] overflow-hidden lg:h-full lg:pl-[72px]"}
        >
          {children}
        </main>
        {hasUtilityBar ? (
          <div className="absolute inset-x-0 bottom-[66px] z-20 flex h-8 items-center justify-between border-t border-desk-line bg-desk-raised px-3 text-[11px] lg:bottom-0 lg:left-[72px]">
            {hasProfileControl ? (
              <button
                className="inline-flex min-w-0 items-center gap-2 rounded-paper border-0 bg-transparent font-bold text-desk-accent hover:text-desk-ink"
                type="button"
                aria-label={`Switch local profile. Current profile: ${profileName}`}
                title="Switch profile"
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
      </div>
    </div>
  );
}

function profileInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase() || "U";
}
