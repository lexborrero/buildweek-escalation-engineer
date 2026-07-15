export const ESCALATION_STATUSES = [
  "New",
  "Analyzing",
  "Needs Information",
  "Ready for Review",
  "Approved",
  "Sent to Engineering",
  "Resolved",
] as const;

export const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export const URGENCIES = ["Immediate", "High", "Standard", "Low"] as const;

export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Urgency = (typeof URGENCIES)[number];
export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: string;
  scanStatus: "Safe" | "Pending";
}

export interface RepositoryFile {
  path: string;
  symbol?: string;
  kind: "service" | "api" | "model" | "test" | "docs" | "config";
  language: string;
  lines: string;
  excerpt: string;
  description: string;
  tags: string[];
}

export interface RepositorySnapshot {
  id: string;
  name: string;
  description: string;
  provider: "GitHub" | "GitLab" | "Local snapshot";
  owner: string;
  defaultBranch: string;
  indexedCommit: string;
  lastIndexedAt: string;
  primaryLanguage: string;
  visibility: "Private" | "Internal";
  status: "Indexed" | "Syncing" | "Unavailable";
  directories: number;
  indexedFiles: number;
  files: RepositoryFile[];
}

export interface RepositoryEvidence {
  path: string;
  symbol?: string;
  lines: string;
  kind: RepositoryFile["kind"];
  reason: string;
  excerpt: string;
}

export interface RootCauseHypothesis {
  statement: string;
  confidence: number;
  level: ConfidenceLevel;
  rationale: string;
  disclaimer: string;
}

export interface EscalationAnalysis {
  id: string;
  generatedAt: string;
  provider: string;
  summary: string;
  architecture: string[];
  technicalFindings: string[];
  evidence: RepositoryEvidence[];
  relatedTests: RepositoryEvidence[];
  relatedDocumentation: RepositoryEvidence[];
  hypothesis: RootCauseHypothesis;
  followUpQuestions: string[];
  redactions: string[];
}

export interface EngineeringTicket {
  id: string;
  title: string;
  executiveSummary: string;
  customerImpact: string;
  severity: Severity;
  priority: "P0" | "P1" | "P2" | "P3";
  observedBehavior: string;
  expectedBehavior: string;
  reproductionSteps: string[];
  technicalFindings: string[];
  rootCauseHypothesis: RootCauseHypothesis;
  repositoryEvidence: RepositoryEvidence[];
  implementationPlan: string[];
  acceptanceCriteria: string[];
  testingRequirements: string[];
  risksAndDependencies: string[];
  edgeCases: string[];
  definitionOfDone: string[];
  lastEditedAt: string;
}

export interface Escalation {
  id: string;
  organization: string;
  title: string;
  description: string;
  severity: Severity;
  urgency: Urgency;
  customerImpact: string;
  expectedBehavior: string;
  observedBehavior: string;
  reproductionSteps: string[];
  logs: string;
  attachments: Attachment[];
  repositoryId: string;
  status: EscalationStatus;
  createdAt: string;
  updatedAt: string;
  reporter: string;
  analysis?: EscalationAnalysis;
  ticket?: EngineeringTicket;
}

export interface EscalationDraft {
  organization: string;
  title: string;
  description: string;
  severity: Severity;
  urgency: Urgency;
  customerImpact: string;
  expectedBehavior: string;
  observedBehavior: string;
  reproductionSteps: string;
  logs: string;
  repositoryId: string;
}

export interface AiSettings {
  provider: "Demo provider" | "OpenAI" | "Anthropic";
  model: string;
  apiKeyPresent: boolean;
  redactSensitiveData: boolean;
  minimumEvidenceCount: number;
}
