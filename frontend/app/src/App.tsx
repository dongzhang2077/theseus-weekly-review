import { useState } from "react";
import { AppShell } from "./shared/shell/AppShell";
import { ReviewScreen } from "./features/review/ReviewScreen";
import { SignalsScreen } from "./features/signals/SignalsScreen";
import { TrackScreen } from "./features/track/TrackScreen";
import { PlanScreen, type PlanDetail } from "./features/plan/PlanScreen";
import type { AppTab } from "./shared/navigation/tabs";

export interface PlanEntryRequest {
  id: number;
  detail: PlanDetail;
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("review");
  const [planEntryRequest, setPlanEntryRequest] = useState<PlanEntryRequest | null>(null);

  function openPlanSuggestion() {
    setPlanEntryRequest({ id: Date.now(), detail: "suggestion" });
    setActiveTab("plan");
  }

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "review" ? <ReviewScreen onPlan={openPlanSuggestion} /> : null}
      {activeTab === "signals" ? <SignalsScreen /> : null}
      {activeTab === "track" ? <TrackScreen /> : null}
      {activeTab === "plan" ? <PlanScreen entryRequest={planEntryRequest} /> : null}
    </AppShell>
  );
}
