import type { ReactNode } from "react";
import { BottomNav } from "../navigation/BottomNav";
import type { AppTab } from "../navigation/tabs";

interface AppShellProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: ReactNode;
}

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  return (
    <div className="app-viewport">
      <div className="phone-frame">
        <main className="app-content">{children}</main>
        <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
      </div>
    </div>
  );
}
