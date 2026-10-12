/** Studio role invocation snapshots; DSH remains the owner of child execution. */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { DraftId } from '@local/dsh-studio-workflows/types';
export type { DraftId };
/** A saved document's main role available for explicit invocation. */
export interface RoleChoice { id: DraftId; name: string; roleName: string; revision: number }
/** Revision checking prevents invoking a silently edited role. */
export interface LaunchRequest { parentId: SessionId; roleId: DraftId; revision: number; task: string; context: 'fresh' | 'fork' }
/** Immutable values captured before DSH accepts the child. */
export interface CatalogAssignment {
  parentId: SessionId;
  childId: SessionId;
  role: { id: DraftId; name: string; description: string };
  snapshot: { revision: number; instructions: string; task: string; context: 'fresh' | 'fork'; model?: { provider: string; model: string; reasoningEffort?: string | undefined } | undefined; tools?: { allow?: string[] | undefined; deny?: string[] | undefined } | undefined };
  createdAt: number;
}
