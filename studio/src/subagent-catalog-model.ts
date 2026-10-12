/** Joins DSH child discovery with optional Studio creation-time role information. */
import type { CatalogAssignment } from '@local/dsh-studio-catalog/types';
import type {} from '@deepseek-ai/dsh-subagent/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionProjectionMap } from '@deepseek-ai/dsh-api-session-controller/client';

/** Display values captured when the child is created, not live role settings. */
export type SubagentAssignment = CatalogAssignment;

/** DSH owns discovery and navigation; Studio only enriches a discovered row. */
export interface CatalogRow {
  readonly entry: SessionProjectionMap['subagentCatalog'][number];
  readonly assignment?: SubagentAssignment;
}

/** Combine discovered children with optional role snapshots without changing DSH fields.
 * @param parentId Parent whose catalog is displayed.
 * @param entries DSH discovery order, including external and legacy children.
 * @param assignments Creation-time Studio metadata; duplicate child assignments reject the merge.
 * @returns Rows in discovery order. Unrelated metadata never creates additional children.
 */
export function catalogRows(
  parentId: SessionId,
  entries: readonly SessionProjectionMap['subagentCatalog'][number][],
  assignments: readonly SubagentAssignment[],
): CatalogRow[] {
  const byChild = new Map<SessionId, SubagentAssignment>();
  for (const assignment of assignments) {
    if (assignment.parentId !== parentId) continue;
    if (byChild.has(assignment.childId)) throw new Error('duplicate-subagent-assignment');
    byChild.set(assignment.childId, assignment);
  }
  return entries.map(entry => {
    const assignment = byChild.get(entry.id);
    return assignment === undefined ? { entry } : { entry, assignment };
  });
}
