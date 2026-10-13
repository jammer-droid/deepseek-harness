import type { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { readPresetCatalog, type CatalogServices } from '../preset-catalog.ts';

import { assemblePreview, parseComposition, promptProviders } from './prompt-preview.ts';
import type { PreviewRequest } from '../prompt-composition.ts';

/** Catalog reads and temporary composition previews; no Agents or model calls. */
export default class StudioCatalog extends TypertRemoteService {
  static inject = ['agentPresets', 'systemPrompt', 'tools'];
  constructor(ctx: Context) { super(ctx, 'studioCatalog'); }
  @Remote
  async read() {
    const catalog = await readPresetCatalog({
      agentPresets: this.ctx.get('agentPresets') as unknown as CatalogServices['agentPresets'],
      systemPrompt: this.ctx.get('systemPrompt') as unknown as CatalogServices['systemPrompt'],
      tools: this.ctx.get('tools') as unknown as CatalogServices['tools'],
    });
    for (const preset of catalog.presets) {
      if (preset.declaration) preset.promptProviders = promptProviders(parseComposition(preset.declaration));
    }
    return catalog;
  }
  @Remote
  async preview(request: PreviewRequest) { return assemblePreview(this.ctx, request); }
}
