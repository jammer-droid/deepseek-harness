/** SettingsX credential supply: turn a definition's `credential` into request headers.
 * - `credential`: a DSH credential reference, resolved per request.
 * - `command`: a user program (no shell) printing `{ token, expiresAt?, headers? }`; cached in memory until expiry.
 * - `oauth`: authorization code + PKCE with a loopback redirect; tokens live in the DSH credential record
 *   `studio-providers/<route>` and refresh under its cross-process lock.
 * Token values never leave the Host and never appear in errors.
 */
import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { LlmError } from '@deepseek-ai/dsh-llm';
import type { ProviderAuthState, ProviderCredential, ProviderDefinition } from '../provider-contract.ts';

/** The slice of DSH `credentials` this module uses. */
export interface CredentialsSlice {
  resolve(ref: string): Promise<{ value: string } | undefined>;
  describe(ref: string): Promise<{ configured: boolean; source?: string; writable: boolean }>;
  set(ref: string, value: string): Promise<void>;
  unset(ref: string): Promise<void>;
  readRecord(key: string): Promise<{ kind: string; payload?: unknown } | undefined>;
  modifyRecord(key: string, mutate: (current: { kind: string; payload?: unknown } | undefined) => Promise<{ kind: 'grant'; payload: unknown } | undefined>): Promise<unknown>;
  deleteRecord(key: string): Promise<void>;
}
type Fetch = typeof fetch;
export interface OAuthGrant { access: string; refresh?: string; expiresAt?: number; claims?: Record<string, unknown> }
type RunCommand = (command: string[], timeoutMs: number, signal?: AbortSignal) => Promise<string>;

const RECORD_SCOPE = 'studio-providers';
/** Refresh this long before the reported expiry. */
const EXPIRY_SKEW_MS = 60_000;
const recordKey = (route: string) => `${RECORD_SCOPE}/${route}`;
const authFailure = (message: string) => new LlmError(message, 'AUTHENTICATION');

function authHeader(credential: Exclude<ProviderCredential, { kind: 'none' }>, token: string): Record<string, string> {
  const header = credential.header ?? 'Authorization';
  const scheme = credential.scheme ?? (header.toLowerCase() === 'authorization' ? 'Bearer' : '');
  return { [header]: scheme ? `${scheme} ${token}` : token };
}

/** Decode a JWT payload without verifying it; used only to read claims the provider asks to echo as headers. */
export function jwtClaims(token: string): Record<string, unknown> | undefined {
  const part = token.split('.')[1];
  if (!part) return undefined;
  try { const value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as unknown; return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined; } catch { return undefined; }
}
const claimAt = (claims: Record<string, unknown> | undefined, path: readonly string[]) => {
  let value: unknown = claims;
  for (const key of path) value = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  return typeof value === 'string' && value ? value : undefined;
};

const defaultRun: RunCommand = (command, timeoutMs, signal) => new Promise((resolve, reject) => {
  const [file, ...args] = command;
  execFile(file!, args, { timeout: timeoutMs, maxBuffer: 1 << 20, signal, env: process.env }, (error, stdout) => {
    if (error) reject(new Error(`exited with ${(error as NodeJS.ErrnoException).code ?? 'an error'}`)); else resolve(String(stdout));
  });
});

function parseGrant(value: unknown): OAuthGrant | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.access !== 'string' || !raw.access) return undefined;
  return { access: raw.access, ...(typeof raw.refresh === 'string' ? { refresh: raw.refresh } : {}), ...(typeof raw.expiresAt === 'number' ? { expiresAt: raw.expiresAt } : {}),
    ...(typeof raw.claims === 'object' && raw.claims !== null ? { claims: raw.claims as Record<string, unknown> } : {}) };
}

