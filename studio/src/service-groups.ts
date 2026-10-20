/**
 * Host services whose providers are chosen on one profile row (#38 S8). The owner row's selector
 * fields pick a provider id; provider packages register those ids. DSH has no public API that lists
 * registered provider ids, so the ids below are read from the provider packages (DSH 0.2.1-rc.2)
 * and an unlisted provider stays reachable by typing its id.
 */
export type ProviderKind = 'search' | 'fetch';

export interface ServiceGroup {
  service: string;
  /** Package of the profile row that owns the provider choice. */
  owner: string;
  title: Readonly<Record<'ko' | 'en' | 'zh', string>>;
  /** Owner config fields that select a provider, by kind. */
  selectors: ReadonlyArray<{ field: string; kind: ProviderKind }>;
}

export const SERVICE_GROUPS: readonly ServiceGroup[] = Object.freeze([
  { service: 'web', owner: '@deepseek-ai/dsh-web', title: { ko: '웹 검색·가져오기', en: 'Web search and fetch', zh: '网页搜索与获取' },
    selectors: [{ field: 'searchProvider', kind: 'search' }, { field: 'fetchProvider', kind: 'fetch' }] },
]);

/** Provider ids each package registers, by kind. */
export const KNOWN_PROVIDERS: Readonly<Record<string, { service: string; providers: ReadonlyArray<{ id: string; kind: ProviderKind }> }>> = Object.freeze({
  '@deepseek-ai/dsh-web-search-exa': { service: 'web', providers: [{ id: 'exa', kind: 'search' }] },
  '@deepseek-ai/dsh-web-search-deepseek': { service: 'web', providers: [{ id: 'deepseek-official', kind: 'search' }] },
  '@deepseek-ai/dsh-web-search-perplexity': { service: 'web', providers: [{ id: 'perplexity', kind: 'search' }] },
  '@deepseek-ai/dsh-web-deepseek-api': { service: 'web', providers: [{ id: 'deepseek-search-api', kind: 'search' }, { id: 'deepseek-fetch-api', kind: 'fetch' }] },
  '@deepseek-ai/dsh-web-fetch-http': { service: 'web', providers: [{ id: 'http', kind: 'fetch' }] },
});

export function groupOfService(service: string | undefined): ServiceGroup | undefined {
  return SERVICE_GROUPS.find(group => group.service === service);
}

/** Service a package belongs to: its owner role, a known provider, or the first grouped service it injects. */
export function serviceOf(name: string, inject: readonly string[] = []): string | undefined {
  const owner = SERVICE_GROUPS.find(group => group.owner === name);
  if (owner) return owner.service;
  return KNOWN_PROVIDERS[name]?.service ?? inject.find(service => groupOfService(service));
}

export function groupTitle(service: string | undefined, locale: string): string | undefined {
  const group = groupOfService(service);
  if (!group) return undefined;
  return group.title[locale.startsWith('ko') ? 'ko' : locale.startsWith('zh') ? 'zh' : 'en'];
}

/**
 * Options for one selector: ids of active providers of that kind, plus the current value when it is
 * not among them (kept visible rather than silently replaced).
 */
export function selectorOptions(kind: ProviderKind, active: ReadonlyArray<{ id: string; kind: ProviderKind }>, current: unknown): Array<{ id: string; known: boolean }> {
  const ids = [...new Set(active.filter(provider => provider.kind === kind).map(provider => provider.id))].sort();
  const options = ids.map(id => ({ id, known: true }));
  if (typeof current === 'string' && current && !ids.includes(current)) options.push({ id: current, known: false });
  return options;
}

/** Lower-case text match over every given field; an empty query matches everything. */
export function matchesQuery(query: string, ...fields: ReadonlyArray<string | undefined>): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = fields.filter(Boolean).join(' ').toLowerCase();
  return words.every(word => text.includes(word));
}
