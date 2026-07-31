import type { IconName } from "../icons/Icon";

export type AppTab = "track" | "insights" | "plan";

export interface TabItem {
  id: AppTab;
  label: string;
  icon: IconName;
}

export const tabs: TabItem[] = [
  { id: "track", label: "Today", icon: "timer" },
  { id: "insights", label: "Insights", icon: "activity" },
  { id: "plan", label: "Plan", icon: "calendar" }
];

export function resolveInitialTab(search: string): AppTab {
  const requested = new URLSearchParams(search).get("tab");
  if (requested === "review" || requested === "signals") return "insights";
  return tabs.some((tab) => tab.id === requested) ? requested as AppTab : "track";
}
