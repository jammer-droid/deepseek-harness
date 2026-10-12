/** General DSH settings, independent of Studio role orchestration. */
import type { Context } from '@deepseek-ai/cordis';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { PresetSettingsOwner } from './preset-settings.ts';
import type { PresetChange, PresetSettings } from './preset-types.ts';
declare module '@deepseek-ai/cordis' { interface Context { studioGeneral: GeneralSettingsRemote } }
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap { 'studio-presets/rejected': { reason: 'save-or-read-failed' } }
}
/** User-only configuration operations; no model-callable mutations. */
export class GeneralSettingsRemote extends TypertRemoteService {
  constructor(ctx: Context) { super(ctx, 'studioGeneral'); }
  /** @returns Current editable preset declarations. */
  @Remote
  async presets(): Promise<PresetSettings[]> { return new PresetSettingsOwner(this.ctx).describe(); }
  /** @param request Explicit revision-checked edit. @returns Saved declarations and availability. */
  @Remote
  async applyPreset(request: PresetChange): Promise<PresetSettings[]> {
    try { return await new PresetSettingsOwner(this.ctx).apply(request); }
    catch (error) { throw new RemoteError('studio-presets/rejected', 'save-or-read-failed', { reason: 'save-or-read-failed' }, { cause: error }); }
  }
}
/** @param ctx Owning general settings context. */
export function apply(ctx: Context): void { ctx.plugin(GeneralSettingsRemote); }
