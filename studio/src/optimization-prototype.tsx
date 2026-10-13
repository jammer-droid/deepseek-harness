import { RoleEditor } from './role-editor.tsx';
// Studio preset creation and saved-preset management.
import React from 'react';
import { MasterExtensionsEditor, type MasterExtensionActions } from './master-extensions-editor.tsx';
import { ConfigEditor } from './config-editor.tsx';
import type { ConfigOverrides } from './config-overrides.ts';
import { PresetList, type PresetActions } from './preset-manager.tsx';
import type { PreviewRequest } from './prompt-composition.ts';
import { PromptToolsPrototype, defaultProvidedTools } from './prompt-tools-prototype.tsx';
import { DetailLayout } from './detail-layout.tsx';
import { Button, Note, Notice, PageHead } from './ui.tsx';

type Settings = { prompt: string; tools: string; spill: string; wait: string };
type Agent = { name: string; role: string; model: string; reasoning: string; spawn: 'fresh' | 'fork'; persona: string };
const initial: Settings = { prompt: 'Report evidence, uncertainty and remaining work.', tools: 'read / grep / glob', spill: '2048', wait: '60000' };
const seeds: Agent[] = [
  { name: 'Researcher', role: 'research', model: 'inherit', reasoning: 'inherit', spawn: 'fresh', persona: 'Investigate primary sources and cite the evidence.' },
  { name: 'Reviewer', role: 'review', model: 'inherit', reasoning: 'inherit', spawn: 'fork', persona: 'Review correctness and identify concrete risks.' },
];
export function OptimizationPrototype({ locale, catalog, catalogError, onPreview, presetActions, extensionActions }: { extensionActions?: MasterExtensionActions | undefined; presetActions?: PresetActions | undefined; onPreview?: import('./prompt-composition.ts').PreviewAction | undefined; locale: string; catalog?: import('./preset-catalog.ts').PresetCatalog | undefined; catalogError?: string | undefined }) {
  const t = (ko: string, en: string, zh: string) => locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [page, setPage] = React.useState('list');
  const [common, setCommon] = React.useState<Settings>({ ...initial });
  const [agents, setAgents] = React.useState<Agent[]>(() => seeds.map(a => ({ ...a })));
  const [editing, setEditing] = React.useState<import('./preset-manager.tsx').SavedPreset>();
  const [provided, setProvided] = React.useState<string[]>(defaultProvidedTools);
  const [tab, setTab] = React.useState('tools');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [draftKey, setDraftKey] = React.useState(0);
  const [revision, setRevision] = React.useState(0);
  const defaults = React.useMemo(() => Object.fromEntries((catalog?.plugins ?? []).filter(p => p.schema && ['tool-bash', 'tool-pwsh', 'tool-fs', 'spill-policy'].includes(p.id)).map(p => [p.id, {}])), [catalog]);
  const [configDraft, setConfigDraft] = React.useState<ConfigOverrides>();
  const configOverrides = configDraft ?? defaults;
  const [request, setRequest] = React.useState<PreviewRequest>();
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const save = async () => {
    if (saving || !presetActions || !request || !name.trim()) return;
    setSaving(true); setSaveError('');
    try { await presetActions.save(JSON.stringify({ ...(editing?.id ? { id: editing.id } : {}), name: name.trim(), description, request: { ...request, configOverrides }, conveniences: { spill: common.spill }, agents })); setRevision(n => n + 1); setPage('list'); setName(''); setDescription(''); setConfigDraft(undefined); setCommon({ ...initial }); setProvided([]); setAgents(seeds.map(a => ({ ...a }))); setEditing(undefined); setTab('tools'); setDraftKey(n => n + 1); }
    catch (error) { setSaveError(error instanceof Error ? error.message : String(error)); } finally { setSaving(false); }
  };
  const field = (label: string, child: React.ReactNode) => <label className="studio-field"><span>{label}</span>{child}</label>;
  const editPreset = (item: import('./preset-manager.tsx').SavedPreset, copy = false) => {
    setEditing(copy ? { ...item, id: '' } : item); setName(copy ? `${item.name} Copy` : item.name); setDescription(item.description);
    setCommon({ ...initial, prompt: item.request.prompt, spill: item.conveniences?.spill ?? initial.spill });
    setProvided([...item.request.tools]); setConfigDraft(item.request.configOverrides ?? {});
    setAgents(item.agents.map(role => ({ ...role }))); setRequest(item.request);
    setDraftKey(n => n + 1); setPage('create');
  };
  const agentPage = <RoleEditor key={draftKey} locale={locale} roles={agents} onChange={setAgents} loadModels={presetActions?.models} />;
  const tabs = [
    { id: 'tools', label: t('프롬프트·도구', 'Prompts & tools', '提示词与工具'), content: <><MasterExtensionsEditor locale={locale} actions={extensionActions} /><PromptToolsPrototype key={draftKey} initialRequest={editing?.request} locale={locale} catalog={catalog} catalogError={catalogError} onPreview={onPreview ? request => onPreview({ ...request, configOverrides }) : undefined} onRequestChange={setRequest} prompt={common.prompt} onPromptChange={value => setCommon(c => ({ ...c, prompt: value }))} provided={provided} onProvidedChange={setProvided} /></> },
    { id: 'convenience', label: t('실행 설정', 'Execution settings', '执行设置'), content: <><Note>{t('Spill은 이 프리셋에 추가하는 표시 제한입니다. Host의 기존 제한을 해제하거나 늘리지는 않습니다. read_batch는 공개 Config가 없어 여기에서 편집하지 않습니다.', 'Spill adds a scoped display limit; it cannot remove or increase the Host limit. read_batch has no public Config and is not editable here.', 'Spill 添加预设显示限制，不能解除或提高 Host 限制。read_batch 没有公开 Config，无法在此编辑。')}</Note><ConfigEditor locale={locale} entries={catalog?.plugins ?? []} value={configOverrides} onChange={setConfigDraft} /></> },
    { id: 'agents', label: t('서브에이전트 설정', 'Subagent settings', '子代理设置'), content: agentPage },
  ];
  const tabId = React.useId();
  return <DetailLayout title="Studio" navigation={t('프리셋 메뉴', 'Preset navigation', '预设导航')} group="" selected={page} onSelect={next => { if (next === 'create' && editing) { setEditing(undefined); setName(''); setDescription(''); setCommon({ ...initial }); setProvided([]); setConfigDraft(undefined); setAgents(seeds.map(role => ({ ...role }))); setDraftKey(n => n + 1); } setPage(next); }} pages={[
    { id: 'list', label: t('프리셋 목록', 'Preset list', '预设列表'), content: <PresetList locale={locale} api={presetActions} revision={revision} onEdit={item => editPreset(item)} onCopy={item => editPreset(item, true)} /> },
    { id: 'create', label: t('프리셋 생성', 'Create preset', '创建预设'), content: <><PageHead title={editing ? t('프리셋 편집', 'Edit preset', '编辑预设') : t('프리셋 생성', 'Create preset', '创建预设')} actions={<Button primary disabled={saving || !presetActions || !request || !name.trim()} onClick={() => void save()}>{saving ? t('저장 중…', 'Saving…', '保存中…') : t('프리셋 저장', 'Save preset', '保存预设')}</Button>} />
      {saveError && <Notice>{t(`프리셋을 저장하지 못했습니다. 편집 내용은 이 화면에 그대로 남아 있습니다. (${saveError})`, `Could not save the preset. Your edits remain on this screen. (${saveError})`, `无法保存预设，编辑内容仍保留在此页面（${saveError}）`)}</Notice>}
      <div className="studio-field-grid">{field(t('프리셋 이름', 'Preset name', '预设名称'), <input value={name} onChange={e => setName(e.target.value)} />)}{field(t('설명', 'Description', '描述'), <input value={description} onChange={e => setDescription(e.target.value)} />)}</div>
      <div className="studio-tabs" role="tablist" aria-label={t('프리셋 구성', 'Preset configuration', '预设配置')}>{tabs.map((item, index) => <button type="button" role="tab" id={`${tabId}-${item.id}-tab`} aria-controls={`${tabId}-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} key={item.id} onClick={() => setTab(item.id)} onKeyDown={e => { const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1; if (next < 0) return; e.preventDefault(); setTab(tabs[next]!.id); document.getElementById(`${tabId}-${tabs[next]!.id}-tab`)?.focus(); }}>{item.label}</button>)}</div>
      {tabs.map(item => <section role="tabpanel" id={`${tabId}-${item.id}`} aria-labelledby={`${tabId}-${item.id}-tab`} key={item.id} hidden={tab !== item.id}>{item.content}</section>)}
    </> },
  ]} />;
}
