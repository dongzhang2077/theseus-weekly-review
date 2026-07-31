import type { ApiTimeLogRead } from "../../shared/api/timeLogs";
import type { PlanProject } from "../../shared/domain/plan";
import { Sheet } from "../../shared/components/Sheet";
import { formatEvidenceDate, formatRecordedDuration } from "./timeFormat";

interface TimeEvidenceSheetProps {
  open: boolean;
  title: string;
  recordIds: number[];
  logs: ApiTimeLogRead[];
  projects: PlanProject[];
  onClose: () => void;
}

export function TimeEvidenceSheet({
  open,
  title,
  recordIds,
  logs,
  projects,
  onClose,
}: TimeEvidenceSheetProps) {
  const logsById = new Map(logs.map((log) => [log.id, log]));
  const records = recordIds
    .map((recordId) => logsById.get(recordId))
    .filter((record): record is ApiTimeLogRead => record !== undefined && record.deleted_at === null);
  const unavailableCount = recordIds.length - records.length;
  const totalSeconds = records.reduce(
    (total, record) => total + Math.max(0, Math.trunc(record.duration_seconds)),
    0
  );
  const projectTitles = new Map(projects.map((project) => [project.id, project.title]));

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3 border-b border-desk-line pb-3">
          <span className="text-sm text-desk-muted">
            {records.length} {records.length === 1 ? "record" : "records"}
          </span>
          <span className="text-sm font-semibold tabular-nums text-desk-ink">
            {formatRecordedDuration(totalSeconds)}
          </span>
        </div>

        {unavailableCount > 0 ? (
          <p role="status" className="rounded-lg bg-desk-warn-soft px-3 py-2 text-sm text-desk-ink">
            {unavailableCount} source {unavailableCount === 1 ? "record is" : "records are"} unavailable.
          </p>
        ) : null}

        {records.length === 0 ? (
          <p className="py-8 text-center text-sm text-desk-muted">No recorded time</p>
        ) : (
          <ol className="space-y-2">
            {records.map((record) => (
              <li
                key={record.id}
                className="rounded-paper border border-desk-line bg-desk-raised p-3"
                data-record-id={record.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="whitespace-normal text-sm font-semibold leading-snug text-desk-ink">
                      {record.activity_name}
                    </p>
                    <p className="mt-1 whitespace-normal text-xs leading-snug text-desk-muted">
                      {projectTitle(record.project_id ?? null, projectTitles)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-desk-ink">
                    {formatRecordedDuration(record.duration_seconds)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-desk-subtle">
                  {formatEvidenceDate(record.date)} · Record {record.id}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Sheet>
  );
}

function projectTitle(
  projectId: number | null,
  projectTitles: Map<number, string>
): string {
  if (projectId === null) return "Unassigned";
  return projectTitles.get(projectId) ?? "Unknown project";
}
