import type {
  EngineeringTicket,
  Escalation,
  EscalationAnalysis,
} from "@/types/domain";

function priorityFor(escalation: Escalation): EngineeringTicket["priority"] {
  if (
    escalation.severity === "Critical" ||
    escalation.urgency === "Immediate"
  ) {
    return "P0";
  }
  if (escalation.severity === "High" || escalation.urgency === "High")
    return "P1";
  if (escalation.severity === "Medium") return "P2";
  return "P3";
}

export function generateEngineeringTicket(
  escalation: Escalation,
  analysis: EscalationAnalysis,
  generatedAt = new Date().toISOString(),
): EngineeringTicket {
  const primary = analysis.evidence[0];
  const verificationTarget =
    primary?.symbol ?? primary?.path ?? "the affected request path";

  return {
    id: `ticket-${escalation.id.toLowerCase()}`,
    title: `[${escalation.severity}] ${escalation.title}`,
    executiveSummary: `${escalation.organization} reports ${escalation.description.charAt(0).toLowerCase()}${escalation.description.slice(1)} Repository analysis identified ${analysis.evidence.length} relevant implementation paths. The proposed cause remains a hypothesis pending runtime verification.`,
    customerImpact: escalation.customerImpact,
    severity: escalation.severity,
    priority: priorityFor(escalation),
    observedBehavior: escalation.observedBehavior,
    expectedBehavior: escalation.expectedBehavior,
    reproductionSteps: escalation.reproductionSteps,
    technicalFindings: analysis.technicalFindings,
    rootCauseHypothesis: analysis.hypothesis,
    repositoryEvidence: analysis.evidence,
    implementationPlan: [
      `Instrument ${verificationTarget} with sanitized correlation metadata to verify the hypothesis without logging credentials or customer payloads.`,
      `Add a failing regression test around ${verificationTarget} that reproduces the reported sequence before changing behavior.`,
      `Implement the smallest fix in the cited path after the hypothesis is confirmed; preserve existing public API and data-model contracts.`,
      "Add operational telemetry for the failure mode and document the rollback signal.",
      "Review the final diff for secret exposure, unsafe logging, and tenant-boundary regressions.",
    ],
    acceptanceCriteria: [
      "The documented reproduction no longer produces the observed behavior.",
      "Expected behavior is preserved for existing successful requests.",
      "The regression test fails on the previous implementation and passes with the fix.",
      "Logs and telemetry contain correlation metadata but no secrets or sensitive customer payloads.",
      "The root-cause statement is updated with verified evidence or remains clearly labeled as a hypothesis.",
    ],
    testingRequirements: [
      ...analysis.relatedTests.map(
        (item) =>
          `Extend ${item.path}${item.symbol ? ` (${item.symbol})` : ""}.`,
      ),
      "Run unit and integration suites for the affected package.",
      "Exercise retry, timeout, duplicate-delivery, and partial-failure scenarios.",
      "Complete a targeted staging verification using sanitized test data.",
    ],
    risksAndDependencies: [
      "Behavior may depend on an external provider response that is not present in the repository snapshot.",
      "Schema or idempotency changes may require a backward-compatible rollout.",
      "Additional runtime evidence could invalidate the current hypothesis and change the implementation target.",
    ],
    edgeCases: [
      "Concurrent requests for the same operation",
      "Client disconnect after the provider commits but before the application receives a response",
      "Delayed or duplicated webhook delivery",
      "Retries that cross a deployment boundary",
    ],
    definitionOfDone: [
      "Acceptance criteria are verified and linked to automated tests.",
      "Monitoring and rollback criteria are documented.",
      "Security and privacy review confirms no sensitive data exposure.",
      "Support receives a customer-safe resolution summary.",
      "An engineer approves the final ticket before it is sent externally.",
    ],
    lastEditedAt: generatedAt,
  };
}

function lines(title: string, values: string[]): string {
  return `## ${title}\n\n${values.map((value) => `- ${value}`).join("\n")}`;
}

export function ticketToMarkdown(ticket: EngineeringTicket): string {
  const evidence = ticket.repositoryEvidence.map(
    (item) =>
      `\`${item.path}${item.symbol ? `#${item.symbol}` : ""}\` (${item.lines}) — ${item.reason}`,
  );

  return [
    `# ${ticket.title}`,
    `**Severity:** ${ticket.severity}  \n**Priority:** ${ticket.priority}`,
    `## Executive summary\n\n${ticket.executiveSummary}`,
    `## Customer impact\n\n${ticket.customerImpact}`,
    `## Observed behavior\n\n${ticket.observedBehavior}`,
    `## Expected behavior\n\n${ticket.expectedBehavior}`,
    lines("Reproduction steps", ticket.reproductionSteps),
    lines("Technical findings", ticket.technicalFindings),
    `## Root-cause hypothesis (${ticket.rootCauseHypothesis.confidence}% confidence)\n\n> **Hypothesis — not confirmed:** ${ticket.rootCauseHypothesis.statement}\n\n${ticket.rootCauseHypothesis.rationale}\n\n_${ticket.rootCauseHypothesis.disclaimer}_`,
    lines("Repository evidence", evidence),
    lines("Recommended implementation plan", ticket.implementationPlan),
    lines("Acceptance criteria", ticket.acceptanceCriteria),
    lines("Testing requirements", ticket.testingRequirements),
    lines("Risks and dependencies", ticket.risksAndDependencies),
    lines("Edge cases", ticket.edgeCases),
    lines("Definition of done", ticket.definitionOfDone),
  ].join("\n\n");
}

export function ticketToJson(ticket: EngineeringTicket): string {
  return JSON.stringify(ticket, null, 2);
}
