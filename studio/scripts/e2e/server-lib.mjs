/** Pure helpers for the isolated E2E server script. No process, network, or file side effects. */

export const DEFAULT_PROFILE = 'e2e';
export const PORT_RANGE = [19410, 19499];
/** Plugins never copied from another profile: Studio itself is always the freshly packed build. */
export const EXCLUDED_PLUGIN = /^(@matamt-dbg\/dsh-studio|@local\/)/;

/**
 * Secrets the isolated home may copy from the user's ~/.dsh, by kind. Values are never printed.
 * - keys: credential refs (API keys) from .credentials.yaml; device/browser grants are never copied.
 * - subscriptions: the subscription plugin's OAuth store (plugins/subscriptions/auth.json).
 */
export const SECRET_KINDS = ['keys', 'subscriptions'];

/** Keep only `refs` from a parsed .credentials.yaml; drop device and browser-session grants. */
export function credentialRefs(parsed) {
  const refs = parsed?.refs && typeof parsed.refs === 'object' ? parsed.refs : {};
  return { version: parsed?.version ?? 1, records: {}, refs: { ...refs } };
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, plugins: [] };
  for (let index = 0; index < rest.length; index++) {
    const [flag, inline] = rest[index].split(/=(.*)/s, 2);
    const next = () => inline ?? rest[++index];
    switch (flag) {
      case '--profile': options.profile = next(); break;
      case '--port': options.port = Number(next()); break;
      case '--home': options.home = next(); break;
      case '--archive': options.archive = next(); break;
      case '--plugin': options.plugins.push(next()); break;
      case '--with-desktop-plugins': options.desktopPlugins = true; break;
      case '--reuse-profile': options.reuseProfile = true; break;
      case '--mock-llm': options.mockLlm = true; break;
      case '--with-secrets': options.secrets = next().split(',').map(part => part.trim()).filter(Boolean); break;
      case '--skip-build': options.skipBuild = true; break;
      case '--timeout': options.timeoutMs = parseDuration(next()); break;
      default: throw new Error(`Unknown option: ${rest[index]}`);
    }
  }
  if (!['up', 'down', 'status'].includes(command)) throw new Error('Usage: server.mjs <up|down|status> [options]');
  if (options.profile !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(options.profile)) throw new Error(`Invalid profile name: ${options.profile}`);
  if (options.port !== undefined && !(Number.isInteger(options.port) && options.port > 0 && options.port < 65536)) throw new Error('Invalid --port');
  for (const secret of options.secrets ?? []) if (!SECRET_KINDS.includes(secret)) throw new Error(`Unknown secret kind: ${secret} (use ${SECRET_KINDS.join(', ')})`);
  if (['desktop', 'web', 'headless'].includes(options.profile)) throw new Error(`Refusing to use the ${options.profile} profile name for E2E`);
  return options;
}

/** "90", "90s", "2m" → milliseconds. */
export function parseDuration(raw) {
  const match = /^(\d+)(ms|s|m)?$/.exec(String(raw ?? ''));
  if (!match) throw new Error(`Invalid duration: ${raw}`);
  const value = Number(match[1]);
  return match[2] === 'ms' ? value : match[2] === 'm' ? value * 60_000 : value * 1000;
}

/** The authenticated URL printed by `dsh` when the Web server is ready. */
export function findServerUrl(log, port) {
  for (const match of String(log).matchAll(/dsh web: (http:\/\/127\.0\.0\.1:(\d+)\/\?token=[\w-]+)/g)) {
    if (port === undefined || Number(match[2]) === port) return match[1];
  }
  return undefined;
}

/** Dependency specs worth copying from another profile manifest, Studio excluded. */
export function pluginSpecs(manifest) {
  return Object.entries(manifest?.dependencies ?? {})
    .filter(([name]) => !EXCLUDED_PLUGIN.test(name))
    .map(([name, spec]) => (/^(file:|link:|https?:|git)/.test(spec) ? spec.replace(/^file:/, '') : `${name}@${spec}`));
}

/** Supported runtime versions from the published peer range "a || b || c". */
export function supportedVersions(peerRange) {
  return String(peerRange ?? '').split('||').map(part => part.trim()).filter(Boolean);
}

export const redactUrl = url => String(url).replace(/token=[\w-]+/g, 'token=<redacted>');

/** Per-provider account count and minutes until the earliest access-token expiry. No token values. */
export function subscriptionSummary(store, now = Date.now()) {
  const summary = {};
  for (const [provider, entry] of Object.entries(store ?? {})) {
    const accounts = Object.values(entry?.accounts ?? {});
    const expiries = accounts.map(account => Number(account?.expiresAt)).filter(Number.isFinite)
      .map(value => (value < 1e12 ? value * 1000 : value));
    summary[provider] = {
      accounts: accounts.length,
      expiresInMin: expiries.length ? Math.floor((Math.min(...expiries) - now) / 60_000) : null,
    };
  }
  return summary;
}

/** A copied token that refreshes during a run rotates away from the user's copy; warn before that window. */
export const EXPIRY_WARN_MIN = 120;
