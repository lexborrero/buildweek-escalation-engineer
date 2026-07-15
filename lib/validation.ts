import type { EscalationDraft } from "@/types/domain";

export type DraftErrors = Partial<Record<keyof EscalationDraft, string>>;

export function validateEscalationDraft(draft: EscalationDraft): DraftErrors {
  const errors: DraftErrors = {};
  const required: Array<keyof EscalationDraft> = [
    "organization",
    "title",
    "description",
    "customerImpact",
    "expectedBehavior",
    "observedBehavior",
    "reproductionSteps",
    "repositoryId",
  ];

  for (const field of required) {
    if (!String(draft[field]).trim()) errors[field] = "This field is required.";
  }

  if (draft.title.trim().length > 0 && draft.title.trim().length < 8) {
    errors.title =
      "Use at least 8 characters so engineering can identify the issue.";
  }
  if (
    draft.description.trim().length > 0 &&
    draft.description.trim().length < 24
  ) {
    errors.description = "Add at least 24 characters of diagnostic context.";
  }
  if (
    draft.reproductionSteps.trim().length > 0 &&
    draft.reproductionSteps.split(/\r?\n/).filter(Boolean).length < 2
  ) {
    errors.reproductionSteps =
      "Provide at least two reproduction steps, one per line.";
  }

  return errors;
}