/** Token endpoint call shared by code exchange and refresh. */
async function tokenRequest(fetchImpl: Fetch, tokenURL: string, form: Record<string, string>, signal?: AbortSignal): Promise<OAuthGrant> {
  let response: Response;
  try {
    response = await fetchImpl(tokenURL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams(form), signal: signal ?? null });
  } catch (error) { throw authFailure(`Could not reach the token endpoint: ${error instanceof Error ? error.message : String(error)}`); }
  const text = await response.text();
  if (!response.ok) {
    let reason = '';
    try { const parsed = JSON.parse(text) as { error?: unknown; error_description?: unknown }; reason = [parsed.error, parsed.error_description].filter(part => typeof part === 'string').join(': '); } catch { /* body is not JSON */ }
    throw authFailure(`Token endpoint returned HTTP ${response.status}${reason ? ` (${reason})` : ''}`);
  }
  let json: Record<string, unknown>;
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { throw authFailure('Token endpoint returned invalid JSON'); }
  if (typeof json.access_token !== 'string' || !json.access_token) throw authFailure('Token endpoint returned no access_token');
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : Number(json.expires_in);
  const claims = typeof json.id_token === 'string' ? jwtClaims(json.id_token) : undefined;
  return { access: json.access_token, ...(typeof json.refresh_token === 'string' ? { refresh: json.refresh_token } : {}),
    ...(Number.isFinite(expiresIn) && expiresIn > 0 ? { expiresAt: Date.now() + expiresIn * 1000 } : {}), ...(claims ? { claims } : {}) };
}

/** One sign-in waiting for its browser redirect. */
interface PendingSignIn { url: string; done: Promise<void>; cancel(): void }

export class ProviderAuth {
  private commandCache = new Map<string, { token: string; headers: Record<string, string>; expiresAt?: number }>();
  private pending = new Map<string, PendingSignIn>();
  /** Outcome of the latest attempt per route, kept after it settles so a late waiter still sees it. */
  private attempts = new Map<string, Promise<void>>();
  constructor(private readonly deps: { credentials: () => CredentialsSlice | undefined; fetch?: Fetch; run?: RunCommand; now?: () => number; listen?: (port: number, handler: Parameters<typeof createServer>[1]) => Promise<Server> }) {}
  private get fetchImpl() { return this.deps.fetch ?? fetch; }
  private now() { return this.deps.now?.() ?? Date.now(); }
  private credentials(): CredentialsSlice {
    const credentials = this.deps.credentials();
    if (!credentials) throw authFailure('DSH credentials service is unavailable');
    return credentials;
  }

  /** Headers for one request. `retry` forces a fresh token after the provider answered 401. */
  async headers(definition: ProviderDefinition, options: { retry?: boolean; signal?: AbortSignal } = {}): Promise<Record<string, string>> {
    const credential = definition.credential;
    if (credential.kind === 'none') return {};
    if (credential.kind === 'credential') {
      const value = (await this.credentials().resolve(credential.ref))?.value;
      if (!value) throw authFailure(`${definition.name}: credential ${credential.ref} is not set`);
      return authHeader(credential, value);
    }
    if (credential.kind === 'command') {
      const cached = this.commandCache.get(definition.id);
      if (cached && !options.retry && (cached.expiresAt === undefined || cached.expiresAt - EXPIRY_SKEW_MS > this.now())) return { ...cached.headers, ...authHeader(credential, cached.token) };
      let output: string;
      try { output = await (this.deps.run ?? defaultRun)(credential.command, credential.timeoutMs ?? 15_000, options.signal); } catch (error) {
        throw authFailure(`${definition.name}: token command failed (${error instanceof Error ? error.message : String(error)})`);
      }
      let parsed: { token?: unknown; expiresAt?: unknown; headers?: unknown };
      try { parsed = JSON.parse(output) as typeof parsed; } catch { throw authFailure(`${definition.name}: token command did not print JSON`); }
      if (typeof parsed.token !== 'string' || !parsed.token) throw authFailure(`${definition.name}: token command printed no token`);
      const headers: Record<string, string> = {};
      if (parsed.headers !== undefined) {
        if (typeof parsed.headers !== 'object' || parsed.headers === null) throw authFailure(`${definition.name}: token command headers must be an object`);
        for (const [name, value] of Object.entries(parsed.headers)) if (typeof value === 'string' && !/[\r\n\0]/.test(value)) headers[name] = value;
      }
      const entry = { token: parsed.token, headers, ...(typeof parsed.expiresAt === 'number' ? { expiresAt: parsed.expiresAt } : {}) };
      this.commandCache.set(definition.id, entry);
      return { ...headers, ...authHeader(credential, entry.token) };
    }
    const grant = await this.oauthGrant(definition, credential, options);
    const claimHeaders: Record<string, string> = {};
    for (const [name, path] of Object.entries(credential.claimHeaders ?? {})) {
      const value = claimAt(grant.claims, path) ?? claimAt(jwtClaims(grant.access), path);
      if (value) claimHeaders[name] = value;
    }
    return { ...claimHeaders, ...authHeader(credential, grant.access) };
  }

