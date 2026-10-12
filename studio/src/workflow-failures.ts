/** Client failure classification uses wire identities, never server message text. */
import type { DraftFailure } from '@local/dsh-studio-workflows/types';
/** Unrecognized failures include transport loss and cannot establish write outcome. */
export type WorkflowFailure = DraftFailure | 'unknown-outcome' | 'read-failed';
/** @param error Rejected Remote operation. @returns Actionable failure identity. */
export function workflowFailure(error: unknown): WorkflowFailure {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'studio-workflows/rejected' || !('details' in error)) return 'unknown-outcome';
  const details = error.details;
  if (typeof details !== 'object' || details === null || !('reason' in details)) return 'unknown-outcome';
  switch (details.reason) {
    case 'revision-conflict': case 'invalid-document': case 'closed': case 'storage-uncertain': return details.reason;
    default: return 'unknown-outcome';
  }
}
