import type { Context } from '@deepseek-ai/cordis';
import { createConfigProjector, isNativeConfigSchema, LOADER_EXPRESSION_SCHEMA } from '@deepseek-ai/dsh-app-boot';
import { composeProfileConfig, configDiff, secretKeys, type SecretAction } from '../profile-config.ts';
import { fieldRoles, isSecretField, maskConfig, redactSecrets, schemaProperties } from '../secret-fields.ts';
import type { InstalledPlugin } from '../installed-plugins.ts';

interface Entry { options: { id: string; name: string; config?: unknown } }
interface ConfigEditorApi {
  entries(): Entry[];
  configuration(): Array<{ entry: Entry; inherited: Record<string, unknown>; override: Record<string, unknown> }>;
  edit(entry: Entry, change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>): Promise<void>;
}
interface LoaderApi { import(name: string): Promise<unknown>; unwrapExports(value: unknown): Record<string, unknown> | undefined }

/** Host services whose provider choice lives on one profile row (shown beside their providers). */
export const SERVICE_OWNERS: Readonly<Record<string, string>> = Object.freeze({ web: '@deepseek-ai/dsh-web' });

export interface ProfileConfigView {
  patchId: string; name: string;
  /** Why this row is listed: an installed profile plugin, or the service a listed plugin registers into. */
  role: 'plugin' | 'service';
  schema?: Record<string, unknown>; schemaError?: string;
  /** Effective non-secret values, the inherited layer, and the fields that differ from it. */
  effective: Record<string, unknown>; inherited: Record<string, unknown>; diff: Record<string, unknown>;
  secrets: Array<{ key: string; set: boolean }>;
}

/** Schema roles plus name-rule secrets (Exa `apiKey` carries no role), so an unset secret is still listed. */
function secretRoles(schema: unknown): Record<string, string> {
  return { ...Object.fromEntries(schemaProperties(schema).filter(key => isSecretField(key)).map(key => [key, 'secret'])), ...fieldRoles(schema) };
}

function editorOf(ctx: Context): ConfigEditorApi {
  const editor = ctx.get('configEditor' as never) as unknown as ConfigEditorApi | undefined;
  if (!editor) throw new Error('Profile settings need the DSH configuration editor, which this profile does not load');
  return editor;
}

export async function schemaOf(ctx: Context, name: string): Promise<{ schema?: Record<string, unknown>; schemaError?: string; inject: string[] }> {
  try {
    const loader = ctx.get('loader' as never) as unknown as LoaderApi;
    const module = loader.unwrapExports(await loader.import(name)) ?? {};
    const raw = module.inject;
    const inject = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : raw && typeof raw === 'object' ? Object.keys(raw) : [];
    if (!module.Config) return { inject };
    if (!isNativeConfigSchema(module.Config)) return { schemaError: 'Unsupported Config schema', inject };
    const result = (await createConfigProjector())(module.Config, 'config');
    return { schema: JSON.parse(JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', ...result.schema, $defs: { ...result.definitions, loaderExpression: LOADER_EXPRESSION_SCHEMA } })), inject };
  } catch (error) { return { schemaError: String(error), inject: [] }; }
}

/** Editable profile rows for the installed profile-scoped plugins and the services they register into. */
export async function readProfileConfigs(ctx: Context, installed: readonly InstalledPlugin[]): Promise<ProfileConfigView[]> {
  const editor = editorOf(ctx);
  const rows = new Map(editor.configuration().map(row => [row.entry.options.id, row]));
  const wanted = new Map<string, 'plugin' | 'service'>();
  for (const plugin of installed) if (plugin.scope === 'profile' && plugin.state === 'profile-active' && plugin.patchId && rows.has(plugin.patchId)) wanted.set(plugin.patchId, 'plugin');
  const views: ProfileConfigView[] = [];
  const services = new Set<string>();
  for (const [patchId] of wanted) for (const service of (await schemaOf(ctx, rows.get(patchId)!.entry.options.name)).inject) services.add(service);
  for (const service of services) {
    const owner = SERVICE_OWNERS[service];
    const row = owner && [...rows.values()].find(item => item.entry.options.name === owner);
    if (row && !wanted.has(row.entry.options.id)) wanted.set(row.entry.options.id, 'service');
  }
  for (const [patchId, role] of wanted) {
    const row = rows.get(patchId)!;
    const { schema, schemaError } = await schemaOf(ctx, row.entry.options.name);
    const roles = secretRoles(schema);
    const effective = (row.entry.options.config ?? {}) as Record<string, unknown>;
    const masked = maskConfig(effective, roles);
    views.push({ patchId, name: row.entry.options.name, role, ...(schema ? { schema } : {}), ...(schemaError ? { schemaError } : {}),
      effective: Object.fromEntries(Object.entries(masked).filter(([key]) => !secretKeys(roles, effective).includes(key))),
      inherited: Object.fromEntries(Object.entries(maskConfig(row.inherited, roles)).filter(([key]) => !secretKeys(roles, row.inherited).includes(key))),
      diff: configDiff(row.inherited, effective, roles),
      secrets: secretKeys(roles, effective, row.inherited).map(key => ({ key, set: typeof effective[key] === 'string' ? effective[key] !== '' : effective[key] !== undefined && effective[key] !== null })) });
  }
  return views.sort((a, b) => Number(a.role === 'service') - Number(b.role === 'service') || a.patchId.localeCompare(b.patchId));
}

/** Save one profile row through `configEditor.edit()`; only listed rows may be written. */
export async function saveProfileConfig(ctx: Context, installed: readonly InstalledPlugin[], payload: { patchId: string; diff: Record<string, unknown>; secrets?: Record<string, SecretAction> }): Promise<void> {
  const allowed = new Set((await readProfileConfigs(ctx, installed)).map(view => view.patchId));
  if (!allowed.has(payload.patchId)) throw new Error(`Not an editable profile setting: ${payload.patchId}`);
  const editor = editorOf(ctx);
  const entry = editor.entries().find(item => item.options.id === payload.patchId);
  if (!entry) throw new Error(`Profile entry is no longer available: ${payload.patchId}`);
  const roles = secretRoles((await schemaOf(ctx, entry.options.name)).schema);
  let secretsSeen: Record<string, unknown> = {};
  try {
    await editor.edit(entry, (current, inherited) => {
      secretsSeen = current;
      return composeProfileConfig({ inherited, current, diff: payload.diff, secrets: payload.secrets ?? {}, roles });
    });
  } catch (error) {
    const replaced = Object.fromEntries(Object.entries(payload.secrets ?? {}).flatMap(([key, action]) => action.action === 'replace' ? [[key, action.value]] : []));
    throw new Error(redactSecrets(redactSecrets(error instanceof Error ? error.message : String(error), secretsSeen, roles), replaced, Object.fromEntries(Object.keys(replaced).map(key => [key, 'secret']))));
  }
}