  /** Current grant, refreshed under the record lock when it expires or the provider rejected it. */
  private async oauthGrant(definition: ProviderDefinition, credential: Extract<ProviderCredential, { kind: 'oauth' }>, options: { retry?: boolean; signal?: AbortSignal }): Promise<OAuthGrant> {
    const credentials = this.credentials();
    const key = recordKey(definition.id);
    const stale = (grant: OAuthGrant) => options.retry || (grant.expiresAt !== undefined && grant.expiresAt - EXPIRY_SKEW_MS <= this.now());
    const current = parseGrant((await credentials.readRecord(key))?.payload);
    if (!current) throw authFailure(`${definition.name}: not signed in. Sign in on DSH Studio → SettingsX → Providers.`);
    if (!stale(current)) return current;
    if (!current.refresh) throw authFailure(`${definition.name}: the sign-in expired. Sign in again on DSH Studio → SettingsX → Providers.`);
    let refreshed: OAuthGrant | undefined;
    await credentials.modifyRecord(key, async record => {
      const latest = parseGrant(record?.payload);
      if (!latest) return undefined;
      // Another process may have refreshed while we waited for the lock.
      if (latest.access !== current.access && !(latest.expiresAt !== undefined && latest.expiresAt - EXPIRY_SKEW_MS <= this.now())) { refreshed = latest; return undefined; }
      if (!latest.refresh) return undefined;
      const next = await tokenRequest(this.fetchImpl, credential.tokenURL, { grant_type: 'refresh_token', refresh_token: latest.refresh, client_id: credential.clientId }, options.signal);
      refreshed = { ...next, refresh: next.refresh ?? latest.refresh, ...(next.claims ?? latest.claims ? { claims: next.claims ?? latest.claims } : {}) };
      return { kind: 'grant', payload: refreshed };
    });
    if (!refreshed) throw authFailure(`${definition.name}: the sign-in expired. Sign in again on DSH Studio → SettingsX → Providers.`);
    return refreshed;
  }

