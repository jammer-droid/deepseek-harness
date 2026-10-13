/** Independent durable applied snapshots; no activation is performed by storage. */
import { z } from 'zod';
import { defineDomain, domainTable, type Domain, type DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import { parseDocument } from './drafts.ts';
import { ApplyError } from './compiler.ts';
import type { AppliedWorkflow } from './apply-types.ts';
const model = z.object({ provider: z.string().min(1), model: z.string().min(1), reasoningEffort: z.string().optional() }).strict();
const compiled = z.object({ mainRoleId: z.string().min(1), roles: z.array(z.object({ id: z.string().min(1), model, instructions: z.array(z.object({ instanceId: z.string().min(1), text: z.string() }).strict()) }).strict()).min(1) }).strict();
const spec = defineDomain({ name: 'studio_workflow_applied', version: 1, tables: { profiles: domainTable(z.object({ records: z.array(z.json()) }).strict()) } });
/** Serialized application owner is the sole writer; compare revisions again at commit. */
export class AppliedStore {
  private uncertain = false;
  private constructor(private readonly domain: Domain<typeof spec>, private readonly profile: string) {}
  static async open(storage: Pick<DomainFacility, 'open'>, profile: string): Promise<AppliedStore> {
    const domain = await storage.open(spec);
    try {
      if (!domain.table('profiles').get(profile)) await domain.table('profiles').put(profile, { records: [] });
      const store = new AppliedStore(domain, profile); store.list(); return store;
    } catch (error) { await domain.close(); throw error; }
  }
  list(): AppliedWorkflow[] {
    if (this.uncertain) throw new ApplyError('storage-uncertain');
    return this.domain.table('profiles').get(this.profile)!.records.map(value => {
      const row = value as unknown as AppliedWorkflow;
      if (!row || typeof row.id !== 'string' || !Number.isSafeInteger(row.revision) || row.revision < 1 || !Number.isSafeInteger(row.draftRevision) || row.draftRevision < 1 || row.presetId !== `studio-workflow:${row.id}`) throw new Error('Invalid applied workflow record');
      if (!['targeted', 'not-targeted', 'unknown'].includes(row.experiments)) throw new Error('Invalid applied experiments evidence');
      const execution = compiled.parse(row.compiled);
      if (!execution.roles.some(role => role.id === execution.mainRoleId)) throw new Error('Invalid applied main role');
      return { ...structuredClone(row), compiled: execution as AppliedWorkflow['compiled'], document: parseDocument(row.document) };
    });
  }
  async commit(record: AppliedWorkflow, expectedRevision: number): Promise<void> {
    if (this.uncertain) throw new ApplyError('storage-uncertain');
    try {
      await this.domain.table('profiles').update(this.profile, current => {
        const records = current.records as unknown as AppliedWorkflow[];
        const index = records.findIndex(item => item.id === record.id);
        if ((records[index]?.revision ?? 0) !== expectedRevision) throw new ApplyError('revision-conflict');
        const next = [...records]; if (index < 0) next.push(record); else next[index] = record;
        return { records: JSON.parse(JSON.stringify(next)) };
      });
    } catch (error) {
      if (error instanceof ApplyError) throw error;
      this.uncertain = true;
      throw new ApplyError('storage-uncertain', [], { cause: error });
    }
  }
  async close(): Promise<void> { await this.domain.close(); }
}
