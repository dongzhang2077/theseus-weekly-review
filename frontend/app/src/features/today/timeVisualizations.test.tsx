import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApiTimeLogRead } from "../../shared/api/timeLogs";
import type { PlanProject } from "../../shared/domain/plan";
import { TimeDonut } from "./TimeDonut";
import { TimeEvidenceSheet } from "./TimeEvidenceSheet";
import { WeekBars } from "./WeekBars";
import {
  aggregateProjectTime,
  aggregateTimeWeek,
  type ProjectTimeBucket,
} from "./timeAggregation";

const projects: PlanProject[] = [
  {
    id: 1,
    title: "Theseus application redesign with a deliberately long project name",
    stage: "sprint",
    status: "active",
    weeklyMinMinutes: 120,
    weeklyTargetMinutes: 300,
  },
  {
    id: 2,
    title: "Coursework",
    stage: "stable",
    status: "active",
    weeklyMinMinutes: 60,
    weeklyTargetMinutes: 180,
  },
  {
    id: 3,
    title: "Research",
    stage: "startup",
    status: "active",
    weeklyMinMinutes: 30,
    weeklyTargetMinutes: 120,
  },
  {
    id: 4,
    title: "Health",
    stage: "stable",
    status: "active",
    weeklyMinMinutes: 60,
    weeklyTargetMinutes: 120,
  },
  {
    id: 5,
    title: "Admin",
    stage: "dormant",
    status: "active",
    weeklyMinMinutes: 0,
    weeklyTargetMinutes: 30,
  },
];

describe("TimeDonut", () => {
  it("keeps the SVG decorative and opens the exact selected evidence bucket", () => {
    const logs = [
      timeLog(1, "2026-07-30", 1, 3601, "Implementation"),
      timeLog(2, "2026-07-30", 2, 1800, "Reading"),
      timeLog(3, "2026-07-30", 3, 900, "Research notes"),
      timeLog(4, "2026-07-30", 4, 600, "Walk"),
      timeLog(5, "2026-07-30", 5, 300, "Inbox"),
    ];
    const summary = aggregateProjectTime(logs, projects, {
      start: "2026-07-30",
      end: "2026-07-30",
    });
    const onOpenBucket = vi.fn<(bucket: ProjectTimeBucket) => void>();
    const onOpenAll = vi.fn();
    const { container } = render(
      <TimeDonut
        summary={summary}
        onOpenBucket={onOpenBucket}
        onOpenAll={onOpenAll}
      />
    );

    const chart = screen.getByRole("heading", { name: "Time by project" }).closest("section");
    expect(chart).not.toBeNull();
    expect(within(chart as HTMLElement).getAllByText("2h 0m 1s")).toHaveLength(2);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.querySelector("button")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: /open other time records/i,
      })
    );
    expect(onOpenBucket).toHaveBeenCalledTimes(1);
    expect(onOpenBucket.mock.calls[0][0].recordIds).toEqual([4, 5]);
    expect(onOpenBucket.mock.calls[0][0].members?.map((member) => member.key)).toEqual([
      "project:4",
      "project:5",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Open all time records" }));
    expect(onOpenAll).toHaveBeenCalledTimes(1);
  });
});

describe("WeekBars", () => {
  it("keeps future days unavailable and opens the selected day records", () => {
    const logs = [
      timeLog(11, "2026-07-27", 1, 1800, "Monday build"),
      timeLog(12, "2026-07-29", 2, 2400, "Wednesday study"),
      timeLog(13, "2026-07-29", 1, 600, "Wednesday build"),
      timeLog(14, "2026-07-30", 3, 1200, "Thursday research"),
      timeLog(15, "2026-07-31", 1, 9999, "Future data"),
    ];
    const summary = aggregateTimeWeek(logs, projects, "2026-07-27", "2026-07-30");
    const onOpenDay = vi.fn();
    render(<WeekBars summary={summary} onOpenDay={onOpenDay} />);

    expect(screen.getAllByRole("button", { name: /time records/i })).toHaveLength(4);
    expect(screen.getAllByLabelText(/unavailable/i)).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /jul 31/i })).not.toBeInTheDocument();
    expect(screen.getByText("1h 40m")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /open wed, jul 29 time records, 50m/i,
      })
    );
    expect(onOpenDay).toHaveBeenCalledTimes(1);
    expect(onOpenDay.mock.calls[0][0]).toMatchObject({
      date: "2026-07-29",
      recordIds: [12, 13],
    });
  });
});

describe("TimeEvidenceSheet", () => {
  it("renders only requested live records and reports missing source evidence", () => {
    const logs = [
      timeLog(21, "2026-07-30", 1, 3723, "Implementation"),
      timeLog(22, "2026-07-30", 2, 600, "Unrelated reading"),
      { ...timeLog(23, "2026-07-30", null, 300, "Deleted note"), deleted_at: "2026-07-30T12:00:00Z" },
    ];
    const { container } = render(
      <TimeEvidenceSheet
        open
        title="Theseus time records"
        recordIds={[21, 23, 999]}
        logs={logs}
        projects={projects}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Theseus time records" });
    expect(within(dialog).getByText("Implementation")).toBeInTheDocument();
    expect(within(dialog).getAllByText("1h 2m 3s")).toHaveLength(2);
    expect(within(dialog).getByText(projects[0].title)).toHaveClass("whitespace-normal");
    expect(within(dialog).queryByText("Unrelated reading")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Deleted note")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "2 source records are unavailable"
    );
    expect(container.querySelector('[data-record-id="21"]')).not.toBeNull();
    expect(container.querySelector('[data-record-id="22"]')).toBeNull();
  });

  it("shows a truthful empty state", () => {
    render(
      <TimeEvidenceSheet
        open
        title="Tuesday time records"
        recordIds={[]}
        logs={[]}
        projects={projects}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Tuesday time records" });
    expect(within(dialog).getByText("No recorded time")).toBeInTheDocument();
    expect(within(dialog).getByText("0 records")).toBeInTheDocument();
    expect(within(dialog).getByText("0s")).toBeInTheDocument();
  });
});

function timeLog(
  id: number,
  date: string,
  projectId: number | null,
  durationSeconds: number,
  activityName: string
): ApiTimeLogRead {
  return {
    id,
    user_id: 1,
    project_id: projectId,
    date,
    duration_minutes: Math.floor(durationSeconds / 60),
    duration_seconds: durationSeconds,
    activity_name: activityName,
    activity_type: "neutral",
    type_source: "user_selected",
    note: "",
    version: 1,
    deleted_at: null,
    created_at: `${date}T10:00:00Z`,
    updated_at: `${date}T10:00:00Z`,
  };
}
