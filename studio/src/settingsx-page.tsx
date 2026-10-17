/** Studio → SettingsX service: Studio shortcut commands and provider definition routes. Node-testable.
 * Uses the shared {@link DetailLayout} frame like every Studio service.
 */
import React from 'react';
import { DetailLayout } from './detail-layout.tsx';
import { Badge, Button, Note, Notice, PageHead, SettingsRow, Toggle } from './ui.tsx';
import { protocolEndpoint, type ProviderEntry, type ProviderIssue, type ProviderList } from './provider-contract.ts';
import { STUDIO_COMMANDS, type StudioCommandSpec } from './settingsx-commands.ts';
import { settingsxText, type SettingsXKey } from './settingsx-locale.ts';

/** One Studio command row as the page shows it; `keys` comes from DSH's live shortcut catalog. */
export interface CommandRowState { id: string; enabled: boolean; keys: readonly string[] | null }
export interface SettingsXShortcuts {
  /** Current state per command id. */
  rows: readonly CommandRowState[];
  /** Keys of DSH's "open shortcuts" command, when bound. */
  openKeys: readonly string[] | null;
  /** Whether DSH reports a desktop runtime (default keys apply there). */
  desktop: boolean;
  setEnabled(id: string, enabled: boolean): void;
}
export interface SettingsXProviderActions { list(): Promise<ProviderList>; reload(): Promise<ProviderList> }

type PageId = 'shortcuts' | 'providers';
const keysText = (keys: readonly string[]) => keys.join(' ');
const macDefault = (spec: StudioCommandSpec) => spec.defaultMac
  ? [...spec.defaultMac.modifiers.map(modifier => ({ primary: '⌘', shift: '⇧', alt: '⌥', control: '⌃' })[modifier]), spec.defaultMac.code.replace(/^Bracket(Left|Right)$/, (_, side: string) => (side === 'Left' ? '[' : ']'))].join('')
  : undefined;

/** Command label; `goto` commands carry their sidebar position. */
export function commandLabel(locale: string, spec: StudioCommandSpec): string {
  return settingsxText(locale, `command.${spec.key}` as SettingsXKey, { n: spec.position ?? '' });
}

function ShortcutsPage({ locale, shortcuts }: { locale: string; shortcuts: SettingsXShortcuts }) {
  const t = (key: SettingsXKey, values?: Record<string, string | number>) => settingsxText(locale, key, values);
  const state = new Map(shortcuts.rows.map(row => [row.id, row]));
  return <div className="studio-page-stack">
    <PageHead title={t('pageShortcuts')} description={t('pageShortcutsDescription')} />
    <Note>{t('openShortcutsHint')}{shortcuts.openKeys?.length ? ` ${t('openShortcuts')}: ${keysText(shortcuts.openKeys)}` : ''}</Note>
    <section className="studio-settings-card" aria-label={t('pageShortcuts')}>
      {STUDIO_COMMANDS.map(spec => {
        const row = state.get(spec.id) ?? { id: spec.id, enabled: true, keys: null };
        const label = commandLabel(locale, spec);
        const fallback = macDefault(spec);
        const details = [
          `${t('keyAssigned')}: ${row.enabled && row.keys?.length ? keysText(row.keys) : t('keyNone')}`,
          fallback ? `${t('defaultKey')}: ${fallback}` : t('noDefault'),
          `${t('reference')}: ${spec.reference}`,
        ].join(' · ');
        return <SettingsRow key={spec.id} title={label} description={details}
          control={<Toggle label={label} checked={row.enabled} onChange={enabled => shortcuts.setEnabled(spec.id, enabled)} />} />;
      })}
    </section>
    <p className="studio-muted">{t('sessionOrderNote')}</p>
    <p className="studio-muted">{t('conflictNote')}{shortcuts.desktop ? '' : ` ${t('webNoDefault')}`}</p>
  </div>;
}

function issueText(locale: string, issue: ProviderIssue) {
  const message = settingsxText(locale, `issue.${issue.code}` as SettingsXKey);
  return issue.path ? `${issue.path}: ${message}` : message;
}

