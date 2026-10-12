/** Studio experiment settings Remote and creation-time policy installation. */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-app-boot';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { ExperimentStore, ExperimentSettingsError, type ExperimentState, type ExperimentChange } from './store.ts';
import { installPolicies } from './runtime.ts';

export type { ExperimentState, ExperimentChange } from './store.ts';
export type { ExperimentSettings, ExperimentTarget } from './settings.ts';
declare module '@deepseek-ai/cordis' { interface Context { studioExperiments: ExperimentsRemote } }
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'studio-experiments/rejected': { reason: 'revision-conflict' | 'closed' | 'validation-or-save-failed' };
  }
}
/** User-only persisted policy editor; existing agents are not reconfigured. */
export class ExperimentsRemote extends TypertRemoteService {
  constructor(ctx: Context, private readonly owner: ExperimentStore) { super(ctx, 'studioExperiments'); }
  /** @returns Confirmed settings for future agents. */
  @Remote
  describe(): ExperimentState { return this.owner.describe(); }
  /** @param request Complete candidate and observed revision. @returns Confirmed committed state. */
  @Remote
  async apply(request: ExperimentChange): Promise<ExperimentState> {
    try { return await this.owner.apply(request); }
    catch (error) {
      const reason = error instanceof ExperimentSettingsError ? error.reason : 'validation-or-save-failed';
      throw new RemoteError('studio-experiments/rejected', reason, { reason }, { cause: error });
    }
  }
}
export const name = 'studio-experiments';
export const inject = ['storageDomain', 'profileContext', 'agents'];
/** @param ctx Plugin owner; disposing it drains writes and experiment-owned operations. */
export async function apply(ctx: Context): Promise<void> {
  const owner = await ExperimentStore.open(ctx.storageDomain, ctx.profileContext.name);
  ctx.effect(() => () => owner.close());
  ctx.plugin(ExperimentsRemote, owner);
  installPolicies(ctx, () => owner.capture());
}
