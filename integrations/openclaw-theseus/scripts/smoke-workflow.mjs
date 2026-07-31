import process from "node:process";

import {
  decideTheseusWeeklyPlanProposal,
  draftTheseusWeeklyPlanProposal,
  executeTheseusWeeklyPlanProposal,
  readTheseusContext,
  readTheseusNextAction,
  undoTheseusWeeklyPlanAction,
} from "../dist/client.js";

const required = [
  "THESEUS_BASE_URL",
  "THESEUS_ACCESS_TOKEN",
  "THESEUS_EXTERNAL_IDENTITY",
  "THESEUS_REVIEW_WEEK_START",
  "THESEUS_REVIEW_WEEK_END",
  "THESEUS_TARGET_WEEK_START",
  "THESEUS_TARGET_WEEK_END",
];

for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`${name} must be set`);
}

const config = {
  baseUrl: process.env.THESEUS_BASE_URL,
  accessToken: process.env.THESEUS_ACCESS_TOKEN,
  channelType: "openclaw",
  externalIdentity: process.env.THESEUS_EXTERNAL_IDENTITY,
};
const review = {
  weekStart: process.env.THESEUS_REVIEW_WEEK_START,
  weekEnd: process.env.THESEUS_REVIEW_WEEK_END,
};
const target = {
  weekStart: process.env.THESEUS_TARGET_WEEK_START,
  weekEnd: process.env.THESEUS_TARGET_WEEK_END,
};
const prefix = process.env.THESEUS_EXTERNAL_MESSAGE_PREFIX ?? "openclaw-e2e";

const context = await readTheseusContext(config, review, {
  messageId: `${prefix}-context`,
});
const nextAction = await readTheseusNextAction(
  config,
  {availableMinutes: 30},
  {messageId: `${prefix}-next-action`},
);
assertRecord(nextAction, "next action");
if (!("status" in nextAction) || !("uncertainties" in nextAction)) {
  throw new Error("Next-action response did not expose status and uncertainty");
}
const proposal = await draftTheseusWeeklyPlanProposal(
  config,
  {
    reviewWeekStart: review.weekStart,
    reviewWeekEnd: review.weekEnd,
    targetWeekStart: target.weekStart,
    targetWeekEnd: target.weekEnd,
  },
  {messageId: `${prefix}-proposal`},
);
assertRecord(proposal, "proposal");
if (proposal.status !== "pending") throw new Error("Proposal was not pending");

await decideTheseusWeeklyPlanProposal(
  config,
  {
    proposalId: proposal.id,
    expectedVersion: proposal.version,
    decision: "approve",
    reason: "Automated adapter verification",
  },
  {messageId: `${prefix}-decision`},
);

const execution = await executeTheseusWeeklyPlanProposal(
  config,
  {proposalId: proposal.id, expectedVersion: proposal.version + 1},
  {messageId: `${prefix}-execute`},
);
assertRecord(execution, "execution");
assertRecord(execution.proposal, "executed proposal");
assertRecord(execution.action, "executed action");
if (execution.proposal.status !== "executed" || execution.action.status !== "succeeded") {
  throw new Error("Approved proposal was not executed successfully");
}

const undo = await undoTheseusWeeklyPlanAction(
  config,
  {
    proposalId: proposal.id,
    actionId: execution.action.id,
    expectedVersion: execution.proposal.version,
  },
  {messageId: `${prefix}-undo`},
);
assertRecord(undo, "undo");
assertRecord(undo.proposal, "undone proposal");
assertRecord(undo.action, "undo action");
if (undo.proposal.status !== "undone" || undo.action.status !== "succeeded") {
  throw new Error("Executed proposal was not undone successfully");
}

const contextVersion = context && typeof context === "object" && "context_version" in context
  ? context.context_version
  : "unknown";
console.log(JSON.stringify({
  status: "ok",
  operations: ["context.read", "next_action.read", "proposal.create", "proposal.approve", "action.execute", "action.undo"],
  contextVersion,
}));

function assertRecord(value, label) {
  if (!value || typeof value !== "object") throw new Error(`${label} response was invalid`);
}
