import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  correctPreference,
  createProposalOutcome,
  createPreference,
  decideProposal,
  deletePreference,
  loadPersonalizationBaseline,
  loadPreferenceDetail,
  loadPreferences,
  loadProposalDetail,
  loadProposals,
  restorePreference,
  updateProposalOutcomeConsent,
  type JsonMap,
  type PersonalizationBaseline,
  type PreferenceDetail,
  type PreferenceRecord,
  type ProposalDetail,
  type ProposalOutcomeRecord,
  type ProposalRecord
} from "../../shared/api/agentMemory";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import { Icon, type IconName } from "../../shared/icons/Icon";

interface AssistantWorkspaceProps {
  open: boolean;
  apiBaseUrl: string;
  fetchImpl: FetchLike;
  onClose: () => void;
}

type Section = "pending" | "history" | "memory";
type Route =
  | { kind: "summary" }
  | { kind: "section"; section: Section }
  | { kind: "baseline" }
  | { kind: "proposal"; id: number }
  | { kind: "preference"; id: number }
  | { kind: "new-preference" };

export function AssistantWorkspace({
  open,
  apiBaseUrl,
  fetchImpl,
  onClose
}: AssistantWorkspaceProps) {
  const options = useMemo(() => ({ apiBaseUrl, fetchImpl }), [apiBaseUrl, fetchImpl]);
  const [route, setRoute] = useState<Route>({ kind: "summary" });
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [preferences, setPreferences] = useState<PreferenceRecord[]>([]);
  const [baseline, setBaseline] = useState<PersonalizationBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!open) {
      setRoute({ kind: "summary" });
      return;
    }
    let ignore = false;
    setLoading(true);
    setError(null);
    Promise.all([
      loadProposals(options),
      loadPreferences(options),
      loadPersonalizationBaseline(options)
    ]).then(
      ([proposalResult, preferenceResult, baselineResult]) => {
        if (ignore) return;
        if (proposalResult.status !== "ok" || !proposalResult.data) {
          setError(proposalResult.error ?? "Proposals could not be loaded.");
        } else if (preferenceResult.status !== "ok" || !preferenceResult.data) {
          setError(preferenceResult.error ?? "Preferences could not be loaded.");
        } else {
          setProposals(proposalResult.data);
          setPreferences(preferenceResult.data);
          setBaseline(
            baselineResult.status === "ok" ? baselineResult.data : null
          );
        }
        setLoading(false);
      }
    );
    return () => {
      ignore = true;
    };
  }, [open, options, reload]);

  if (!open) return null;

  const pending = proposals.filter((proposal) => proposal.status === "pending");
  const history = proposals.filter((proposal) => proposal.status !== "pending");
  const activePreferences = preferences.filter((preference) => !preference.deleted_at);

  function back() {
    if (route.kind === "summary") {
      onClose();
      return;
    }
    if (route.kind === "proposal") {
      const proposal = proposals.find((item) => item.id === route.id);
      setRoute({ kind: "section", section: proposal?.status === "pending" ? "pending" : "history" });
      return;
    }
    if (route.kind === "preference" || route.kind === "new-preference") {
      setRoute({ kind: "section", section: "memory" });
      return;
    }
    setRoute({ kind: "summary" });
  }

  return (
    <section
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-desk-paper text-desk-ink"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-title"
    >
      <AssistantHeader
        title={routeTitle(route)}
        onBack={back}
        action={route.kind === "section" && route.section === "memory"
          ? (
              <button className={iconButtonClass} type="button" aria-label="New preference" onClick={() => setRoute({ kind: "new-preference" })}>
                <Icon name="plus" className="size-5" />
              </button>
            )
          : null}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
        {loading ? <WorkspaceState icon="layers" title="Loading" /> : null}
        {!loading && error ? (
          <WorkspaceState icon="info" title="Assistant data could not be loaded.">
            <button className={secondaryButtonClass} type="button" onClick={() => setReload((value) => value + 1)}>Retry</button>
          </WorkspaceState>
        ) : null}
        {!loading && !error && route.kind === "summary" ? (
          <AssistantSummary
            pending={pending}
            history={history}
            preferences={activePreferences}
            baseline={baseline}
            onOpen={(section) => setRoute({ kind: "section", section })}
            onOpenBaseline={() => setRoute({ kind: "baseline" })}
          />
        ) : null}
        {!loading && !error && route.kind === "section" ? (
          <AssistantSection
            section={route.section}
            pending={pending}
            history={history}
            preferences={preferences}
            onSection={(section) => setRoute({ kind: "section", section })}
            onProposal={(id) => setRoute({ kind: "proposal", id })}
            onPreference={(id) => setRoute({ kind: "preference", id })}
            onNewPreference={() => setRoute({ kind: "new-preference" })}
          />
        ) : null}
        {!loading && !error && route.kind === "proposal" ? (
          <ProposalDetailView
            id={route.id}
            options={options}
            onBaselineChanged={setBaseline}
            onChanged={(detail) => {
              setProposals((current) =>
                current.map((item) => item.id === detail.proposal.id ? detail.proposal : item)
              );
            }}
          />
        ) : null}
        {!loading && !error && route.kind === "baseline" ? (
          <BaselineDetail baseline={baseline} />
        ) : null}
        {!loading && !error && route.kind === "preference" ? (
          <PreferenceDetailView
            id={route.id}
            options={options}
            onChanged={(preference) => {
              setPreferences((current) =>
                current.map((item) => item.id === preference.id ? preference : item)
              );
            }}
          />
        ) : null}
        {!loading && !error && route.kind === "new-preference" ? (
          <NewPreferenceView
            options={options}
            onCreated={(preference) => {
              setPreferences((current) => [preference, ...current]);
              setRoute({ kind: "preference", id: preference.id });
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

function AssistantHeader({ title, onBack, action }: { title: string; onBack: () => void; action?: ReactNode }) {
  return (
    <header className="grid min-h-[58px] grid-cols-[44px_1fr_44px] items-center border-b border-desk-line px-2">
      <button className={iconButtonClass} type="button" aria-label="Back" onClick={onBack}>
        <Icon name="chevronLeft" className="size-5" />
      </button>
      <h2 id="assistant-title" className="m-0 text-center text-lg font-bold">{title}</h2>
      <div className="grid size-11 place-items-center">{action}</div>
    </header>
  );
}

function AssistantSummary({
  pending,
  history,
  preferences,
  baseline,
  onOpen,
  onOpenBaseline
}: {
  pending: ProposalRecord[];
  history: ProposalRecord[];
  preferences: PreferenceRecord[];
  baseline: PersonalizationBaseline | null;
  onOpen: (section: Section) => void;
  onOpenBaseline: () => void;
}) {
  const lastDecision = [...history].sort(byUpdatedAt)[0];
  return (
    <div>
      <p className="mb-5 mt-1 max-w-[30ch] text-sm leading-6 text-desk-muted">
        Review what the assistant suggests, remembers, and learns.
      </p>
      <div className="overflow-hidden rounded-[16px] border border-desk-line bg-desk-raised shadow-paper">
        <SummaryRow icon="fileText" label="Pending" value={pending.length ? String(pending.length) : "None"} onClick={() => onOpen("pending")} />
        <SummaryRow icon="check" label="History" value={lastDecision ? `${statusLabel(lastDecision.status)} · ${shortDate(lastDecision.updated_at)}` : "None"} onClick={() => onOpen("history")} />
        <SummaryRow icon="layers" label="Memory" value={String(preferences.length)} onClick={() => onOpen("memory")} />
        <SummaryRow
          icon="gauge"
          label="Baseline"
          value={baseline?.status === "ready"
            ? "Ready"
            : baseline
              ? `${baseline.consented_outcome_count}/${baseline.minimum_outcomes}`
              : "Unavailable"}
          onClick={onOpenBaseline}
        />
      </div>
      <div className="mt-5 rounded-[14px] border border-desk-line bg-desk-sunk px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-desk-muted">Your control</div>
        <p className="mb-0 mt-1 text-sm leading-5 text-desk-ink">
          No assistant action is approved without you. Saved memory can be corrected or removed.
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value, onClick }: { icon: IconName; label: string; value: string; onClick: () => void }) {
  return (
    <button className="grid min-h-[72px] w-full grid-cols-[42px_minmax(0,1fr)_auto_20px] items-center gap-2 border-0 border-b border-desk-line bg-transparent px-4 text-left last:border-b-0 hover:bg-desk-sunk" type="button" onClick={onClick}>
      <span className="grid size-9 place-items-center rounded-full bg-desk-accent-soft text-desk-accent" aria-hidden="true"><Icon name={icon} className="size-5" /></span>
      <span className="font-bold">{label}</span>
      <span className="max-w-36 truncate text-sm text-desk-muted">{value}</span>
      <Icon name="chevronRight" className="size-4 text-desk-subtle" />
    </button>
  );
}

function BaselineDetail({ baseline }: { baseline: PersonalizationBaseline | null }) {
  if (!baseline) {
    return (
      <WorkspaceState
        icon="info"
        title="Baseline unavailable"
        body="Reopen Assistant to retry."
      />
    );
  }

  const ready = baseline.status === "ready";
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-xl leading-7">
            {ready ? "Ready for evaluation" : "Collecting feedback"}
          </h3>
          <p className="mb-0 mt-1 text-sm leading-5 text-desk-muted">
            {ready
              ? "Enough consented outcomes for a first offline comparison."
              : `${baseline.remaining_outcome_count} more consented ${baseline.remaining_outcome_count === 1 ? "outcome" : "outcomes"} needed.`}
          </p>
        </div>
        <Tag tone={ready ? "accent" : "warn"}>{ready ? "Ready" : "Collecting"}</Tag>
      </div>

      <DetailSection title="Readiness">
        <MetaRow
          label="Consented outcomes"
          value={`${baseline.consented_outcome_count}/${baseline.minimum_outcomes}`}
        />
        <MetaRow label="Remaining" value={String(baseline.remaining_outcome_count)} />
        <MetaRow label="Ranking" value="Not applied" />
      </DetailSection>

      <DetailSection title="Included outcomes">
        {baseline.groups.length ? (
          <div className="border-t border-desk-line">
            {baseline.groups.map((group) => (
              <BaselineGroup key={group.proposal_type} group={group} />
            ))}
          </div>
        ) : (
          <p className={bodyClass}>No consented outcomes.</p>
        )}
      </DetailSection>

      <Disclosure title="How it is counted">
        <p className={bodyClass}>
          Only feedback with current consent is included. Partial results count
          as half completion; dismissed results are excluded.
        </p>
      </Disclosure>
    </div>
  );
}

function BaselineGroup({
  group
}: {
  group: PersonalizationBaseline["groups"][number];
}) {
  const results = [
    `${group.completed_count} done`,
    `${group.partial_count} partial`,
    `${group.not_completed_count} not done`,
    `${group.dismissed_count} dismissed`
  ].join(" · ");
  return (
    <section className="border-b border-desk-line py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <h4 className="m-0 min-w-0 text-sm font-bold">
          {humanize(group.proposal_type)}
        </h4>
        <span className="shrink-0 text-xs text-desk-muted">
          {group.outcome_count}
        </span>
      </div>
      <MetaRow
        label="Usefulness"
        value={group.average_usefulness === null
          ? "Not rated"
          : `${group.average_usefulness.toFixed(1)}/5`}
      />
      <MetaRow
        label="Completion"
        value={group.completion_rate === null
          ? "Not available"
          : `${Math.round(group.completion_rate * 100)}%`}
      />
      <MetaRow label="Results" value={results} />
    </section>
  );
}

function AssistantSection({
  section,
  pending,
  history,
  preferences,
  onSection,
  onProposal,
  onPreference,
  onNewPreference
}: {
  section: Section;
  pending: ProposalRecord[];
  history: ProposalRecord[];
  preferences: PreferenceRecord[];
  onSection: (section: Section) => void;
  onProposal: (id: number) => void;
  onPreference: (id: number) => void;
  onNewPreference: () => void;
}) {
  const [showDeleted, setShowDeleted] = useState(false);
  const visiblePreferences = preferences.filter((preference) =>
    showDeleted ? Boolean(preference.deleted_at) : !preference.deleted_at
  );
  return (
    <div>
      <div className="grid grid-cols-3 rounded-[13px] bg-desk-sunk p-1" role="tablist" aria-label="Assistant sections">
        {(["pending", "history", "memory"] as const).map((item) => (
          <button className={`min-h-10 rounded-[10px] border-0 px-2 text-xs font-bold ${section === item ? "bg-desk-raised text-desk-accent shadow-paper" : "bg-transparent text-desk-muted"}`} key={item} type="button" role="tab" aria-selected={section === item} onClick={() => onSection(item)}>
            {sectionLabel(item)}
          </button>
        ))}
      </div>
      {section === "pending" ? (
        <RecordList emptyTitle="No proposals" emptyBody="Plan proposals from your assistant appear here." records={pending} render={(proposal) => <ProposalRow key={proposal.id} proposal={proposal} onClick={() => onProposal(proposal.id)} />} />
      ) : null}
      {section === "history" ? (
        <RecordList emptyTitle="No decisions yet." records={[...history].sort(byUpdatedAt)} render={(proposal) => <ProposalRow key={proposal.id} proposal={proposal} onClick={() => onProposal(proposal.id)} />} />
      ) : null}
      {section === "memory" ? (
        <>
          <div className="mt-4 flex min-h-11 items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-desk-muted">{showDeleted ? "Deleted" : "Active"}</span>
            <button className={`${iconButtonClass} ${showDeleted ? "bg-desk-danger-soft text-desk-danger" : ""}`} type="button" aria-label={showDeleted ? "Show active preferences" : "Show deleted preferences"} aria-pressed={showDeleted} onClick={() => setShowDeleted((value) => !value)}>
              <Icon name={showDeleted ? "undo" : "trash"} className="size-4" />
            </button>
          </div>
          <RecordList
            emptyTitle={showDeleted ? "No deleted preferences" : "No preferences"}
            emptyBody={showDeleted ? undefined : "Saved preferences guide future proposals."}
            action={!showDeleted ? <button className={secondaryButtonClass} type="button" onClick={onNewPreference}>Add</button> : undefined}
            records={visiblePreferences}
            render={(preference) => <PreferenceRow key={preference.id} preference={preference} onClick={() => onPreference(preference.id)} />}
          />
        </>
      ) : null}
    </div>
  );
}

function RecordList<T>({ records, render, emptyTitle, emptyBody, action }: { records: T[]; render: (record: T) => ReactNode; emptyTitle: string; emptyBody?: string; action?: ReactNode }) {
  if (!records.length) {
    return <WorkspaceState icon="layers" title={emptyTitle} body={emptyBody}>{action}</WorkspaceState>;
  }
  return <div className="mt-4 overflow-hidden rounded-[16px] border border-desk-line bg-desk-raised">{records.map(render)}</div>;
}

function ProposalRow({ proposal, onClick }: { proposal: ProposalRecord; onClick: () => void }) {
  return (
    <button className={recordRowClass} type="button" onClick={onClick}>
      <span className="min-w-0"><span className="line-clamp-2 block font-bold leading-5">{proposal.title}</span><span className="mt-1 block text-xs text-desk-muted">{shortDate(proposal.updated_at)}</span></span>
      <Tag tone={proposal.status === "rejected" || proposal.status === "expired" ? "danger" : "accent"}>{proposal.status === "pending" ? proposalTypeLabel(proposal.proposal_type) : statusLabel(proposal.status)}</Tag>
      <Icon name="chevronRight" className="size-4 shrink-0 text-desk-subtle" />
    </button>
  );
}

function PreferenceRow({ preference, onClick }: { preference: PreferenceRecord; onClick: () => void }) {
  return (
    <button className={recordRowClass} type="button" onClick={onClick}>
      <span className="min-w-0"><span className="line-clamp-2 block font-bold leading-5">{humanize(preference.preference_key)}</span><span className="mt-1 line-clamp-1 block text-xs text-desk-muted">{displayValue(preference.value)}</span></span>
      <Tag tone={preference.source === "inferred" ? "warn" : "accent"}>{preference.source === "inferred" ? "Inferred" : "Stated"}</Tag>
      <Icon name="chevronRight" className="size-4 shrink-0 text-desk-subtle" />
    </button>
  );
}

function ProposalDetailView({ id, options, onChanged, onBaselineChanged }: { id: number; options: { apiBaseUrl: string; fetchImpl: FetchLike }; onChanged: (detail: ProposalDetail) => void; onBaselineChanged: (baseline: PersonalizationBaseline) => void }) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedAfter, setEditedAfter] = useState<JsonMap>({});
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    loadProposalDetail(options, id).then((result) => {
      if (ignore) return;
      if (result.status === "ok" && result.data) {
        setDetail(result.data);
        setEditedAfter(result.data.proposal.after);
      } else {
        setError(result.error ?? "Proposal could not be loaded.");
      }
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [id, options, reload]);

  async function decide(decision: "approve" | "reject") {
    if (!detail || busy) return;
    setBusy(true);
    setError(null);
    const result = await decideProposal(options, detail.proposal, decision === "approve" && editing ? "edit" : decision, editing ? editedAfter : undefined);
    setBusy(false);
    setConfirm(null);
    if (result.status === "ok" && result.data) {
      setDetail(result.data);
      setEditing(false);
      onChanged(result.data);
      return;
    }
    setError(result.status === "conflict" ? "This proposal changed while open. Reload to review the latest." : result.error ?? "The decision could not be saved.");
  }

  if (loading) return <WorkspaceState icon="fileText" title="Loading" />;
  if (!detail) {
    return <WorkspaceState icon="info" title={error ?? "Proposal could not be loaded."}><button className={secondaryButtonClass} type="button" onClick={() => setReload((value) => value + 1)}>Retry</button></WorkspaceState>;
  }

  const proposal = detail.proposal;
  return (
    <div className="pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="m-0 text-xl leading-7">{proposal.title}</h3><p className="mb-0 mt-1 text-xs text-desk-muted">{shortDate(proposal.created_at)}</p></div>
        <Tag tone={proposal.status === "rejected" || proposal.status === "expired" ? "danger" : "accent"}>{proposal.status === "pending" ? proposalTypeLabel(proposal.proposal_type) : statusLabel(proposal.status)}</Tag>
      </div>
      {proposal.rationale ? <DetailSection title="Why"><p className={bodyClass}>{proposal.rationale}</p></DetailSection> : null}
      <DetailSection title="Change"><ChangeFields before={proposal.before} after={editedAfter} editing={editing} onChange={(key, value) => setEditedAfter((current) => ({ ...current, [key]: value }))} /></DetailSection>
      <Disclosure title={`Evidence · ${proposal.evidence.length}`}>
        {proposal.evidence.length ? proposal.evidence.map((item, index) => <JsonSummary key={index} value={item} />) : <p className={bodyClass}>No evidence attached.</p>}
      </Disclosure>
      <Disclosure title={`Timeline · ${detail.decisions.length + detail.actions.length + detail.outcomes.length}`}><Timeline detail={detail} /></Disclosure>
      {proposal.status !== "pending" ? (
        <OutcomeFeedback
          detail={detail}
          options={options}
          onChanged={(outcome) => {
            setDetail((current) => current
              ? {
                  ...current,
                  outcomes: current.outcomes.some((item) => item.id === outcome.id)
                    ? current.outcomes.map((item) => item.id === outcome.id ? outcome : item)
                    : [...current.outcomes, outcome]
                }
              : current);
            void loadPersonalizationBaseline(options).then((result) => {
              if (result.status === "ok" && result.data) {
                onBaselineChanged(result.data);
              }
            });
          }}
        />
      ) : null}
      {error ? <InlineError message={error} /> : null}
      {proposal.status === "pending" ? (
        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-desk-line bg-desk-paper/95 px-4 py-3 backdrop-blur-sm">
          {confirm ? (
            <div className="w-full">
              <p className="mb-2 mt-0 text-center text-sm font-bold">{confirm === "approve" ? "Approve this proposal?" : "Reject this proposal?"}</p>
              <div className="grid grid-cols-2 gap-2">
                <button className={secondaryButtonClass} type="button" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
                <button className={confirm === "reject" ? dangerButtonClass : primaryButtonClass} type="button" disabled={busy} onClick={() => decide(confirm)}>{busy ? "Saving" : confirm === "reject" ? "Reject" : "Approve"}</button>
              </div>
            </div>
          ) : (
            <div className="grid w-full grid-cols-[1fr_48px_1fr] gap-2">
              <button className={dangerButtonClass} type="button" onClick={() => setConfirm("reject")}>Reject</button>
              <button className={`${iconButtonClass} border border-desk-line bg-desk-raised`} type="button" aria-label={editing ? "Cancel editing" : "Edit proposal"} aria-pressed={editing} onClick={() => { setEditing((value) => !value); setEditedAfter(proposal.after); }}>
                <Icon name={editing ? "x" : "edit"} className="size-5" />
              </button>
              <button className={primaryButtonClass} type="button" onClick={() => setConfirm("approve")}>Approve</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OutcomeFeedback({
  detail,
  options,
  onChanged
}: {
  detail: ProposalDetail;
  options: { apiBaseUrl: string; fetchImpl: FetchLike };
  onChanged: (outcome: ProposalOutcomeRecord) => void;
}) {
  const existing = detail.outcomes[detail.outcomes.length - 1];
  const [result, setResult] = useState<ProposalOutcomeRecord["result"]>("completed");
  const [usefulness, setUsefulness] = useState("3");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const response = await createProposalOutcome(
      options,
      detail.proposal.id,
      {
        result,
        usefulness: Number(usefulness),
        note: note.trim(),
        personalizationConsent: consent
      }
    );
    setBusy(false);
    if (response.status === "ok" && response.data) {
      onChanged(response.data);
      return;
    }
    setError(response.error ?? "Outcome could not be saved.");
  }

  async function changeConsent(personalizationConsent: boolean) {
    if (!existing || busy) return;
    setBusy(true);
    setError(null);
    const response = await updateProposalOutcomeConsent(
      options,
      detail.proposal.id,
      existing,
      personalizationConsent
    );
    setBusy(false);
    if (response.status === "ok" && response.data) {
      onChanged(response.data);
      return;
    }
    setError(response.status === "conflict"
      ? "Consent changed while open. Reopen this proposal."
      : response.error ?? "Consent could not be updated.");
  }

  if (existing) {
    return (
      <DetailSection title="Outcome">
        <MetaRow label="Result" value={humanize(existing.result)} />
        <MetaRow label="Usefulness" value={existing.usefulness === null ? "Not rated" : `${existing.usefulness}/5`} />
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={existing.personalization_consent}
            disabled={busy}
            onChange={(event) => changeConsent(event.currentTarget.checked)}
          />
          Use for future suggestions
        </label>
        {error ? <InlineError message={error} /> : null}
      </DetailSection>
    );
  }

  return (
    <DetailSection title="Outcome">
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Result
          <select
            className={fieldClass}
            value={result}
            onChange={(event) => setResult(event.currentTarget.value as ProposalOutcomeRecord["result"])}
          >
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="not_completed">Not completed</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
        <label className={labelClass}>
          Usefulness
          <select className={fieldClass} value={usefulness} onChange={(event) => setUsefulness(event.currentTarget.value)}>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}/5</option>)}
          </select>
        </label>
      </div>
      <label className={`${labelClass} mt-3`}>
        Note
        <textarea className={`${fieldClass} min-h-20 py-3`} value={note} maxLength={4000} onChange={(event) => setNote(event.currentTarget.value)} />
      </label>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-bold">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.currentTarget.checked)} />
        Use for future suggestions
      </label>
      {error ? <InlineError message={error} /> : null}
      <button className={`${primaryButtonClass} mt-3`} type="button" disabled={busy} onClick={save}>{busy ? "Saving" : "Save"}</button>
    </DetailSection>
  );
}

function ChangeFields({ before, after, editing, onChange }: { before: JsonMap; after: JsonMap; editing: boolean; onChange: (key: string, value: unknown) => void }) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  if (!keys.length) return <p className={bodyClass}>No field changes.</p>;
  return (
    <div className="overflow-hidden rounded-[12px] border border-desk-line bg-desk-raised">
      {keys.map((key) => (
        <div className="border-b border-desk-line p-3 last:border-b-0" key={key}>
          <div className="mb-1 text-xs font-bold text-desk-muted">{humanize(key)}</div>
          {editing ? (
            <input className={fieldClass} aria-label={humanize(key)} value={editableValue(after[key])} onChange={(event) => onChange(key, coerceValue(event.currentTarget.value, after[key]))} />
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-start gap-2 text-sm">
              <span className="break-words text-desk-muted">{displayValue(before[key])}</span><Icon name="chevronRight" className="mt-0.5 size-4 text-desk-subtle" /><span className="break-words font-bold">{displayValue(after[key])}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PreferenceDetailView({ id, options, onChanged }: { id: number; options: { apiBaseUrl: string; fetchImpl: FetchLike }; onChanged: (preference: PreferenceRecord) => void }) {
  const [detail, setDetail] = useState<PreferenceDetail | null>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    loadPreferenceDetail(options, id).then((result) => {
      if (ignore) return;
      if (result.status === "ok" && result.data) {
        setDetail(result.data);
        setValue(editableValue(result.data.preference.value));
        setError(null);
      } else setError(result.error ?? "Preference could not be loaded.");
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [id, options]);

  async function save() {
    if (!detail || busy) return;
    setBusy(true);
    setError(null);
    const result = await correctPreference(options, detail.preference, parseValue(value));
    setBusy(false);
    if (result.status === "ok" && result.data) {
      const preference = result.data.preference;
      setDetail((current) => current ? { ...current, preference } : current);
      setEditing(false);
      onChanged(preference);
    } else setError(result.status === "conflict" ? "This preference changed while open. Reopen it to review the latest." : result.error ?? "Preference could not be saved.");
  }

  async function removeOrRestore() {
    if (!detail || busy) return;
    setBusy(true);
    setError(null);
    const result = detail.preference.deleted_at ? await restorePreference(options, detail.preference) : await deletePreference(options, detail.preference);
    setBusy(false);
    setConfirmDelete(false);
    if (result.status === "ok" && result.data) {
      const preference = result.data.preference;
      setDetail((current) => current ? { ...current, preference } : current);
      onChanged(preference);
    } else setError(result.error ?? "Preference could not be updated.");
  }

  if (loading) return <WorkspaceState icon="layers" title="Loading" />;
  if (!detail) return <WorkspaceState icon="info" title={error ?? "Preference could not be loaded."} />;
  const preference = detail.preference;
  return (
    <div className="pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="m-0 break-words text-xl leading-7">{humanize(preference.preference_key)}</h3><p className="mb-0 mt-1 text-xs text-desk-muted">{scopeLabel(preference)}</p></div>
        <Tag tone={preference.deleted_at ? "danger" : preference.source === "inferred" ? "warn" : "accent"}>{preference.deleted_at ? "Deleted" : preference.source === "inferred" ? "Inferred" : "Stated"}</Tag>
      </div>
      <DetailSection title="Preference">
        {editing ? <textarea className={`${fieldClass} min-h-28 py-3`} aria-label="Preference value" value={value} onChange={(event) => setValue(event.currentTarget.value)} /> : <p className={`${bodyClass} break-words`}>{displayValue(preference.value)}</p>}
      </DetailSection>
      <DetailSection title="Source">
        <p className={bodyClass}>{preference.source === "inferred" ? `Inferred from your records${preference.confidence === null ? "" : ` · ${Math.round(preference.confidence * 100)}% confidence`}.` : "You told the assistant."}</p>
        {preference.review_after ? <MetaRow label="Review" value={longDate(preference.review_after)} /> : null}
        {preference.expires_at ? <MetaRow label="Expires" value={longDate(preference.expires_at)} /> : null}
      </DetailSection>
      <Disclosure title={`Timeline · ${detail.revisions.length}`}>{detail.revisions.length ? detail.revisions.map((revision) => <MetaRow key={revision.id} label={humanize(revision.action)} value={shortDate(revision.created_at)} />) : <p className={bodyClass}>No changes yet.</p>}</Disclosure>
      {error ? <InlineError message={error} /> : null}
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-desk-line bg-desk-paper/95 px-4 py-3 backdrop-blur-sm">
        {preference.deleted_at ? (
          <button className={primaryButtonClass} type="button" disabled={busy} onClick={removeOrRestore}>{busy ? "Restoring" : "Restore"}</button>
        ) : confirmDelete ? (
          <div className="w-full">
            <p className="mb-2 mt-0 text-center text-sm font-bold">Delete this preference?</p>
            <div className="grid grid-cols-2 gap-2"><button className={secondaryButtonClass} type="button" onClick={() => setConfirmDelete(false)}>Cancel</button><button className={dangerButtonClass} type="button" disabled={busy} onClick={removeOrRestore}>{busy ? "Deleting" : "Delete"}</button></div>
          </div>
        ) : editing ? (
          <div className="grid w-full grid-cols-2 gap-2"><button className={secondaryButtonClass} type="button" onClick={() => { setEditing(false); setValue(editableValue(preference.value)); }}>Cancel</button><button className={primaryButtonClass} type="button" disabled={busy || !value.trim()} onClick={save}>{busy ? "Saving" : "Save"}</button></div>
        ) : (
          <div className="grid w-full grid-cols-[48px_1fr] gap-2"><button className={dangerIconButtonClass} type="button" aria-label="Delete preference" onClick={() => setConfirmDelete(true)}><Icon name="trash" className="size-5" /></button><button className={primaryButtonClass} type="button" onClick={() => setEditing(true)}>Edit</button></div>
        )}
      </div>
    </div>
  );
}

function NewPreferenceView({ options, onCreated }: { options: { apiBaseUrl: string; fetchImpl: FetchLike }; onCreated: (preference: PreferenceRecord) => void }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function add() {
    if (!key.trim() || !value.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await createPreference(options, { preferenceKey: key.trim(), value: parseValue(value) });
    setBusy(false);
    if (result.status === "ok" && result.data) onCreated(result.data);
    else setError(result.error ?? "Preference could not be added.");
  }
  return (
    <div>
      <p className="mb-5 mt-1 text-sm leading-6 text-desk-muted">Add something the assistant should remember when making future proposals.</p>
      <label className={labelClass}>Name<input className={fieldClass} value={key} onChange={(event) => setKey(event.currentTarget.value)} placeholder="Preferred focus length" /></label>
      <label className={`${labelClass} mt-4`}>Preference<textarea className={`${fieldClass} min-h-28 py-3`} value={value} onChange={(event) => setValue(event.currentTarget.value)} placeholder="45 minutes" /></label>
      {error ? <InlineError message={error} /> : null}
      <button className={`${primaryButtonClass} mt-5`} type="button" disabled={busy || !key.trim() || !value.trim()} onClick={add}>{busy ? "Adding" : "Add"}</button>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-5"><h4 className={sectionTitleClass}>{title}</h4>{children}</section>;
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return <details className="mt-4 rounded-[14px] border border-desk-line bg-desk-raised px-4 py-3"><summary className="cursor-pointer text-sm font-bold text-desk-ink">{title}</summary><div className="mt-3 border-t border-desk-line pt-2">{children}</div></details>;
}

function Timeline({ detail }: { detail: ProposalDetail }) {
  const entries = [
    ...detail.decisions.map((item) => ({ id: `decision-${item.id}`, label: statusLabel(item.decision), date: item.created_at })),
    ...detail.actions.map((item) => ({ id: `action-${item.id}`, label: humanize(item.operation), date: item.created_at })),
    ...detail.outcomes.map((item) => ({ id: `outcome-${item.id}`, label: humanize(item.result), date: item.created_at }))
  ].sort((left, right) => right.date.localeCompare(left.date));
  if (!entries.length) return <p className={bodyClass}>No decisions yet.</p>;
  return <>{entries.map((entry) => <MetaRow key={entry.id} label={entry.label} value={shortDate(entry.date)} />)}</>;
}

function JsonSummary({ value }: { value: JsonMap }) {
  return <div className="border-b border-desk-line py-2 text-sm last:border-b-0">{Object.entries(value).map(([key, item]) => <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3" key={key}><span className="text-desk-muted">{humanize(key)}</span><span className="break-words text-right font-bold">{displayValue(item)}</span></div>)}</div>;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-desk-line py-2 text-sm last:border-b-0"><span className="text-desk-muted">{label}</span><span className="max-w-48 break-words text-right font-bold">{value}</span></div>;
}

function WorkspaceState({ icon, title, body, children }: { icon: IconName; title: string; body?: string; children?: ReactNode }) {
  return <div className="grid min-h-64 place-items-center px-6 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-desk-accent-soft text-desk-accent"><Icon name={icon} className="size-6" /></span><h3 className="mb-0 mt-4 text-lg">{title}</h3>{body ? <p className="mb-0 mt-2 text-sm leading-5 text-desk-muted">{body}</p> : null}{children ? <div className="mt-4">{children}</div> : null}</div></div>;
}

function Tag({ children, tone }: { children: ReactNode; tone: "accent" | "warn" | "danger" }) {
  const color = tone === "danger" ? "bg-desk-danger-soft text-desk-danger" : tone === "warn" ? "bg-desk-warn-soft text-desk-warn" : "bg-desk-accent-soft text-desk-accent";
  return <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${color}`}>{children}</span>;
}

function InlineError({ message }: { message: string }) {
  return <div className="mt-4 rounded-[12px] border border-desk-danger/30 bg-desk-danger-soft px-3 py-2 text-sm font-medium text-desk-danger" role="alert">{message}</div>;
}

function routeTitle(route: Route): string {
  if (route.kind === "section") return sectionLabel(route.section);
  if (route.kind === "baseline") return "Baseline";
  if (route.kind === "proposal") return "Proposal";
  if (route.kind === "preference") return "Memory";
  if (route.kind === "new-preference") return "New memory";
  return "Assistant";
}

function sectionLabel(section: Section): string {
  if (section === "pending") return "Pending";
  if (section === "history") return "History";
  return "Memory";
}

function proposalTypeLabel(type: ProposalRecord["proposal_type"]): string {
  if (type === "weekly_plan_adjustment") return "Plan";
  if (type === "task_create") return "Task";
  if (type === "reflection") return "Review";
  return "Proposal";
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function humanize(value: string): string {
  const text = value.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Value";
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "None";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return JSON.stringify(value);
}

function editableValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function parseValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try { return JSON.parse(trimmed) as unknown; } catch { return trimmed; }
}

function coerceValue(value: string, previous: unknown): unknown {
  if (typeof previous === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (typeof previous === "boolean") return value === "true";
  if (previous && typeof previous === "object") return parseValue(value);
  return value;
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function longDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function scopeLabel(preference: PreferenceRecord): string {
  return preference.scope_type === "global" ? "All plans" : `${humanize(preference.scope_type)} ${preference.scope_ref_id ?? ""}`.trim();
}

function byUpdatedAt(left: ProposalRecord, right: ProposalRecord): number {
  return right.updated_at.localeCompare(left.updated_at);
}

const iconButtonClass = "grid size-11 shrink-0 place-items-center rounded-[12px] border-0 bg-transparent text-desk-muted outline-none hover:bg-desk-sunk hover:text-desk-ink focus-visible:ring-2 focus-visible:ring-desk-accent";
const recordRowClass = "grid min-h-[68px] w-full grid-cols-[minmax(0,1fr)_auto_18px] items-center gap-3 border-0 border-b border-desk-line bg-transparent px-4 py-3 text-left text-desk-ink last:border-b-0 hover:bg-desk-sunk";
const fieldClass = "min-h-12 w-full rounded-[12px] border border-desk-line bg-desk-raised px-3 text-base text-desk-ink outline-none focus:border-desk-accent focus:ring-2 focus:ring-desk-accent-soft";
const labelClass = "flex flex-col gap-1.5 text-sm font-bold";
const sectionTitleClass = "mb-2 mt-0 text-[11px] font-bold uppercase tracking-[0.12em] text-desk-muted";
const bodyClass = "m-0 text-sm leading-6 text-desk-ink";
const primaryButtonClass = "min-h-12 w-full rounded-[12px] border border-desk-accent bg-desk-accent px-4 text-sm font-bold text-white shadow-paper disabled:cursor-not-allowed disabled:border-desk-line disabled:bg-desk-sunk disabled:text-desk-subtle";
const secondaryButtonClass = "min-h-12 w-full rounded-[12px] border border-desk-line bg-desk-raised px-4 text-sm font-bold text-desk-ink disabled:text-desk-subtle";
const dangerButtonClass = "min-h-12 w-full rounded-[12px] border border-desk-danger/35 bg-desk-danger-soft px-4 text-sm font-bold text-desk-danger disabled:text-desk-subtle";
const dangerIconButtonClass = "grid size-12 place-items-center rounded-[12px] border border-desk-danger/35 bg-desk-danger-soft text-desk-danger";
