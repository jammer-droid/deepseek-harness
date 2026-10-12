/** Public Studio Remote settings surface. */
import type { Context } from '@deepseek-ai/cordis';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { RoleApplyRequest, RoleState, RoleSetting, RoleSnapshotId } from './roles-types.ts';
import type { RoleSettings } from './roles.ts';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { DelegationRecord } from './delegation-store.ts';
import type {} from './delegation.ts';

declare module '@deepseek-ai/cordis' {
  interface Context { studioRoles: RoleSettingsRemote }
}
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'studio-agents/unavailable': { reason: 'service-unavailable' };
    'studio-roles/rejected': { reason: 'revision-conflict' | 'roles-closed' | 'validation-or-save-failed' };
  }
}
/** Exposes read and explicit Apply; capture stays Host-only. */
export class RoleSettingsRemote extends TypertRemoteService {
  constructor(ctx: Context, private readonly owner: RoleSettings) { super(ctx, 'studioRoles'); }
  /** @returns Confirmed saved and applied settings. */
  @Remote
  describe(): RoleState { return this.owner.describe(); }
  /** Apply after validation; refusals preserve previous saved settings.
   * @param request Both observed revision tokens and the complete fixed role pair.
   * @returns Confirmed saved and runtime application facts.
   */
  @Remote
  async apply(request: RoleApplyRequest): Promise<RoleState> {
    try { return await this.owner.apply(request); }
    catch (error) {
      const message = error instanceof Error ? error.message : '';
      const reason = message === 'revision-conflict' || message === 'roles-closed' ? message : 'validation-or-save-failed';
      throw new RemoteError('studio-roles/rejected', reason, { reason }, { cause: error });
    }
  }
  /** Observe managed membership without activating any session.
   * @param sessionId Selected parent or child Session identity.
   * @returns Detached durable role records, never mutable child settings.
   */
  @Remote
  agents(sessionId: SessionId): DelegationRecord[] {
    const owner = this.ctx.get('studioDelegation');
    if (!owner) throw new RemoteError('studio-agents/unavailable', 'service-unavailable', { reason: 'service-unavailable' });
    return owner.describe(sessionId);
  }
  /** Capture creation settings for a new child, never resume settings.
   * @param role Fixed role to instantiate.
   * @returns Detached snapshot or refusal when not applied.
   */
  capture(role: 'implementer' | 'reviewer'): { snapshotId: RoleSnapshotId; settings: RoleSetting } { return this.owner.capture(role); }
}
