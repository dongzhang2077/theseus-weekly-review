import type { FetchLike } from "./loadAppWeek";

export type PreferenceSource = "user_stated" | "inferred";
export type PreferenceScope = "global" | "goal" | "project" | "task" | "activity";
export type ProposalStatus = "pending" | "approved" | "rejected" | "expired" | "executed" | "undone";
export type ProposalDecision = "approve" | "edit" | "reject" | "expire";
export type JsonMap = Record<string, unknown>;

export interface PreferenceRecord {
  id: number;
  user_id: number;
  source: PreferenceSource;
  preference_key: string;
  value: unknown;
  scope_type: PreferenceScope;
  scope_ref_id: number | null;
  provenance: JsonMap;
  confidence: number | null;
  review_after: string | null;
  expires_at: string | null;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreferenceRevision {
  id: number;
  action: "update" | "delete" | "restore" | "undo";
  before: JsonMap;
  after: JsonMap;
  actor_type: "user" | "assistant_approved";
  reason: string;
  created_at: string;
}

export interface PreferenceDetail {
  preference: PreferenceRecord;
  revisions: PreferenceRevision[];
}

export interface PreferenceMutation {
  preference: PreferenceRecord;
  revision_id: number;
}

export interface ProposalRecord {
  id: number;
  user_id: number;
  proposal_type: "weekly_plan_adjustment" | "task_create" | "reflection" | "generic";
  source: "deterministic" | "assistant";
  title: string;
  rationale: string;
  evidence: JsonMap[];
  before: JsonMap;
  after: JsonMap;
  expires_at: string | null;
  status: ProposalStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ProposalDecisionRecord {
  id: number;
  decision: ProposalDecision;
  decided_after: JsonMap | null;
  reason: string;
  created_at: string;
}

export interface AgentActionRecord {
  id: number;
  operation: string;
  status: "pending" | "running" | "succeeded" | "failed" | "undone";
  result: JsonMap | null;
  verification: JsonMap | null;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export interface ProposalOutcomeRecord {
  id: number;
  result: "completed" | "partial" | "not_completed" | "dismissed";
  usefulness: number | null;
  actual_duration_minutes: number | null;
  energy_feedback: string | null;
  note: string;
  personalization_consent: boolean;
  consent_version: number;
  consent_updated_at: string | null;
  created_at: string;
}

export interface PersonalizationBaseline {
  baseline_version: "v1";
  status: "insufficient_data" | "ready";
  minimum_outcomes: number;
  consented_outcome_count: number;
  remaining_outcome_count: number;
  ranking_applied: false;
  groups: Array<{
    proposal_type: ProposalRecord["proposal_type"];
    outcome_count: number;
    rated_outcome_count: number;
    average_usefulness: number | null;
    completed_count: number;
    partial_count: number;
    not_completed_count: number;
    dismissed_count: number;
    completion_rate: number | null;
  }>;
}

export interface ProposalDetail {
  proposal: ProposalRecord;
  decisions: ProposalDecisionRecord[];
  actions: AgentActionRecord[];
  outcomes: ProposalOutcomeRecord[];
}

export type AgentMemoryStatus = "ok" | "conflict" | "not_found" | "error";

export interface AgentMemoryResult<T> {
  status: AgentMemoryStatus;
  data: T | null;
  current: unknown;
  error: string | null;
}

interface AgentMemoryOptions {
  apiBaseUrl: string;
  fetchImpl?: FetchLike;
}

export function loadPreferences(
  options: AgentMemoryOptions,
  includeDeleted = true
): Promise<AgentMemoryResult<PreferenceRecord[]>> {
  return request(options, `/preferences?include_deleted=${includeDeleted}`, "GET");
}

export function loadPreferenceDetail(
  options: AgentMemoryOptions,
  preferenceId: number,
  includeDeleted = true
): Promise<AgentMemoryResult<PreferenceDetail>> {
  return request(
    options,
    `/preferences/${preferenceId}?include_deleted=${includeDeleted}`,
    "GET"
  );
}

export function createPreference(
  options: AgentMemoryOptions,
  input: { preferenceKey: string; value: unknown }
): Promise<AgentMemoryResult<PreferenceRecord>> {
  return request(options, "/preferences", "POST", {
    preference_key: input.preferenceKey,
    value: input.value,
    scope_type: "global",
    scope_ref_id: null
  });
}

export function correctPreference(
  options: AgentMemoryOptions,
  preference: PreferenceRecord,
  value: unknown
): Promise<AgentMemoryResult<PreferenceMutation>> {
  return request(options, `/preferences/${preference.id}`, "PATCH", {
    expected_version: preference.version,
    value,
    reason: "Corrected from Assistant memory"
  });
}

export function deletePreference(
  options: AgentMemoryOptions,
  preference: PreferenceRecord
): Promise<AgentMemoryResult<PreferenceMutation>> {
  const query = new URLSearchParams({
    expected_version: String(preference.version),
    reason: "Removed from Assistant memory"
  });
  return request(options, `/preferences/${preference.id}?${query}`, "DELETE");
}

export function restorePreference(
  options: AgentMemoryOptions,
  preference: PreferenceRecord
): Promise<AgentMemoryResult<PreferenceMutation>> {
  return request(options, `/preferences/${preference.id}/restore`, "POST", {
    expected_version: preference.version,
    reason: "Restored from Assistant memory"
  });
}

export function loadProposals(
  options: AgentMemoryOptions
): Promise<AgentMemoryResult<ProposalRecord[]>> {
  return request(options, "/proposals", "GET");
}

export function loadProposalDetail(
  options: AgentMemoryOptions,
  proposalId: number
): Promise<AgentMemoryResult<ProposalDetail>> {
  return request(options, `/proposals/${proposalId}`, "GET");
}

export function decideProposal(
  options: AgentMemoryOptions,
  proposal: ProposalRecord,
  decision: ProposalDecision,
  decidedAfter?: JsonMap
): Promise<AgentMemoryResult<ProposalDetail>> {
  return request(options, `/proposals/${proposal.id}/decisions`, "POST", {
    expected_version: proposal.version,
    decision,
    ...(decision === "edit" ? { decided_after: decidedAfter ?? proposal.after } : {}),
    reason: decision === "edit"
      ? "Edited and approved in Assistant"
      : `${decision[0]?.toUpperCase()}${decision.slice(1)}d in Assistant`
  });
}

export function createProposalOutcome(
  options: AgentMemoryOptions,
  proposalId: number,
  input: {
    result: ProposalOutcomeRecord["result"];
    usefulness: number;
    note: string;
    personalizationConsent: boolean;
  }
): Promise<AgentMemoryResult<ProposalOutcomeRecord>> {
  return request(options, `/proposals/${proposalId}/outcomes`, "POST", {
    result: input.result,
    usefulness: input.usefulness,
    note: input.note,
    personalization_consent: input.personalizationConsent
  });
}

export function updateProposalOutcomeConsent(
  options: AgentMemoryOptions,
  proposalId: number,
  outcome: ProposalOutcomeRecord,
  personalizationConsent: boolean
): Promise<AgentMemoryResult<ProposalOutcomeRecord>> {
  return request(
    options,
    `/proposals/${proposalId}/outcomes/${outcome.id}/consent`,
    "PATCH",
    {
      expected_version: outcome.consent_version,
      personalization_consent: personalizationConsent
    }
  );
}

export function loadPersonalizationBaseline(
  options: AgentMemoryOptions
): Promise<AgentMemoryResult<PersonalizationBaseline>> {
  return request(options, "/personalization/baseline", "GET");
}

async function request<T>(
  options: AgentMemoryOptions,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<AgentMemoryResult<T>> {
  const baseUrl = options.apiBaseUrl.trim().replace(/\/$/, "");
  if (!baseUrl) {
    return failure("API base URL is not configured");
  }
  try {
    const response = await (options.fetchImpl ?? fetch)(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) {
      const payload = await safeJson(response);
      return {
        status: response.status === 409
          ? "conflict"
          : response.status === 404
            ? "not_found"
            : "error",
        data: null,
        current: payload.detail?.current ?? null,
        error: payload.detail?.message ?? `Backend returned ${response.status}`
      };
    }
    return {
      status: "ok",
      data: await response.json() as T,
      current: null,
      error: null
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Assistant request failed");
  }
}

async function safeJson(response: { json: () => Promise<unknown> }): Promise<{
  detail?: { message?: string; current?: unknown };
}> {
  try {
    return await response.json() as {
      detail?: { message?: string; current?: unknown };
    };
  } catch {
    return {};
  }
}

function failure<T>(error: string): AgentMemoryResult<T> {
  return { status: "error", data: null, current: null, error };
}
