import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ESCALATIONS, DEMO_REPOSITORIES } from "../data/demo-data.ts";
import { validateEscalationDraft } from "../lib/validation.ts";
import { canTransitionStatus, transitionStatus } from "../lib/workflow.ts";
import { DemoAiProvider } from "../services/ai-provider.ts";
import type { Escalation, EscalationDraft } from "../types/domain.ts";

const completeDraft: EscalationDraft = {
  organization: "Test Organization",
  title: "Payment retry duplicates a provider charge",
  description:
    "A controlled timeout causes the application to retry a charge that was already committed.",
  severity: "Critical",
  urgency: "Immediate",
  customerImpact: "Checkout is paused for all annual-plan customers.",
  expectedBehavior: "One invoice produces one provider charge.",
  observedBehavior: "Two provider charges are recorded for one invoice.",
  reproductionSteps:
    "Create an unpaid invoice.\nDelay the provider response.\nObserve the retry.",
  logs: "sanitized request id req_test_1",
  repositoryId: "repo-atlas-billing",
};

test("intake validation blocks incomplete and underspecified escalations", () => {
  const errors = validateEscalationDraft({
    ...completeDraft,
    organization: "",
    title: "Short",
    reproductionSteps: "Only one step",
  });

  assert.equal(errors.organization, "This field is required.");
  assert.match(errors.title ?? "", /at least 8/);
  assert.match(errors.reproductionSteps ?? "", /at least two/);
  assert.deepEqual(validateEscalationDraft(completeDraft), {});
});

test("critical flow moves from intake through analysis and human approval", async () => {
  const source = structuredClone(DEMO_ESCALATIONS[0]);
  const escalation: Escalation = {
    ...source,
    id: "ESC-TEST",
    status: "New",
    analysis: undefined,
    ticket: undefined,
  };

  escalation.status = transitionStatus(escalation.status, "Analyzing");
  const provider = new DemoAiProvider();
  const result = await provider.analyze(escalation, DEMO_REPOSITORIES[0]);
  escalation.analysis = result.analysis;
  escalation.ticket = result.ticket;
  escalation.status = transitionStatus(escalation.status, "Ready for Review");

  assert.ok(escalation.analysis.evidence.length > 0);
  assert.ok(escalation.ticket.repositoryEvidence.length > 0);
  assert.match(
    escalation.ticket.rootCauseHypothesis.disclaimer,
    /Hypothesis only/i,
  );

  escalation.status = transitionStatus(escalation.status, "Approved");
  assert.equal(escalation.status, "Approved");
  assert.equal(canTransitionStatus("Approved", "Sent to Engineering"), true);
});

test("workflow rejects unsafe status jumps", () => {
  assert.equal(canTransitionStatus("New", "Approved"), false);
  assert.throws(
    () => transitionStatus("Ready for Review", "Resolved"),
    /Invalid escalation status transition/,
  );
});
