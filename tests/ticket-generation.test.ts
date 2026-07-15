import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ESCALATIONS, DEMO_REPOSITORIES } from "../data/demo-data.ts";
import { analyzeEscalation } from "../lib/repository-analysis.ts";
import { sanitizeSensitiveText } from "../lib/security.ts";
import {
  generateEngineeringTicket,
  ticketToJson,
  ticketToMarkdown,
} from "../lib/ticket-generation.ts";

test("redacts common secret and customer identifier patterns before analysis", () => {
  const result = sanitizeSensitiveText(
    "Authorization: Bearer abcdefghijklmnopqrstuvwxyz password=hunter2 user=alex@example.com sk-test_1234567890123456",
  );

  assert.doesNotMatch(
    result.value,
    /hunter2|alex@example\.com|abcdefghijklmnop|sk-test/i,
  );
  assert.match(result.value, /\[REDACTED/);
  assert.deepEqual(result.redactions.sort(), [
    "API keys: 1",
    "Bearer tokens: 1",
    "Email addresses: 1",
    "Passwords: 1",
  ]);
});

test("repository analysis cites indexed paths and keeps root cause hypothetical", () => {
  const escalation = structuredClone(DEMO_ESCALATIONS[0]);
  delete escalation.analysis;
  delete escalation.ticket;

  const analysis = analyzeEscalation(escalation, DEMO_REPOSITORIES[0], {
    generatedAt: "2026-07-14T18:00:00.000Z",
  });

  assert.ok(analysis.evidence.length >= 2);
  assert.equal(
    analysis.evidence[0].path,
    "src/services/payments/retry-payment.ts",
  );
  assert.equal(analysis.evidence[0].symbol, "retryPayment");
  assert.ok(analysis.evidence.every((item) => item.lines.startsWith("L")));
  assert.match(analysis.hypothesis.disclaimer, /Hypothesis only/i);
  assert.equal(analysis.hypothesis.level, "High");
  assert.ok(analysis.hypothesis.confidence < 100);
});

test("ticket generation produces every implementation handoff section", () => {
  const escalation = DEMO_ESCALATIONS[0];
  assert.ok(escalation.analysis);
  const ticket = generateEngineeringTicket(
    escalation,
    escalation.analysis,
    "2026-07-14T18:02:00.000Z",
  );

  assert.equal(ticket.priority, "P0");
  assert.equal(ticket.severity, "Critical");
  assert.ok(ticket.implementationPlan.length >= 4);
  assert.ok(ticket.acceptanceCriteria.length >= 4);
  assert.ok(ticket.testingRequirements.length >= 3);
  assert.ok(ticket.risksAndDependencies.length >= 2);
  assert.ok(ticket.edgeCases.length >= 3);
  assert.ok(ticket.definitionOfDone.length >= 4);
  assert.ok(ticket.repositoryEvidence.every((item) => Boolean(item.path)));
});

test("Markdown and JSON exports include evidence but exclude raw escalation logs", () => {
  const escalation = DEMO_ESCALATIONS[0];
  assert.ok(escalation.ticket);
  const markdown = ticketToMarkdown(escalation.ticket);
  const json = ticketToJson(escalation.ticket);

  assert.match(markdown, /Hypothesis — not confirmed/i);
  assert.match(markdown, /src\/services\/payments\/retry-payment\.ts/);
  assert.match(markdown, /## Acceptance criteria/);
  assert.doesNotMatch(markdown, /correlation=req_9182/);
  assert.deepEqual(JSON.parse(json), escalation.ticket);
});
