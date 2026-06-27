import type { AppTab } from "./tabs";
import { tabs } from "./tabs";
import { Icon } from "../icons/Icon";

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="App sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav-item ${activeTab === tab.id ? "selected" : ""}`}
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? "page" : undefined}
          onClick={() => onTabChange(tab.id)}
        >
          <Icon name={tab.icon} />
        </button>
      ))}
    </nav>
  );
}
