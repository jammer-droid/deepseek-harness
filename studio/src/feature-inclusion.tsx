import React from 'react';
import { CONFIG_REQUIRES } from './config-overrides.ts';
import { isDelegationPlugin } from './delegation.ts';
import { ItemPicker, type PickerItem } from './item-picker.tsx';
import type { PluginCatalogEntry } from './plugin-catalog.ts';
import type { PluginCandidate } from './preset-catalog.ts';
import { Badge, Button, DetailDialog, Notice, PickOption, SectionHead } from './ui.tsx';

/** Host actions that change which plugins the Studio Master offers. */
export interface MasterPluginActions { add(name: string): Promise<void>; remove(id: string): Promise<void> }

type Locale = 'ko' | 'en' | 'zh';
type Copy = Record<'title' | 'hint' | 'included' | 'excluded' | 'overridden' | 'defaults' | 'follows' | 'requires' | 'addedTag' | 'autoOff' | 'autoOn' | 'declared'
  | 'search' | 'searchHint' | 'filter' | 'all' | 'empty' | 'noResults' | 'clear' | 'settings' | 'done' | 'modified' | 'modifiedTag'
  | 'add' | 'addTitle' | 'addHint' | 'candidates' | 'noCandidates' | 'byName' | 'namePlaceholder' | 'addButton' | 'addedList' | 'remove' | 'from' | 'adding', string> & Record<string, string>;
const copy: Record<Locale, Copy> = {
  ko: { title: '포함할 플러그인', hint: 'Studio 기준 구성의 플러그인은 기본으로 모두 포함됩니다. 끄면 이 프리셋 구성에서 빠지고, 값만 바꾸려면 아래 Config에서 덮어쓰세요. 선택한 도구를 제공하는 플러그인을 끄면 반영할 때 막힙니다.',
    included: '포함', excluded: '제외', overridden: '덮어쓰기', defaults: '기본값', follows: '함께 제외', requires: '필요: ', addedTag: '추가함',
    autoOff: '자동 압축 꺼짐 (auto: false)', autoOn: '자동 압축 켜짐', declared: '선언 기준이며 실행 중 세션의 상태는 아닙니다.',
    search: '플러그인 검색', searchHint: '플러그인 이름이나 ID로 검색', filter: '보기', all: '전체', empty: '플러그인이 없습니다.', noResults: '검색 결과가 없습니다.', clear: '전체 보기', settings: '설정', done: '완료', modified: '변경됨', modifiedTag: '변경됨',
    add: '플러그인 추가', addTitle: 'Studio 기준 구성에 플러그인 추가', addHint: '설치된 DSH 프리셋에 선언된 플러그인 중 아직 없는 것을 추가합니다. 추가하면 플러그인 코드가 실행되므로 신뢰하는 것만 추가하세요. 모든 Studio 프리셋의 편집 목록에 나타나며, 이미 반영한 프리셋은 바뀌지 않습니다.',
    candidates: 'DSH 프리셋에 있는 플러그인', noCandidates: '추가할 수 있는 플러그인이 없습니다.', byName: '패키지 이름으로 추가', namePlaceholder: '@scope/package 또는 package', addButton: '추가', addedList: 'Studio가 추가한 플러그인', remove: '제거', from: '선언: ', adding: '추가 중…',
    '@deepseek-ai/dsh-agent-instructions': 'AGENTS.md 지침', '@deepseek-ai/dsh-time-context': '현재 시각 안내', '@deepseek-ai/dsh-skill-filesystem': '스킬 목록',
    '@deepseek-ai/dsh-compaction-basic': '자동 대화 압축', '@deepseek-ai/dsh-command-compact': '수동 압축 (/compact)', '@deepseek-ai/dsh-compaction-tool-result-pruner': '긴 도구 결과 줄이기' },
  en: { title: 'Included plugins', hint: 'Every plugin in the Studio base composition is included by default. Turning one off leaves it out of this preset; to change values only, override them in Config below. Applying is blocked if a selected tool loses its plugin.',
    included: 'Included', excluded: 'Excluded', overridden: 'Override', defaults: 'Defaults', follows: 'Excluded with dependency', requires: 'Requires: ', addedTag: 'Added',
    autoOff: 'Automatic compaction off (auto: false)', autoOn: 'Automatic compaction on', declared: 'Shows the declaration, not the state of a running session.',
    search: 'Search plugins', searchHint: 'Search plugin names or IDs', filter: 'Show', all: 'All', empty: 'No plugins.', noResults: 'No matching results.', clear: 'Show all', settings: 'Settings', done: 'Done', modified: 'Modified', modifiedTag: 'Modified',
    add: 'Add plugin', addTitle: 'Add a plugin to the Studio base composition', addHint: 'Adds a plugin declared by an installed DSH preset that the base composition lacks. Adding runs its code, so add only plugins you trust. It appears in every Studio preset editor; presets you already applied do not change.',
    candidates: 'Plugins in DSH presets', noCandidates: 'No plugins to add.', byName: 'Add by package name', namePlaceholder: '@scope/package or package', addButton: 'Add', addedList: 'Plugins added by Studio', remove: 'Remove', from: 'Declared in: ', adding: 'Adding…',
    '@deepseek-ai/dsh-agent-instructions': 'AGENTS.md instructions', '@deepseek-ai/dsh-time-context': 'Current time notice', '@deepseek-ai/dsh-skill-filesystem': 'Skill catalog',
    '@deepseek-ai/dsh-compaction-basic': 'Automatic compaction', '@deepseek-ai/dsh-command-compact': 'Manual compaction (/compact)', '@deepseek-ai/dsh-compaction-tool-result-pruner': 'Trim long tool results' },
  zh: { title: '包含的插件', hint: 'Studio 基础组成中的插件默认全部包含。关闭后将从此预设中移除；如只需修改值，请在下方 Config 中覆盖。若已选工具失去其插件，将无法应用',
    included: '包含', excluded: '排除', overridden: '覆盖', defaults: '默认值', follows: '随依赖排除', requires: '需要：', addedTag: '已添加',
    autoOff: '自动压缩已关闭 (auto: false)', autoOn: '自动压缩已开启', declared: '显示的是声明，而非运行中会话的状态',
    search: '搜索插件', searchHint: '按插件名称或 ID 搜索', filter: '显示', all: '全部', empty: '没有插件', noResults: '没有匹配结果', clear: '显示全部', settings: '设置', done: '完成', modified: '已修改', modifiedTag: '已修改',
    add: '添加插件', addTitle: '向 Studio 基础组成添加插件', addHint: '添加已安装 DSH 预设中声明、但基础组成中没有的插件。添加会执行插件代码，请仅添加可信插件。它会出现在所有 Studio 预设编辑器中，已应用的预设不会改变',
    candidates: 'DSH 预设中的插件', noCandidates: '没有可添加的插件', byName: '按软件包名添加', namePlaceholder: '@scope/package 或 package', addButton: '添加', addedList: 'Studio 添加的插件', remove: '移除', from: '声明于：', adding: '添加中…',
    '@deepseek-ai/dsh-agent-instructions': 'AGENTS.md 指令', '@deepseek-ai/dsh-time-context': '当前时间提示', '@deepseek-ai/dsh-skill-filesystem': '技能目录',
    '@deepseek-ai/dsh-compaction-basic': '自动压缩', '@deepseek-ai/dsh-command-compact': '手动压缩 (/compact)', '@deepseek-ai/dsh-compaction-tool-result-pruner': '精简过长的工具结果' },
};
export const localeOf = (locale: string): Locale => locale.startsWith('ko') ? 'ko' : locale.startsWith('zh') ? 'zh' : 'en';
export const featureLabel = (name: string, locale: string) => copy[localeOf(locale)][name] ?? name;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

