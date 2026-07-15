import { analyzeEscalation } from "@/lib/repository-analysis";
import { generateEngineeringTicket } from "@/lib/ticket-generation";
import type {
  EngineeringTicket,
  Escalation,
  EscalationAnalysis,
  RepositorySnapshot,
} from "@/types/domain";

export interface AnalysisResult {
  analysis: EscalationAnalysis;
  ticket: EngineeringTicket;
}

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  readonly mode: "demo" | "live";
  analyze(
    escalation: Escalation,
    repository: RepositorySnapshot,
  ): Promise<AnalysisResult>;
}

export class DemoAiProvider implements AiProvider {
  readonly id = "demo";
  readonly name = "Demo provider";
  readonly mode = "demo" as const;

  async analyze(
    escalation: Escalation,
    repository: RepositorySnapshot,
  ): Promise<AnalysisResult> {
    const analysis = analyzeEscalation(escalation, repository, {
      provider: "Demo provider · deterministic repository matcher",
    });
    return {
      analysis,
      ticket: generateEngineeringTicket(escalation, analysis),
    };
  }
}

export class UnavailableLiveProvider implements AiProvider {
  readonly mode = "live" as const;

  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  async analyze(): Promise<AnalysisResult> {
    throw new Error(
      `${this.name} is not configured. Add a server-side credential or continue in demo mode.`,
    );
  }
}

export function createAiProvider(provider: string): AiProvider {
  if (provider === "OpenAI")
    return new UnavailableLiveProvider("openai", "OpenAI");
  if (provider === "Anthropic") {
    return new UnavailableLiveProvider("anthropic", "Anthropic");
  }
  return new DemoAiProvider();
}
