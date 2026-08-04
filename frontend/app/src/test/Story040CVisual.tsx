import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { PlanScreen } from "../features/plan/PlanScreen";
import { demoWeek } from "../shared/demo/demoWeek";
import { AppShell } from "../shared/shell/AppShell";
import "../styles/tailwind.css";
import "../styles/global.css";

function Story040CVisual() {
  const [detailOpen, setDetailOpen] = useState(false);
  const view = new URLSearchParams(window.location.search).get("view");
  const planData = useMemo(
    () =>
      view === "capacity"
        ? {
            ...demoWeek.plan,
            sourcePlan: {
              ...demoWeek.plan.sourcePlan,
              capacityMinutes: 0,
            },
          }
        : demoWeek.plan,
    [view]
  );

  useEffect(() => {
    if (view !== "verified") return;
    window.setTimeout(() => {
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Apply adjustment"]'
        )
        ?.click();
    }, 100);
  }, [view]);

  return (
    <AppShell
      activeTab="plan"
      onTabChange={() => undefined}
      navigationHidden={detailOpen}
      interactionLocked={detailOpen}
    >
      <PlanScreen
        planData={planData}
        reviewSource="demo"
        accountToday="2026-07-30"
        entryRequest={null}
        onReview={() => undefined}
        onFocusItem={() => undefined}
        onDetailOpenChange={setDetailOpen}
      />
    </AppShell>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <Story040CVisual />
);
