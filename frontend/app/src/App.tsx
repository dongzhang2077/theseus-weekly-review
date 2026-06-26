import { useEffect, useState } from "react";
import { AppShell } from "./shared/shell/AppShell";
import { ReviewScreen } from "./features/review/ReviewScreen";
import { SignalsScreen } from "./features/signals/SignalsScreen";
import { TrackScreen } from "./features/track/TrackScreen";
import { PlanScreen, type PlanDetail } from "./features/plan/PlanScreen";
import type { AppTab } from "./shared/navigation/tabs";
import { demoWeek } from "./shared/demo/demoWeek";
import { loadAppWeek } from "./shared/api/loadAppWeek";
import type { AppWeekViewModel } from "./shared/api/weeklyReview";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export interface PlanEntryRequest {
  id: number;
  detail: PlanDetail;
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("review");
  const [planEntryRequest, setPlanEntryRequest] = useState<PlanEntryRequest | null>(null);
  const [appWeek, setAppWeek] = useState<AppWeekViewModel>(demoWeek);

  function openPlanSuggestion() {
    setPlanEntryRequest({ id: Date.now(), detail: "suggestion" });
    setActiveTab("plan");
  }

  useEffect(() => {
    let ignore = false;

    loadAppWeek({ apiBaseUrl: env.VITE_THESEUS_API_BASE_URL }).then((loaded) => {
      if (!ignore) {
        setAppWeek(loaded.week);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "review" ? <ReviewScreen review={appWeek.review} onPlan={openPlanSuggestion} /> : null}
      {activeTab === "signals" ? <SignalsScreen signals={appWeek.signals} /> : null}
      {activeTab === "track" ? <TrackScreen apiBaseUrl={env.VITE_THESEUS_API_BASE_URL} track={appWeek.track} /> : null}
      {activeTab === "plan" ? <PlanScreen planData={appWeek.plan} entryRequest={planEntryRequest} /> : null}
    </AppShell>
  );
}
