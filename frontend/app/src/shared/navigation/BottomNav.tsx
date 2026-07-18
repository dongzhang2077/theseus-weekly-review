import type { AppTab } from "./tabs";
import { tabs } from "./tabs";
import { Icon } from "../icons/Icon";

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-20 grid h-[66px] grid-cols-4 border-t border-desk-line bg-desk-raised/95 px-2 pb-2 pt-1.5 backdrop-blur-sm"
      aria-label="App sections"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-paper border-0 px-1 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-desk-accent ${
            activeTab === tab.id
              ? "bg-desk-accent-soft text-desk-accent"
              : "bg-transparent text-desk-muted hover:bg-desk-sunk hover:text-desk-ink"
          }`}
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? "page" : undefined}
          onClick={() => onTabChange(tab.id)}
        >
          <Icon name={tab.icon} className="size-5" />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