/** One row's three-way state: excluded wins; otherwise an override key, otherwise DSH defaults. */
export function featureState(id: string, overrides: Record<string, unknown>, excluded: readonly string[]): 'defaults' | 'overridden' | 'excluded' {
  return excluded.includes(id) ? 'excluded' : Object.hasOwn(overrides, id) ? 'overridden' : 'defaults';
}

/**
 * Include/exclude every Master plugin, in the same searchable list as the Config editor.
 * Turning one off records an exclusion and drops its Config override; turning it back on returns
 * it to DSH defaults. Dependants follow their requirement and cannot be turned on alone.
 */
export function FeatureInclusion({ entries, overrides, excluded, onChange, locale, candidates, added, actions }: {
  entries: readonly PluginCatalogEntry[]; overrides: Record<string, Record<string, unknown>>; excluded: readonly string[];
  onChange(next: { overrides: Record<string, Record<string, unknown>>; excluded: string[] }): void; locale: string;
  candidates?: readonly PluginCandidate[] | undefined; added?: ReadonlyArray<{ id: string; name: string }> | undefined; actions?: MasterPluginActions | undefined;
}): React.ReactElement {
  const t = copy[localeOf(locale)];
  // Delegation plugins are replaced by the role tool on apply, so the Subagent tab owns them.
  const rows = entries.filter(entry => !isDelegationPlugin(entry.name));
  const idOf = (name: string) => rows.find(entry => entry.name === name)?.id;
  const followed = (entry: PluginCatalogEntry) => { const needs = CONFIG_REQUIRES[entry.name]; const id = needs && idOf(needs); return !!id && excluded.includes(id) && !excluded.includes(entry.id); };
  const addedIds = new Set((added ?? []).map(row => row.id));
  const compaction = rows.find(entry => entry.name === '@deepseek-ai/dsh-compaction-basic');
  const auto = compaction && (overrides[compaction.id]?.auto ?? (compaction.config as Record<string, unknown> | undefined)?.auto);
  const items: PickerItem[] = rows.map(entry => {
    const label = featureLabel(entry.name, locale);
    const description = entry.name === '@deepseek-ai/dsh-compaction-basic' ? (auto === false ? t.autoOff : t.autoOn) : '';
    return { name: entry.id, title: label, subtitle: label === entry.name ? entry.id : `${entry.id} · ${entry.name}`, description, searchText: entry.name,
      ...(followed(entry) ? { disabledReason: `${t.follows} · ${t.requires}${featureLabel(CONFIG_REQUIRES[entry.name]!, locale)}` } : {}) };
  });
  const selected = rows.filter(entry => !excluded.includes(entry.id) && !followed(entry)).map(entry => entry.id);
  const change = (names: string[]) => {
    const nextExcluded = rows.filter(entry => !names.includes(entry.id) && !followed(entry)).map(entry => entry.id);
    const nextOverrides = Object.fromEntries(Object.entries(overrides).filter(([id]) => !nextExcluded.includes(id)));
    onChange({ overrides: nextOverrides, excluded: nextExcluded });
  };
  const badge = (id: string) => {
    const entry = rows.find(row => row.id === id)!;
    const state = followed(entry) ? 'excluded' : featureState(id, overrides, excluded);
    return <>{addedIds.has(id) && <Badge tone="outline">{t.addedTag}</Badge>}<Badge tone={state === 'excluded' ? 'neutral' : state === 'overridden' ? 'info' : 'outline'}>{t[state]}</Badge></>;
  };
  const [adding, setAdding] = React.useState(false);
  return <section className="studio-stack">
    <SectionHead title={t.title} description={t.hint} actions={actions ? <Button small onClick={() => setAdding(true)}>{t.add}</Button> : undefined} />
    <ItemPicker label={t.title} items={items} selected={selected} onChange={change} filters={['all', 'selected']} badge={badge}
      labels={{ search: t.search, searchHint: t.searchHint, filter: t.filter, all: t.all, selected: t.included, modified: t.modified, settings: t.settings, done: t.done, empty: t.empty, noResults: t.noResults, modifiedTag: t.modifiedTag, clear: t.clear }} />
    <p className="studio-muted studio-hint">{t.declared}</p>
    {actions && <AddPluginDialog open={adding} onClose={() => setAdding(false)} locale={locale} candidates={candidates ?? []} added={added ?? []} actions={actions} />}
  </section>;
}

