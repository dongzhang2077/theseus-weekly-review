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
  return (
    <div className="app-viewport">
      <div className={`phone-frame app-tab-${activeTab}`}>
        <main className="app-content">{children}</main>
        {profileName && onProfileChange ? (
          <button
            className="profile-switch"
            type="button"
            aria-label={`Switch local profile. Current profile: ${profileName}`}
            title="Switch profile"
            onClick={onProfileChange}
          >
            <span className="profile-switch-initial" aria-hidden="true">
              {profileInitial(profileName)}
            </span>
            <span className="profile-switch-label">{profileName}</span>
          </button>
        ) : null}
        {notice ? (
          <div className="source-notice" role="status" title={noticeTitle}>
            {notice}
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
