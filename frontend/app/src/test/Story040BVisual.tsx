import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { InsightsScreen } from "../features/insights/InsightsScreen";
import type { ReviewWeekRange } from "../features/review/reviewWeek";
import { demoWeek } from "../shared/demo/demoWeek";
import { AppShell } from "../shared/shell/AppShell";
import "../styles/tailwind.css";
import "../styles/global.css";

function Story040BVisual() {
  const [weekRange, setWeekRange] = useState<ReviewWeekRange>({
    start: "2026-06-08",
    end: "2026-06-14",
  });
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    window.setTimeout(() => {
      if (view === "other") {
        findButton("Open Other issues")?.click();
      }
      if (view === "review") {
        findButton("Open Weekly review")?.click();
      }
      if (view === "priority") {
        findButton("Open Resume dormant details")?.click();
      }
    }, 80);
  }, []);

  return (
    <AppShell
      activeTab="insights"
      onTabChange={() => undefined}
      navigationHidden={detailOpen}
      interactionLocked={detailOpen}
      profileName="Student"
    >
      <InsightsScreen
        review={demoWeek.review}
        signals={demoWeek.signals}
        weekRange={weekRange}
        accountToday="2026-07-30"
        hasTimeLogs
        onWeekChange={setWeekRange}
        onGenerate={() => undefined}
        onAction={() => undefined}
        onTrack={() => undefined}
        onDetailOpenChange={setDetailOpen}
      />
    </AppShell>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <Story040BVisual />
);

function findButton(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) =>
      button.getAttribute("aria-label") === label ||
      button.textContent?.trim() === label
  );
}
