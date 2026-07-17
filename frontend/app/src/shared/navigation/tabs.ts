import type { IconName } from "../icons/Icon";

export type AppTab = "review" | "signals" | "track" | "plan";

export interface TabItem {
  id: AppTab;
  label: string;
  icon: IconName;
}

export const tabs: TabItem[] = [
  { id: "review", label: "Review", icon: "book" },
  { id: "signals", label: "Signals", icon: "activity" },
  { id: "track", label: "Focus", icon: "timer" },
  { id: "plan", label: "Plan", icon: "calendar" }
];

export function resolveInitialTab(search: string): AppTab {
  const requested = new URLSearchParams(search).get("tab");
  return tabs.some((tab) => tab.id === requested) ? requested as AppTab : "review";
}
