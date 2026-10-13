// Studio preset creation and saved-preset management.
import React from 'react';
import { ExecutionSettings, type ExecutionDraft } from './execution-settings.tsx';
import { PresetList, type PresetActions } from './preset-manager.tsx';
import type { PreviewRequest } from './prompt-composition.ts';
import { PromptToolsPrototype, defaultProvidedTools } from './prompt-tools-prototype.tsx';
import { DetailLayout } from './detail-layout.tsx';
import { Button, Note, PageHead, SectionHead } from './ui.tsx';

type Settings = { prompt: string; tools: string; spill: string; wait: string };
type Agent = { name: string; role: string; model: string; reasoning: string; spawn: string; persona: string; overrides: Partial<Settings> };
const initial: Settings = { prompt: 'Report evidence, uncertainty and remaining work.', tools: 'read / grep / glob', spill: '2048', wait: '60000' };
const seeds: Agent[] = [
  { name: 'Researcher', role: 'research', model: 'inherit', reasoning: 'inherit', spawn: 'fresh', persona: 'Investigate primary sources and cite the evidence.', overrides: {} },
  { name: 'Reviewer', role: 'review', model: 'inherit', reasoning: 'high', spawn: 'fork', persona: 'Review correctness and identify concrete risks.', overrides: { tools: 'read / grep / glob', spill: '4096' } },
];
export function OptimizationPrototype({ locale, catalog, catalogError, onPreview, presetActions }: { presetActions?: PresetActions | undefined; onPreview?: import('./prompt-composition.ts').PreviewAction | undefined; locale: string; catalog?: import('./preset-catalog.ts').PresetCatalog | undefined; catalogError?: string | undefined }) {
  const t = (ko: string, en: string, zh: string) => locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [page, setPage] = React.useState('list');
  const [common, setCommon] = React.useState<Settings>({ ...initial });
  const [agents, setAgents] = React.useState<Agent[]>(() => seeds.map(a => ({ ...a, overrides: { ...a.overrides } })));
  const [selected, setSelected] = React.useState(0);
  const [provided, setProvided] = React.useState<string[]>(defaultProvidedTools);
  const [tab, setTab] = React.useState('tools');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [draftKey, setDraftKey] = React.useState(0);
  const [revision, setRevision] = React.useState(0);
  const [execution, setExecution] = React.useState<ExecutionDraft>({ defaults: {} });
  const activeExecution = { defaults: Object.fromEntries(Object.entries(execution.defaults).filter(([tool]) => provided.includes(tool))), ...(execution.batch && provided.includes('read_batch') ? { batch: execution.batch } : {}) };
  const [request, setRequest] = React.useState<PreviewRequest>();
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const save = async () => {
    if (!presetActions || !request || !name.trim()) return;
    setSaving(true); setSaveError('');
    try { await presetActions.save(JSON.stringify({ name: name.trim(), description, request: { ...request, execution: activeExecution }, conveniences: { spill: common.spill }, agents })); setRevision(n => n + 1); setPage('list'); setName(''); setDescription(''); setExecution({ defaults: {} }); setCommon({ ...initial }); setProvided([]); setAgents(seeds.map(a => ({ ...a, overrides: { ...a.overrides } }))); setSelected(0); setTab('tools'); setDraftKey(n => n + 1); }
    catch (error) { setSaveError(String(error)); } finally { setSaving(false); }
  };
  const agent = agents[selected]!;
  const update = (patch: Partial<Agent>) => setAgents(items => items.map((a, i) => i === selected ? { ...a, ...patch } : a));
  const effective = { ...common, ...agent.overrides };
  const labels: Record<keyof Settings, string> = {
    prompt: t('시스템 지침', 'System instructions', '系统指令'), tools: t('도구 제공 정책', 'Tool policy', '工具策略'),
    spill: t('Spill 표시 예산', 'Spill display budget', 'Spill 显示预算'), wait: t('기본 대기 시간', 'Default wait', '默认等待时间'),
  };
  const inherit = t('공통 설정 상속', 'Inherit shared settings', '继承公共设置');
  const custom = t('개별 설정', 'Override', '单独设置');
  const field = (label: string, child: React.ReactNode) => <label className="studio-field"><span>{label}</span>{child}</label>;
  const select = (value: string, options: [string, string][], change: (v: string) => void) => <select value={value} onChange={e => change(e.target.value)}>{options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>;
  const editor = (key: keyof Settings, value: string, change: (v: string) => void) => key === 'prompt'
    ? <textarea rows={4} value={value} onChange={e => change(e.target.value)} />
    : key === 'tools' ? select(value, [...(!['read', 'edit'].includes(value) ? [[value, value || t('없음', 'None', '无')] as [string, string]] : []), ['read', t('읽기 도구만 · 예시', 'Read tools only · sample', '仅读取工具 · 示例')], ['edit', t('읽기 + 편집 · 예시', 'Read + edit · sample', '读取 + 编辑 · 示例')]], change)
    : key === 'spill' ? select(value, [['off', t('사용 안 함', 'Off', '关闭')], ['2048', '2,048'], ['4096', '4,096'], ['12500', '12,500']], change)
    : select(value, [['10000', '10 s'], ['60000', '60 s'], ['120000', '120 s']], change);
  const display = (key: keyof Settings, value: string) => key === 'tools' ? value === 'read' ? 'read / grep / glob' : value === 'edit' ? 'read / grep / glob / edit / write' : value || t('없음', 'None', '无') : key === 'wait' ? `${Number(value) / 1000} s` : value === 'off' ? t('사용 안 함', 'Off', '关闭') : value;
  const mockNote = <Note>{t('이 설정은 프리셋 초안에 함께 저장됩니다. 작업 편의·서브에이전트의 실제 실행 연결은 아직 지원하지 않습니다.', 'These settings are saved with the preset draft. Runtime integration for convenience and subagents is not supported yet.', '这些设置随预设草稿保存。暂不支持工作便利和子代理的运行时集成。')}</Note>;
  const agentPage = <>
    <PageHead title={t('서브에이전트 설정', 'Subagent settings', '子代理设置')} description={t('호출 고유 설정과 최적화 재정의를 분리합니다.', 'Separate call settings from optimization overrides.', '将调用设置与优化覆盖分开。')} />{mockNote}
    <div className="studio-field-grid">{field(t('서브에이전트', 'Subagent', '子代理'), select(String(selected), agents.map((a, i) => [String(i), a.name]), v => setSelected(Number(v))))}<div className="studio-inline-actions"><Button onClick={() => { setAgents(a => [...a, { ...seeds[0]!, name: `Agent ${a.length + 1}`, overrides: {} }]); setSelected(agents.length); }}>{t('서브에이전트 추가', 'Add subagent', '添加子代理')}</Button></div></div>
    <section className="studio-component"><div className="studio-component-body"><SectionHead title={t('고유 설정', 'Call settings', '独有设置')} /><div className="studio-field-grid">
      {field(t('이름', 'Name', '名称'), <input value={agent.name} onChange={e => update({ name: e.target.value })} />)}
      {field(t('역할', 'Role', '角色'), <input value={agent.role} onChange={e => update({ role: e.target.value })} />)}
      {field(t('모델', 'Model', '模型'), select(agent.model, [['inherit', t('부모 모델 상속', 'Inherit parent model', '继承父模型')], ['sample-a', t('모델 A · 예시', 'Model A · sample', '模型 A · 示例')], ['sample-b', t('모델 B · 예시', 'Model B · sample', '模型 B · 示例')]], v => update({ model: v })))}
      {field(t('추론 수준', 'Reasoning', '推理级别'), select(agent.reasoning, [['inherit', t('부모 설정 상속', 'Inherit parent setting', '继承父设置')], ['medium', 'Medium'], ['high', 'High']], v => update({ reasoning: v })))}
      {field(t('스폰 방식', 'Spawn mode', '生成方式'), select(agent.spawn, [['fresh', 'Fresh'], ['fork', 'Fork']], v => update({ spawn: v })))}
    </div>{field(t('페르소나 · 추가 지침', 'Persona / additional instructions', '人设 / 附加指令'), <textarea rows={3} value={agent.persona} onChange={e => update({ persona: e.target.value })} />)}<Note>{t('부모 모델 상속과 아래의 공통 최적화 설정 상속은 서로 다른 개념입니다.', 'Parent-model inheritance is separate from shared optimization inheritance below.', '父模型继承与下方的公共优化继承不同。')}</Note></div></section>
    <SectionHead title={t('최적화 재정의', 'Optimization overrides', '优化覆盖')} description={t('기본은 공통 설정 상속입니다. 필요한 항목만 개별 지정합니다.', 'Inherit shared settings by default; override only what differs.', '默认继承公共设置，仅覆盖需要更改的项。')} />
    {(Object.keys(common) as (keyof Settings)[]).map(key => <section className="studio-component" key={key}><div className="studio-component-body"><SectionHead title={labels[key]} />{field(t('설정 방식', 'Source', '设置来源'), select(agent.overrides[key] === undefined ? 'inherit' : 'custom', [['inherit', inherit], ['custom', custom]], value => { const overrides = { ...agent.overrides }; if (value === 'inherit') delete overrides[key]; else overrides[key] = common[key]; update({ overrides }); }))}{agent.overrides[key] !== undefined && field(custom, editor(key, agent.overrides[key]!, value => update({ overrides: { ...agent.overrides, [key]: value } })))}<div className="studio-effect"><span>{t('최종 값 · 출처', 'Effective value / source', '最终值 / 来源')}</span><p>{display(key, effective[key])}</p><p>{agent.overrides[key] === undefined ? inherit : custom}</p></div></div></section>)}
    <Note>{t('목업에서는 재정의가 공통 값을 대체합니다. 개별 spill·대기 적용 가능성은 추후 검증합니다.', 'Overrides replace shared values in this prototype. Per-agent spill and wait support remain unverified.', '原型中的覆盖将替换公共值。每个代理的 spill 和等待支持尚未验证。')}</Note>
  </>;
  const tabs = [
    { id: 'tools', label: t('프롬프트·도구', 'Prompts & tools', '提示词与工具'), content: <PromptToolsPrototype key={draftKey} locale={locale} catalog={catalog} catalogError={catalogError} onPreview={onPreview ? request => onPreview({ ...request, execution: activeExecution }) : undefined} onRequestChange={setRequest} prompt={common.prompt} onPromptChange={value => setCommon(c => ({ ...c, prompt: value }))} provided={provided} onProvidedChange={setProvided} /> },
    { id: 'convenience', label: t('실행 설정', 'Execution settings', '执行设置'), content: <ExecutionSettings locale={locale} catalog={catalog} selected={provided} value={execution} onChange={setExecution} /> },
    { id: 'agents', label: t('서브에이전트 설정', 'Subagent settings', '子代理设置'), content: agentPage },
  ];
  const tabId = React.useId();
  return <DetailLayout title="Studio" navigation={t('프리셋 메뉴', 'Preset navigation', '预设导航')} group="" selected={page} onSelect={setPage} pages={[
    { id: 'list', label: t('프리셋 목록', 'Preset list', '预设列表'), content: <PresetList locale={locale} api={presetActions} revision={revision} /> },
    { id: 'create', label: t('프리셋 생성', 'Create preset', '创建预设'), content: <><PageHead title={t('프리셋 생성', 'Create preset', '创建预设')} actions={<Button primary disabled={saving || !presetActions || !request || !name.trim()} onClick={() => void save()}>{saving ? t('저장 중…', 'Saving…', '保存中…') : t('프리셋 저장', 'Save preset', '保存预设')}</Button>} />
      {saveError && <Note>{saveError}</Note>}
      <div className="studio-field-grid">{field(t('프리셋 이름', 'Preset name', '预设名称'), <input value={name} onChange={e => setName(e.target.value)} />)}{field(t('설명', 'Description', '描述'), <input value={description} onChange={e => setDescription(e.target.value)} />)}</div>
      <div className="studio-tabs" role="tablist" aria-label={t('프리셋 구성', 'Preset configuration', '预设配置')}>{tabs.map((item, index) => <button type="button" role="tab" id={`${tabId}-${item.id}-tab`} aria-controls={`${tabId}-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} key={item.id} onClick={() => setTab(item.id)} onKeyDown={e => { const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1; if (next < 0) return; e.preventDefault(); setTab(tabs[next]!.id); document.getElementById(`${tabId}-${tabs[next]!.id}-tab`)?.focus(); }}>{item.label}</button>)}</div>
      {tabs.map(item => <section role="tabpanel" id={`${tabId}-${item.id}`} aria-labelledby={`${tabId}-${item.id}-tab`} key={item.id} hidden={tab !== item.id}>{item.content}</section>)}
    </> },
  ]} />;
}
