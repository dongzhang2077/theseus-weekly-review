import type { EvidenceTrace as EvidenceTraceModel } from "../api/weeklyReview";

interface EvidenceTraceProps {
  trace?: EvidenceTraceModel;
}

export function EvidenceTrace({ trace }: EvidenceTraceProps) {
  if (!trace) return null;

  const rows = [
    { label: "Range", value: trace.range },
    { label: "Source", value: trace.source },
    { label: "Related", value: trace.relatedTo },
    { label: "Records", value: trace.records },
    { label: "Rule", value: trace.judgement }
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  return (
    <section className="evidence-trace" aria-label="Evidence trace">
      <div className="evidence-trace-title">Evidence trace</div>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