  /** Start a browser sign-in: listen on the loopback redirect and return the URL to open. Replaces a previous attempt. */
  async startSignIn(definition: ProviderDefinition): Promise<{ url: string }> {
    const credential = definition.credential;
    if (credential.kind !== 'oauth') throw new Error(`${definition.name} does not use OAuth`);
    this.pending.get(definition.id)?.cancel();
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = randomBytes(16).toString('hex');
    const path = credential.redirectPath ?? '/callback';
    const redirectURI = `http://localhost:${credential.redirectPort}${path}`;
    const url = new URL(credential.authorizeURL);
    for (const [name, value] of Object.entries({ response_type: 'code', client_id: credential.clientId, redirect_uri: redirectURI, state, code_challenge: challenge, code_challenge_method: 'S256',
      ...(credential.scopes?.length ? { scope: credential.scopes.join(' ') } : {}), ...credential.authorizeParams })) url.searchParams.set(name, value);
    let settle!: (error?: Error) => void;
    const done = new Promise<void>((resolve, reject) => { settle = error => (error ? reject(error) : resolve()); });
    void done.catch(() => undefined);
    this.attempts.set(definition.id, done);
    const page = (ok: boolean) => `<!doctype html><meta charset="utf-8"><title>DSH Studio</title><p>${ok ? 'Signed in. You can close this tab and return to DSH.' : 'Sign-in failed. Return to DSH and try again.'}</p>`;
    const listen = this.deps.listen ?? ((port, handler) => new Promise<Server>((resolve, reject) => { const server = createServer(handler); server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server)); }));
    let server: Server | undefined;
    const close = () => { server?.close(); server = undefined; this.pending.delete(definition.id); };
    const timer = setTimeout(() => { close(); settle(new Error('Sign-in timed out')); }, 10 * 60_000);
    timer.unref?.();
    try {
      server = await listen(credential.redirectPort, (request, response) => {
        const incoming = new URL(request.url ?? '/', redirectURI);
        if (incoming.pathname !== path) { response.writeHead(404).end(); return; }
        const code = incoming.searchParams.get('code');
        if (incoming.searchParams.get('state') !== state || !code) {
          response.writeHead(400, { 'content-type': 'text/html; charset=utf-8' }).end(page(false));
          clearTimeout(timer); close(); settle(new Error(incoming.searchParams.get('error') ?? 'The redirect did not match this sign-in'));
          return;
        }
        void (async () => {
          try {
            const grant = await tokenRequest(this.fetchImpl, credential.tokenURL, { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectURI, client_id: credential.clientId });
            await this.credentials().modifyRecord(recordKey(definition.id), async () => ({ kind: 'grant', payload: grant }));
            response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page(true));
            settle();
          } catch (error) {
            response.writeHead(500, { 'content-type': 'text/html; charset=utf-8' }).end(page(false));
            settle(error instanceof Error ? error : new Error(String(error)));
          } finally { clearTimeout(timer); close(); }
        })();
      });
    } catch (error) {
      clearTimeout(timer);
      throw new Error(`Port ${credential.redirectPort} is in use, so the sign-in redirect cannot be received. Close the other program using it and try again.`, { cause: error });
    }
    this.pending.set(definition.id, { url: url.toString(), done, cancel: () => { clearTimeout(timer); close(); settle(new Error('Sign-in cancelled')); } });
    return { url: url.toString() };
  }

  /** Resolve when the pending sign-in finishes; rejects with its failure. */
  async waitSignIn(route: string): Promise<void> { await this.attempts.get(route); }
  cancelSignIn(route: string) { this.pending.get(route)?.cancel(); }
  async signOut(route: string) { this.cancelSignIn(route); this.attempts.delete(route); await this.credentials().deleteRecord(recordKey(route)); }
  /** Store a value for a `credential` route in DSH credentials. */
  async setKey(definition: ProviderDefinition, value: string) {
    if (definition.credential.kind !== 'credential') throw new Error(`${definition.name} does not use a stored key`);
    if (!value.trim()) await this.credentials().unset(definition.credential.ref); else await this.credentials().set(definition.credential.ref, value.trim());
  }
  /** Forget cached command output, e.g. after the definition changed. */
  clearCache() { this.commandCache.clear(); }

  /** What the page shows, without values. */
  async state(definition: ProviderDefinition): Promise<ProviderAuthState> {
    const credential = definition.credential;
    if (credential.kind === 'none' || credential.kind === 'command') return { kind: credential.kind };
    const credentials = this.deps.credentials();
    if (credential.kind === 'credential') {
      if (!credentials) return { kind: 'credential', configured: false, writable: false };
      const info = await credentials.describe(credential.ref);
      return { kind: 'credential', configured: info.configured, writable: info.writable, ...(info.source ? { source: info.source } : {}) };
    }
    const grant = credentials ? parseGrant((await credentials.readRecord(recordKey(definition.id)).catch(() => undefined))?.payload) : undefined;
    const pending = this.pending.get(definition.id);
    return { kind: 'oauth', signedIn: !!grant, ...(grant?.expiresAt ? { expiresAt: grant.expiresAt } : {}), ...(pending ? { pending: { url: pending.url } } : {}) };
  }
  dispose() { for (const route of [...this.pending.keys()]) this.cancelSignIn(route); }
}
