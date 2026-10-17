/** Pure helpers for the E2E browser harness. No Playwright import, process, or file side effects. */

/** Text DSH shows when a Client plugin entry fails to activate. */
export const PLUGIN_FAILURE = /Failed to load plugins|did not activate|플러그인을 불러오지 못/;

/** Pick the newest stable `playwright@x.y.z` directory name from a pnpm store listing. */
export function pickPlaywright(entries) {
  const versions = entries
    .map(name => /^playwright@(\d+)\.(\d+)\.(\d+)$/.exec(name))
    .filter(Boolean)
    .sort((a, b) => (b[1] - a[1]) || (b[2] - a[2]) || (b[3] - a[3]));
  return versions[0]?.[0];
}

/** "light", "dark@480", "dark@1440x900" → { theme, width, height }. */
export function parseView(raw, defaults = { width: 1440, height: 900 }) {
  const match = /^(light|dark)(?:@(\d+)(?:x(\d+))?)?$/.exec(String(raw));
  if (!match) throw new Error(`Invalid view: ${raw} (use light, dark, light@480, dark@1440x900)`);
  return { theme: match[1], width: Number(match[2] ?? defaults.width), height: Number(match[3] ?? defaults.height) };
}

export const viewName = view => `${view.theme}-${view.width}`;

/** File-safe screenshot name. */
export const slug = text => String(text).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'step';

export const shotName = (name, view) => `${String(name).replace(/[^\w.-]+/g, '-')}${view ? `.${viewName(view)}` : ''}.png`;

/**
 * One L0 summary: the only thing an agent reads. Checks are pass/fail facts; page errors and plugin
 * activation failures fail the run even when every named check passed.
 */
export function summarize({ checks, pageErrors = [], pluginFailures = [], shots = [], views = [] }) {
  const failed = checks.filter(check => !check.ok);
  return {
    ok: failed.length === 0 && pageErrors.length === 0 && pluginFailures.length === 0,
    level: 'L0',
    passed: checks.length - failed.length,
    failed: failed.length,
    failures: failed.map(({ name, view, error, selector }) => ({ name, view, error, ...(selector ? { selector } : {}) })),
    pageErrors: [...new Set(pageErrors)].slice(0, 20),
    pluginFailures: [...new Set(pluginFailures)],
    views,
    shots,
  };
}

/** Shorten a thrown Playwright error to its first meaningful line. */
export function errorLine(error) {
  const text = String(error?.message ?? error).replace(/\u001b\[[0-9;]*m/g, '');
  return text.split('\n').map(line => line.trim()).find(Boolean)?.slice(0, 300) ?? 'unknown error';
}

/** Accessibility snapshots above this size are cut so one repair item stays well under the loop's input limit. */
export const ARIA_LIMIT = 20_000;

/** One pixie_loop item for L1 selector repair. The id names the saved DOM file the probe opens. */
export function repairItem({ id, name, goal, selector, view, error, aria }) {
  const snapshot = aria.length > ARIA_LIMIT ? `${aria.slice(0, ARIA_LIMIT)}\n… (cut)` : aria;
  return {
    id,
    input: [
      `Goal: ${goal}`,
      `Step: ${name} (${view})`,
      `Failed selector: ${selector}`,
      `Error: ${error}`,
      'Accessibility snapshot of the page at the failure:',
      snapshot,
    ].join('\n'),
    selector,
  };
}

/** Map original selector -> repaired selector from pixie_loop results (passed items only). */
export function repairsFrom(map, results) {
  const repairs = {};
  for (const result of results) {
    const original = map[result.id];
    const output = String(result.output ?? '').trim();
    if (result.status === 'passed' && original && output && output !== original) repairs[original] = output;
  }
  return repairs;
}
