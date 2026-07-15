import { safeRepositoryExcerpt, sanitizeSensitiveText } from "@/lib/security";
import type {
  Escalation,
  EscalationAnalysis,
  RepositoryEvidence,
  RepositoryFile,
  RepositorySnapshot,
} from "@/types/domain";

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "been",
  "being",
  "customer",
  "does",
  "error",
  "from",
  "have",
  "into",
  "observed",
  "that",
  "their",
  "then",
  "this",
  "when",
  "with",
]);

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter((token) => token.length > 3 && !STOP_WORDS.has(token)),
    ),
  );
}

function scoreFile(file: RepositoryFile, terms: string[]): number {
  const haystack = [
    file.path,
    file.symbol ?? "",
    file.description,
    ...file.tags,
  ]
    .join(" ")
    .toLowerCase();
  return terms.reduce(
    (score, term) => score + (haystack.includes(term) ? 2 : 0),
    file.tags.reduce(
      (score, tag) =>
        score + (terms.some((term) => tag.includes(term)) ? 1 : 0),
      0,
    ),
  );
}

function toEvidence(file: RepositoryFile, terms: string[]): RepositoryEvidence {
  const matchedTerms = terms.filter((term) =>
    [file.path, file.symbol ?? "", file.description, ...file.tags]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
  const reason = matchedTerms.length
    ? `${file.description} Matched report terms: ${matchedTerms.slice(0, 3).join(", ")}.`
    : file.description;

  return {
    path: file.path,
    symbol: file.symbol,
    lines: file.lines,
    kind: file.kind,
    reason,
    excerpt: safeRepositoryExcerpt(file.excerpt),
  };
}

function selectFiles(
  repository: RepositorySnapshot,
  terms: string[],
  kinds: RepositoryFile["kind"][],
  count: number,
): RepositoryEvidence[] {
  return repository.files
    .filter((file) => kinds.includes(file.kind))
    .map((file, index) => ({ file, score: scoreFile(file, terms), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .map(({ file }) => toEvidence(file, terms));
}

function createHypothesis(
  escalation: Escalation,
  repository: RepositorySnapshot,
  evidence: RepositoryEvidence[],
): EscalationAnalysis["hypothesis"] {
  const report =
    `${escalation.title} ${escalation.description} ${escalation.observedBehavior}`.toLowerCase();

  if (
    repository.id === "repo-atlas-billing" &&
    /duplicate|retry|charge|invoice/.test(report)
  ) {
    return {
      statement:
        "The retry path may create a new idempotency key after a payment timeout, allowing the provider to accept both the original request and its retry.",
      confidence: 78,
      level: "High",
      rationale:
        "The report describes timeout-triggered duplicates, and the indexed retry helper derives its key inside the attempt loop while the invoice model only constrains provider charge IDs after a response returns.",
      disclaimer:
        "Hypothesis only — confirm with provider request IDs and a controlled timeout reproduction before implementing a fix.",
    };
  }

  if (
    repository.id === "repo-customer-console" &&
    /session|login|auth/.test(report)
  ) {
    return {
      statement:
        "The client session refresh may race with route authorization and briefly evaluate an expired token before the refreshed session is committed.",
      confidence: 64,
      level: "Medium",
      rationale:
        "The refresh hook and route guard are separate indexed code paths that read the same session state without an explicit refresh-in-progress boundary.",
      disclaimer:
        "Hypothesis only — capture a browser trace and server correlation ID to verify event ordering.",
    };
  }

  return {
    statement: `The reported behavior may originate in ${evidence[0]?.symbol ?? evidence[0]?.path ?? "the primary request path"}, but the indexed snapshot does not contain enough runtime evidence to isolate a single cause.`,
    confidence: 42,
    level: "Low",
    rationale:
      "Repository relevance is based on report-term matching. A trace, correlation ID, or failing test is still needed to validate causality.",
    disclaimer:
      "Hypothesis only — do not treat this as a confirmed root cause without runtime verification.",
  };
}

export function analyzeEscalation(
  escalation: Escalation,
  repository: RepositorySnapshot,
  options: { generatedAt?: string; provider?: string } = {},
): EscalationAnalysis {
  const sanitized = sanitizeSensitiveText(
    [
      escalation.title,
      escalation.description,
      escalation.observedBehavior,
      escalation.expectedBehavior,
      escalation.reproductionSteps.join(" "),
      escalation.logs,
    ].join(" "),
  );
  const terms = tokenize(sanitized.value);
  const evidence = selectFiles(
    repository,
    terms,
    ["service", "api", "model", "config"],
    4,
  );
  const relatedTests = selectFiles(repository, terms, ["test"], 2);
  const relatedDocumentation = selectFiles(repository, terms, ["docs"], 2);
  const hypothesis = createHypothesis(escalation, repository, evidence);

  return {
    id: `analysis-${escalation.id.toLowerCase()}`,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    provider: options.provider ?? "Demo provider · repository evidence mode",
    summary: `${evidence.length} implementation paths, ${relatedTests.length} related test files, and ${relatedDocumentation.length} documentation references were identified in ${repository.name} at ${repository.indexedCommit}.`,
    architecture: [
      `${repository.name} is primarily ${repository.primaryLanguage} and was analyzed from a read-only ${repository.provider.toLowerCase()} snapshot.`,
      `The likely request path crosses ${evidence
        .slice(0, 3)
        .map((item) => item.symbol ?? item.path)
        .join(" → ")}.`,
      "Repository excerpts were sanitized before being added to the analysis context.",
    ],
    technicalFindings: evidence.map(
      (item) =>
        `${item.path}${item.symbol ? ` (${item.symbol})` : ""}, ${item.lines}: ${item.reason}`,
    ),
    evidence,
    relatedTests,
    relatedDocumentation,
    hypothesis,
    followUpQuestions: [
      "Can support provide the exact request or correlation ID for one affected attempt?",
      "Did the behavior begin after a known deployment, configuration change, or provider incident?",
      "Can the issue be reproduced in a non-production environment with sanitized payloads?",
    ],
    redactions: sanitized.redactions,
  };
}
