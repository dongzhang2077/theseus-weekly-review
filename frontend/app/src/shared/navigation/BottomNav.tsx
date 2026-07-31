import type { AppTab } from "./tabs";
import { tabs } from "./tabs";
import { Icon } from "../icons/Icon";

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  disabled?: boolean;
}

export function BottomNav({ activeTab, onTabChange, disabled = false }: BottomNavProps) {
  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-20 grid h-[66px] grid-cols-3 border-t border-desk-line bg-desk-raised/95 px-2 pb-2 pt-1.5 backdrop-blur-sm"
      aria-label="App sections"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`flex min-h-11 min-w-0 items-center justify-center rounded-paper border-0 px-1 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-desk-accent disabled:cursor-not-allowed disabled:opacity-45 ${
            activeTab === tab.id
              ? "bg-desk-accent-soft text-desk-accent"
              : "bg-transparent text-desk-muted hover:bg-desk-sunk hover:text-desk-ink"
          }`}
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? "page" : undefined}
          title={tab.label}
          disabled={disabled}
          onClick={() => onTabChange(tab.id)}
        >
          <Icon name={tab.icon} className="size-6" />
        </button>
      ))}
    </nav>
  );
}
