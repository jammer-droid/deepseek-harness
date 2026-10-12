/** Catalog membership and configuration validation without model generation. */
import { HarnessError, ReasoningEffortId, type LlmRuntime } from '@deepseek-ai/dsh-llm';
import type { ModelSelection } from './workflow-types.ts';
export type { ModelSelection } from './workflow-types.ts';

/** Public DSH metadata operations used by Studio. */
export type WorkflowLlm = Pick<LlmRuntime, 'listProviders' | 'listModels' | 'resolveModelInfo' | 'resolveCallConfig'>;

/** Wire-safe failure identity; callers own localized reporting and retries. */
export interface ModelFailure {
  operation: 'service' | 'list-providers' | 'list-models' | 'resolve-model' | 'resolve-call-config';
  code: string;
  provider?: string;
  model?: string;
}

/** Role selection issue; the host attaches the owning role and field path. */
export interface ModelIssue {
  code: 'missing-model' | 'unsupported-provider' | 'unsupported-model' | 'unsupported-reasoning' | 'model-lookup-failed';
  field: 'provider' | 'model' | 'reasoningEffort';
  failure?: ModelFailure;
}

/** Configuration checks do not establish live authentication or execution permission. */
export interface ModelValidation {
  status: 'valid' | 'invalid' | 'unavailable';
  issues: ModelIssue[];
}

/** Catalog availability distinguishes failed lookup from an empty catalog. */
export interface ModelCatalog {
  status: 'available' | 'partial' | 'unavailable';
  providers: ModelProvider[];
  failure?: ModelFailure;
}

/** Provider catalog entry with contained model enumeration failures. */
export interface ModelProvider {
  id: string;
  name: string;
  status: 'available' | 'partial' | 'failed';
  models: ModelCatalogEntry[];
  failure?: ModelFailure;
}

/** Advertised model with exact-route reasoning metadata, never a substituted model. */
export interface ModelCatalogEntry {
  provider: string;
  id: string;
  name: string;
  description?: string;
  status: 'available' | 'failed';
  reasoning?: {
    efforts: { id: string; name: string; description?: string }[];
    defaultEffort?: string;
  };
  failure?: ModelFailure;
}

const unavailable: ModelFailure = { operation: 'service', code: 'service-unavailable' };

function failure(error: unknown, details: Omit<ModelFailure, 'code'>): ModelFailure {
  return { ...details, code: error instanceof HarnessError ? error.code : 'unexpected-error' };
}

async function lookup<T>(operation: () => T | Promise<T>, details: Omit<ModelFailure, 'code'>): Promise<
  { ok: true; value: T } | { ok: false; failure: ModelFailure }
> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, failure: failure(error, details) };
  }
}

function lookupFailed(failure: ModelFailure): ModelValidation {
  return { status: 'unavailable', issues: [{ code: 'model-lookup-failed', field: 'model', failure }] };
}

/** Read-only adapter; failed metadata remains unavailable and cannot validate a role. */
export class WorkflowModels {
  constructor(private readonly llm?: WorkflowLlm) {}

  /**
   * Read current provider and model metadata without retaining stale registrations.
   * @returns Catalog availability and independently contained provider/model failures.
   */
  async catalog(): Promise<ModelCatalog> {
    if (!this.llm) return { status: 'unavailable', providers: [], failure: { ...unavailable } };
    const llm = this.llm;
    const listed = await lookup(() => llm.listProviders(), { operation: 'list-providers' });
    if (!listed.ok) return { status: 'unavailable', providers: [], failure: listed.failure };
    const providers: ModelProvider[] = [];
    for (const provider of listed.value) {
      const catalog = await lookup(() => llm.listModels(provider.id), { operation: 'list-models', provider: provider.id });
      if (!catalog.ok) {
        providers.push({ ...provider, status: 'failed', models: [], failure: catalog.failure });
        continue;
      }
      const models: ModelCatalogEntry[] = [];
      for (const advertised of catalog.value) {
        const resolved = await lookup(() => llm.resolveModelInfo(provider.id, advertised.id), {
          operation: 'resolve-model', provider: provider.id, model: advertised.id,
        });
        if (!resolved.ok) {
          models.push({ ...advertised, status: 'failed', failure: resolved.failure });
          continue;
        }
        const info = resolved.value;
        models.push({ ...advertised, status: 'available', ...(info.reasoning ? {
          reasoning: { efforts: info.reasoning.efforts.map(effort => ({ ...effort })),
            ...(info.reasoning.defaultEffort === undefined ? {} : { defaultEffort: info.reasoning.defaultEffort }) },
        } : {}) });
      }
      providers.push({ ...provider, status: models.some(model => model.status === 'failed') ? 'partial' : 'available', models });
    }
    return { status: providers.some(provider => provider.status !== 'available') ? 'partial' : 'available', providers };
  }

  /**
   * Validate exact advertised membership without modifying stored selection or applying defaults.
   * @param selection - The role's own selection; omission is not inherited.
   * @returns Stable issues for localized reporting; no generation is performed.
   */
  async validate(selection: ModelSelection | undefined): Promise<ModelValidation> {
    if (!selection || !selection.model) return { status: 'invalid', issues: [{ code: 'missing-model', field: 'model' }] };
    if (!this.llm) return lookupFailed({ ...unavailable });
    const llm = this.llm;
    const providers = await lookup(() => llm.listProviders(), { operation: 'list-providers' });
    if (!providers.ok) return lookupFailed(providers.failure);
    if (!providers.value.some(provider => provider.id === selection.provider)) {
      return { status: 'invalid', issues: [{ code: 'unsupported-provider', field: 'provider' }] };
    }
    const advertised = await lookup(() => llm.listModels(selection.provider), { operation: 'list-models', provider: selection.provider });
    if (!advertised.ok) return lookupFailed(advertised.failure);
    if (!advertised.value.some(model => model.provider === selection.provider && model.id === selection.model)) {
      return { status: 'invalid', issues: [{ code: 'unsupported-model', field: 'model' }] };
    }
    try {
      await this.llm.resolveCallConfig({ provider: selection.provider, model: selection.model,
        ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(selection.reasoningEffort) }),
      });
    } catch (error) {
      if (error instanceof HarnessError && error.code === 'UNSUPPORTED_REASONING_EFFORT') {
        return { status: 'invalid', issues: [{ code: 'unsupported-reasoning', field: 'reasoningEffort' }] };
      }
      return lookupFailed(failure(error, { operation: 'resolve-call-config', provider: selection.provider, model: selection.model }));
    }
    return { status: 'valid', issues: [] };
  }
}