function AddPluginDialog({ open, onClose, locale, candidates, added, actions }: { open: boolean; onClose(): void; locale: string; candidates: readonly PluginCandidate[]; added: ReadonlyArray<{ id: string; name: string }>; actions: MasterPluginActions }) {
  const t = copy[localeOf(locale)];
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const run = async (key: string, perform: () => Promise<void>) => {
    setBusy(key); setError('');
    try { await perform(); if (key === name.trim()) setName(''); } catch (value) { setError(message(value)); } finally { setBusy(''); }
  };
  return <DetailDialog open={open} onClose={onClose} title={t.addTitle} closeLabel={t.done}>
    <p className="studio-muted">{t.addHint}</p>
    {error && <Notice>{error}</Notice>}
    <SectionHead title={t.candidates} />
    {candidates.length ? candidates.map(candidate => <PickOption key={candidate.name} title={candidate.name} description={busy === candidate.name ? t.adding : `${t.from}${candidate.presets.join(', ')}`}
      onClick={() => { if (!busy) void run(candidate.name, () => actions.add(candidate.name)); }} />) : <p className="studio-muted">{t.noCandidates}</p>}
    <SectionHead title={t.byName} />
    <div className="studio-inline-actions">
      <input aria-label={t.byName} placeholder={t.namePlaceholder} value={name} disabled={!!busy} onChange={event => setName(event.target.value)} />
      <Button small disabled={!!busy || !name.trim()} onClick={() => void run(name.trim(), () => actions.add(name.trim()))}>{t.addButton}</Button>
    </div>
    {added.length > 0 && <><SectionHead title={t.addedList} />
      <ul className="studio-change-list">{added.map(row => <li key={row.id} className="studio-inline-actions">
        <span className="studio-mono">{row.name}</span><span className="studio-card-meta">{row.id}</span>
        <Button small disabled={!!busy} onClick={() => void run(row.id, () => actions.remove(row.id.replace(/^studio-added\//, '')))}>{t.remove}</Button>
      </li>)}</ul></>}
  </DetailDialog>;
}
