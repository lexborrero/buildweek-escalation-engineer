import type { EscalationStatus } from "@/types/domain";

export const ALLOWED_STATUS_TRANSITIONS: Record<
  EscalationStatus,
  EscalationStatus[]
> = {
  New: ["Analyzing", "Needs Information"],
  Analyzing: ["Needs Information", "Ready for Review"],
  "Needs Information": ["Analyzing", "Ready for Review"],
  "Ready for Review": ["Needs Information", "Approved"],
  Approved: ["Sent to Engineering", "Ready for Review"],
  "Sent to Engineering": ["Resolved", "Ready for Review"],
  Resolved: [],
};

export function canTransitionStatus(
  from: EscalationStatus,
  to: EscalationStatus,
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function transitionStatus(
  from: EscalationStatus,
  to: EscalationStatus,
): EscalationStatus {
  if (!canTransitionStatus(from, to)) {
    throw new Error(`Invalid escalation status transition: ${from} -> ${to}`);
  }
  return to;
}