function ProviderRow({ locale, entry }: { locale: string; entry: ProviderEntry }) {
  const t = (key: SettingsXKey, values?: Record<string, string | number>) => settingsxText(locale, key, values);
  if (entry.status === 'invalid') {
    return <SettingsRow title={<>{entry.file} <Badge tone="warning">{t('statusInvalid')}</Badge></>}>
      <ul className="studio-muted">{entry.issues.map((issue, index) => <li key={index}>{issueText(locale, issue)}</li>)}</ul>
    </SettingsRow>;
  }
  const { definition } = entry;
  const facts = [`${t('protocol')}: ${definition.protocol}`, `${t('endpoint')}: ${protocolEndpoint(definition)}`, `${t('credential')}: ${t('credentialNone')}`].join(' · ');
  return <SettingsRow title={<>{definition.name} <code className="studio-mono">{definition.id}</code>{' '}
    {entry.status === 'registered' ? <Badge tone="success">{t('statusRegistered')}</Badge> : <Badge tone="warning">{t('statusConflict')}</Badge>}</>}
  description={`${entry.file} · ${facts}`}>
    {entry.status === 'conflict' && <p className="studio-muted">{t(entry.detail === 'duplicate' ? 'conflictDuplicate' : 'conflictRoute', { id: definition.id })}</p>}
    <p className="studio-muted">{t('models')}: {definition.models.map(model => model.name ?? model.id).join(', ')}</p>
  </SettingsRow>;
}

function ProvidersPage({ locale, actions }: { locale: string; actions: SettingsXProviderActions }) {
  const t = (key: SettingsXKey) => settingsxText(locale, key);
  const [list, setList] = React.useState<ProviderList>();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    actions.list().then(next => { if (active) setList(next); }, cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [actions]);
  const reload = async () => {
    setBusy(true); setError('');
    try { setList(await actions.reload()); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setBusy(false); }
  };
  return <div className="studio-page-stack">
    <PageHead title={t('pageProviders')} description={t('pageProvidersDescription')}
      actions={<Button disabled={busy} onClick={() => { void reload(); }}>{busy ? t('reloading') : t('reload')}</Button>} />
    {error && <Notice action={<Button small onClick={() => setError('')}>{t('dismiss')}</Button>}>{t('loadFailed')} {error}</Notice>}
    {list && <div className="studio-gate-path"><span className="studio-muted">{t('folder')}</span><code>{list.directory}</code>
      <Button small onClick={async () => { try { await navigator.clipboard.writeText(list.directory); setCopied(true); } catch { setCopied(false); } }}>{copied ? t('copied') : t('copyPath')}</Button></div>}
    {list && (list.entries.length
      ? <section className="studio-settings-card" aria-label={t('pageProviders')}>{list.entries.map(entry => <ProviderRow key={entry.file} locale={locale} entry={entry} />)}</section>
      : <p className="studio-muted" role="status">{t('emptyProviders')}</p>)}
    <p className="studio-muted">{t('skillNote')}</p>
    <p className="studio-muted">{t('termsNote')}</p>
  </div>;
}

export function SettingsXPage({ locale, shortcuts, providers, navFooter }: {
  locale: string; shortcuts: SettingsXShortcuts; providers: SettingsXProviderActions; navFooter?: React.ReactNode;
}) {
  const t = (key: SettingsXKey) => settingsxText(locale, key);
  const [page, setPage] = React.useState<PageId>('shortcuts');
  return <DetailLayout footer={navFooter} navigation={t('navigation')} selected={page} onSelect={next => setPage(next as PageId)} pages={[
    { id: 'shortcuts', label: t('pageShortcuts'), group: t('group'), content: <ShortcutsPage locale={locale} shortcuts={shortcuts} /> },
    { id: 'providers', label: t('pageProviders'), group: t('group'), content: <ProvidersPage locale={locale} actions={providers} /> },
  ]} />;
}
