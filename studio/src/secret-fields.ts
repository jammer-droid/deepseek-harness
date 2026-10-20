/**
 * Secret Config fields (#38 D6). A projected schema marks them with `x-cordis.role: secret`; a field
 * without a role is secret when its name says so (Exa `apiKey`). `credential-ref` fields hold a key
 * name, not a value, and are never masked.
 */
export const SECRET_MASK = Object.freeze({ secret: true, set: true } as const);
export type MaskedSecret = typeof SECRET_MASK | { secret: true; set: false };

/** Last word of a camelCase / snake / kebab name: `githubToken` → `token`, `client_secret` → `secret`. */
const lastWords = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s_-]+/).filter(Boolean);
const SECRET_WORDS = new Set(['token', 'secret', 'password', 'passwd', 'apikey']);
type Schema = Record<string, unknown>;
const obj = (v: unknown): v is Schema => !!v && typeof v === 'object' && !Array.isArray(v);

/** Top-level field roles from a projected Config schema (`anyOf` branches included). */
export function fieldRoles(schema: unknown): Record<string, string> {
  const roles: Record<string, string> = {};
  const visit = (node: unknown) => {
    if (!obj(node)) return;
    if (obj(node.properties)) for (const [key, field] of Object.entries(node.properties)) {
      const role = obj(field) && obj(field['x-cordis']) ? field['x-cordis'].role : undefined;
      if (typeof role === 'string') roles[key] = role;
    }
    if (Array.isArray(node.anyOf)) node.anyOf.forEach(visit);
  };
  visit(schema);
  return roles;
}

/** Top-level property names of a projected Config schema. */
export function schemaProperties(schema: unknown): string[] {
  const keys = new Set<string>();
  const visit = (node: unknown) => {
    if (!obj(node)) return;
    if (obj(node.properties)) for (const key of Object.keys(node.properties)) keys.add(key);
    if (Array.isArray(node.anyOf)) node.anyOf.forEach(visit);
  };
  visit(schema);
  return [...keys];
}

export function isSecretField(key: string, roles: Readonly<Record<string, string>> = {}): boolean {
  const role = roles[key];
  if (role !== undefined) return role === 'secret';
  const words = lastWords(key);
  const last = words.at(-1) ?? '';
  return SECRET_WORDS.has(last) || (last === 'key' && words.at(-2) === 'api');
}

/** Copy of a config with secret top-level values replaced by presence markers. */
export function maskConfig(config: unknown, roles: Readonly<Record<string, string>> = {}): Record<string, unknown> {
  if (!obj(config)) return {};
  return Object.fromEntries(Object.entries(config).map(([key, value]) => [key,
    isSecretField(key, roles) ? (value === undefined || value === null || value === '' ? { secret: true, set: false } : SECRET_MASK) : structuredClone(value)]));
}

/** Copy of a projected schema without secret properties; secrets get their own keep/replace/delete control. */
export function withoutSecrets<T>(schema: T, roles: Readonly<Record<string, string>> = fieldRoles(schema)): T {
  const visit = (node: unknown): unknown => {
    if (!obj(node)) return node;
    const next: Schema = { ...node };
    if (obj(node.properties)) next.properties = Object.fromEntries(Object.entries(node.properties).filter(([key]) => !isSecretField(key, roles)));
    if (Array.isArray(node.anyOf)) next.anyOf = node.anyOf.map(visit);
    return next;
  };
  return visit(schema) as T;
}

/** Replace any occurrence of secret values in text (errors, snippets) with a placeholder. */
export function redactSecrets(text: string, config: unknown, roles: Readonly<Record<string, string>> = {}): string {
  if (!obj(config)) return text;
  let result = text;
  for (const [key, value] of Object.entries(config)) {
    if (isSecretField(key, roles) && typeof value === 'string' && value.length >= 4) result = result.split(value).join(`<${key}>`);
  }
  return result;
}
