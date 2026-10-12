/** Profile-persistent settings with serialized revision-checked commits. */
import { randomUUID } from 'node:crypto';
import { defineDomain, domainTable, type Domain, type DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';
import { initialSettings, settingsSchema, type ExperimentSettings } from './settings.ts';

import { brandString } from '@deepseek-ai/dsh-brand';
import type { ExperimentRevision } from './types.ts';
const revisionSchema = z.string().uuid().transform(value => brandString<ExperimentRevision>(value));
const record = z.object({ revision: revisionSchema, settings: settingsSchema }).strict();
const spec = defineDomain({ name: 'studio_experiments', version: 1, tables: { profiles: domainTable(record) } });
import type { ExperimentState, ExperimentChange } from './types.ts';
export type { ExperimentState, ExperimentChange } from './types.ts';
/** Stable refusal identity, independent of diagnostic text. */
export class ExperimentSettingsError extends Error {
  constructor(readonly reason: 'revision-conflict' | 'closed') { super(reason); }
}
/** Owns storage, current snapshot, queued writes and closure. */
export class ExperimentStore {
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  private constructor(private readonly domain: Domain<typeof spec>, private readonly profile: string, private current: ExperimentState) {}
  /** @param storage Profile storage facility. @param profile Current profile. @returns Validated persistent owner. */
  static async open(storage: Pick<DomainFacility, 'open'>, profile: string): Promise<ExperimentStore> {
    const domain = await storage.open(spec);
    try {
      const table = domain.table('profiles');
      if (!table.get(profile)) await table.put(profile, { revision: brandString<ExperimentRevision>(randomUUID()), settings: initialSettings });
      return new ExperimentStore(domain, profile, record.parse(table.get(profile)));
    } catch (error) { await domain.close(); throw error; }
  }
  /** @returns Detached confirmed state, never an editor draft. */
  describe(): ExperimentState { return structuredClone(this.current); }
  /** @returns A creation-time policy independent of future writes. */
  capture(): ExperimentSettings {
    if (this.closed) throw new ExperimentSettingsError('closed');
    return structuredClone(this.current.settings);
  }
  /** Commit atomically; validation and revision failures retain prior settings.
   * @param request Complete candidate and observed revision.
   * @returns Confirmed state after persistence succeeds.
   */
  async apply(request: ExperimentChange): Promise<ExperimentState> {
    if (this.closed) throw new ExperimentSettingsError('closed');
    const parsed = z.object({ expectedRevision: z.string().uuid(), settings: settingsSchema }).strict().parse(request);
    const operation = this.queue.then(async () => {
      const next = { revision: brandString<ExperimentRevision>(randomUUID()), settings: parsed.settings };
      await this.domain.table('profiles').update(this.profile, current => {
        if (record.parse(current).revision !== parsed.expectedRevision) throw new ExperimentSettingsError('revision-conflict');
        return next;
      });
      this.current = next;
      return this.describe();
    });
    this.queue = operation.then(() => {}, () => {});
    return operation;
  }
  /** Stop admission, drain accepted writes, then close the domain. */
  async close(): Promise<void> { this.closed = true; await this.queue; await this.domain.close(); }
}
