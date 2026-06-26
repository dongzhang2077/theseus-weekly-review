import { useState } from "react";
import type { ReactElement } from "react";
import { AppShell } from "./shared/shell/AppShell";
import { ReviewScreen } from "./features/review/ReviewScreen";
import { SignalsScreen } from "./features/signals/SignalsScreen";
import { TrackScreen } from "./features/track/TrackScreen";
import { PlanScreen } from "./features/plan/PlanScreen";
import type { AppTab } from "./shared/navigation/tabs";

const screens: Record<AppTab, ReactElement> = {
  review: <ReviewScreen />,
  signals: <SignalsScreen />,
  track: <TrackScreen />,
  plan: <PlanScreen />
};

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("review");

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {screens[activeTab]}
    </AppShell>
  );
}
