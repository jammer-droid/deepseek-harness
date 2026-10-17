/** SettingsX provider definition contract: one JSON file per provider route, validated before registration.
 * Pure and Node-testable; shared by the Host adapter, the Client page, and the authoring skill.
 * Definitions hold no secrets. Credential supply is declared by kind; only `none` is implemented in this release.
 * Requests carry text only: DSH replaces image attachments with text handles before the adapter sees them.
 */

/** Wire protocols a definition may name. */
export const PROVIDER_PROTOCOLS = ['openai-responses', 'openai-chat'] as const;
export type ProviderProtocol = typeof PROVIDER_PROTOCOLS[number];
/** Credential supply kinds of the contract; `SUPPORTED_CREDENTIALS` are the ones this release accepts. */
export const CREDENTIAL_KINDS = ['none', 'credential', 'command'] as const;
export type CredentialKind = typeof CREDENTIAL_KINDS[number];
export const SUPPORTED_CREDENTIALS: readonly CredentialKind[] = ['none'];
/** Version of the definition file format. */
export const PROVIDER_DEFINITION_VERSION = 1;

export interface ProviderModel {
  id: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
}
export interface ProviderDefinition {
  version: 1;
  /** Route key shown in DSH model selection; lowercase letters, digits, and hyphens. */
  id: string;
  name: string;
  protocol: ProviderProtocol;
  /** Base URL; the protocol appends its path (`/responses` or `/chat/completions`). */
  baseURL: string;
  headers?: Record<string, string>;
  models: ProviderModel[];
  credential: { kind: 'none' };
}

/** One rejection reason with a stable code and the offending field path. */
export interface ProviderIssue { code: ProviderIssueCode; path: string; detail?: string }
export type ProviderIssueCode =
  | 'json' | 'shape' | 'unknown-field' | 'required' | 'version' | 'id' | 'protocol' | 'url' | 'header'
  | 'models-empty' | 'model-duplicate' | 'number' | 'credential-kind' | 'credential-unsupported';
export type ProviderParse = { ok: true; definition: ProviderDefinition } | { ok: false; issues: ProviderIssue[] };

const ROUTE_ID = /^[a-z][a-z0-9-]{0,62}$/;
/** Header names DSH or the protocol owns; a definition cannot override them. */
const RESERVED_HEADERS = new Set(['user-agent', 'content-type', 'content-length', 'accept', 'host', 'authorization']);
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Validate one definition. Every problem is reported, not only the first.
 * @param input Parsed JSON or the raw file text.
 * @returns the normalized definition, or all issues found.
 */
export function parseProviderDefinition(input: unknown): ProviderParse {
  let value = input;
  if (typeof input === 'string') {
    try { value = JSON.parse(input); } catch (error) { return { ok: false, issues: [{ code: 'json', path: '', detail: error instanceof Error ? error.message : String(error) }] }; }
  }
  const issues: ProviderIssue[] = [];
  const issue = (code: ProviderIssueCode, path: string, detail?: string) => { issues.push(detail === undefined ? { code, path } : { code, path, detail }); };
  if (!record(value)) return { ok: false, issues: [{ code: 'shape', path: '' }] };
  const known = new Set(['$schema', 'version', 'id', 'name', 'protocol', 'baseURL', 'headers', 'models', 'credential']);
  for (const key of Object.keys(value)) if (!known.has(key)) issue('unknown-field', key);
  if (value.version !== PROVIDER_DEFINITION_VERSION) issue('version', 'version');
  if (!text(value.id)) issue('required', 'id'); else if (!ROUTE_ID.test(value.id)) issue('id', 'id');
  if (!text(value.name)) issue('required', 'name');
  if (!PROVIDER_PROTOCOLS.includes(value.protocol as ProviderProtocol)) issue('protocol', 'protocol');
  if (!text(value.baseURL)) issue('required', 'baseURL');
  else {
    let url: URL | undefined;
    try { url = new URL(value.baseURL); } catch { /* reported below */ }
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) issue('url', 'baseURL');
  }
  const headers: Record<string, string> = {};
  if (value.headers !== undefined) {
    if (!record(value.headers)) issue('shape', 'headers');
    else for (const [name, header] of Object.entries(value.headers)) {
      if (!HEADER_NAME.test(name) || RESERVED_HEADERS.has(name.toLowerCase()) || typeof header !== 'string' || /[\r\n\0]/.test(header)) issue('header', `headers.${name}`);
      else headers[name] = header;
    }
  }
  const models: ProviderModel[] = [];
  if (!Array.isArray(value.models)) issue('required', 'models');
  else if (value.models.length === 0) issue('models-empty', 'models');
  else {
    const seen = new Set<string>();
    value.models.forEach((raw, index) => {
      const path = `models[${index}]`;
      if (!record(raw)) { issue('shape', path); return; }
      for (const key of Object.keys(raw)) if (!['id', 'name', 'contextWindow', 'maxTokens'].includes(key)) issue('unknown-field', `${path}.${key}`);
      if (!text(raw.id)) { issue('required', `${path}.id`); return; }
      if (seen.has(raw.id)) issue('model-duplicate', `${path}.id`);
      seen.add(raw.id);
      const model: ProviderModel = { id: raw.id };
      if (raw.name !== undefined) { if (text(raw.name)) model.name = raw.name; else issue('required', `${path}.name`); }
      for (const key of ['contextWindow', 'maxTokens'] as const) {
        if (raw[key] === undefined) continue;
        if (Number.isSafeInteger(raw[key]) && (raw[key] as number) > 0) model[key] = raw[key] as number; else issue('number', `${path}.${key}`);
      }
      models.push(model);
    });
  }
  if (!record(value.credential) || !CREDENTIAL_KINDS.includes(value.credential.kind as CredentialKind)) issue('credential-kind', 'credential.kind');
  else if (!SUPPORTED_CREDENTIALS.includes(value.credential.kind as CredentialKind)) issue('credential-unsupported', 'credential.kind', String(value.credential.kind));
  else for (const key of Object.keys(value.credential)) if (key !== 'kind') issue('unknown-field', `credential.${key}`);
  if (issues.length) return { ok: false, issues };
  const raw = value as Record<string, string>;
  return { ok: true, definition: {
    version: 1, id: raw.id!, name: raw.name!.trim(), protocol: raw.protocol as ProviderProtocol, baseURL: raw.baseURL!.replace(/\/+$/, ''),
    ...(Object.keys(headers).length ? { headers } : {}), models, credential: { kind: 'none' },
  } };
}

/** Endpoint the protocol sends requests to. */
export function protocolEndpoint(definition: Pick<ProviderDefinition, 'protocol' | 'baseURL'>): string {
  return `${definition.baseURL}${definition.protocol === 'openai-responses' ? '/responses' : '/chat/completions'}`;
}

/** What the Client sees about one definition file. */
export type ProviderEntry =
  | { file: string; status: 'registered'; definition: ProviderDefinition }
  | { file: string; status: 'invalid'; issues: ProviderIssue[] }
  | { file: string; status: 'conflict'; definition: ProviderDefinition; detail: string };
export interface ProviderList { directory: string; entries: ProviderEntry[] }
