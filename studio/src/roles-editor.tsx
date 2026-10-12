import { Button, StudioSurface } from './ui.tsx';
/** Explicit draft/Apply editor; edits never mutate active Host configuration. */
import React from 'react';
import type { RolePair, RoleState, RoleApplyRequest } from '../packages/roles/src/roles-types.ts';
import { roleCopy } from './roles-locales.ts';
const emptyRole = () => ({ instructions: '', provider: '', model: '' });
/** Editor inputs supplied by the Remote-owning component. */
export interface RoleEditorProps {
  locale: string;
  state: RoleState;
  onApply(request: RoleApplyRequest): Promise<void>;
  onReload(): Promise<void>;
}
/** Render two fixed roles and confirmed storage/runtime status.
 * @param props Confirmed state and explicit actions.
 * @returns Localized settings editor.
 */
export function RoleEditor({ locale, state, onApply, onReload }: RoleEditorProps) {
  const t = roleCopy(locale);
  const [draft, setDraft] = React.useState<RolePair>(() => structuredClone(state.roles ?? { implementer: emptyRole(), reviewer: emptyRole() }));
  const [observed] = React.useState(() => ({ expectedProcessId: state.processId, expectedRevision: state.revision, expectedSnapshotId: state.snapshotId }));
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.roles);
  async function apply() {
    setPending(true); setFailed(false);
    try { await onApply({ ...observed, roles: draft }); }
    catch (_error) { setFailed(true); } // Parent classifies Remote refusal; preserve the draft for correction.
    finally { setPending(false); }
  }
  return <StudioSurface><section aria-label={t.title}>
    <h2>{t.title}</h2><p>{t.guidance}</p>
    <p role="status">{t[state.status]}</p>
    <dl><dt>{t.saved}</dt><dd>{state.snapshotId ?? t.none}</dd><dt>{t.active}</dt><dd>{state.appliedSnapshotId ?? t.none}</dd><dt>{t.revision}</dt><dd>{state.revision}</dd></dl>
    <div className="studio-role-grid">{(['implementer', 'reviewer'] as const).map(role => <fieldset key={role} disabled={pending}><legend>{t[role]}</legend>
      {(['instructions', 'provider', 'model', 'reasoningEffort'] as const).map(field => <label key={field} >{t[field]}
        {field === 'instructions' ? <textarea aria-label={`${t[role]} ${t[field]}`} value={draft[role][field]} onChange={event => setDraft(previous => ({ ...previous, [role]: { ...previous[role], [field]: event.target.value } }))} /> : <input aria-label={`${t[role]} ${t[field]}`} value={draft[role][field] ?? ''} onChange={event => setDraft(previous => {
          const setting = { ...previous[role], [field]: event.target.value };
          if (field === 'reasoningEffort' && event.target.value === '') delete setting.reasoningEffort;
          return { ...previous, [role]: setting };
        })} />}
      </label>)}
    </fieldset>)}</div>
    <p role="status">{dirty ? t.dirty : t.clean}</p>
    {failed && <p role="alert">{t.rejected}</p>}
    <Button primary disabled={pending} onClick={() => void apply()}>{pending ? t.pending : t.apply}</Button>
    <Button disabled={pending} onClick={() => void onReload()}>{t.reload}</Button>
  </section></StudioSurface>;
}
