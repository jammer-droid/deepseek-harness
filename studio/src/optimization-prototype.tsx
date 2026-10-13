// UI prototype only: memory state, no runtime configuration or agent calls.
import React from 'react';
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
export function OptimizationPrototype({ locale, catalog, catalogError, onPreview, exportPreset }: { exportPreset?: import('./prompt-composition.ts').ExportAction | undefined; onPreview?: import('./prompt-composition.ts').PreviewAction | undefined; locale: string; catalog?: import('./preset-catalog.ts').PresetCatalog | undefined; catalogError?: string | undefined }) {
  const t = (ko: string, en: string, zh: string) => locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [page, setPage] = React.useState('agents');
  const [common, setCommon] = React.useState<Settings>({ ...initial });
  const [agents, setAgents] = React.useState<Agent[]>(() => seeds.map(a => ({ ...a, overrides: { ...a.overrides } })));
  const [selected, setSelected] = React.useState(0);
  const [provided, setProvided] = React.useState<string[]>(defaultProvidedTools);
  const [batch, setBatch] = React.useState('8');
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
  const mockNote = <Note>{t('UI 목업 · 변경은 이 화면에만 유지됩니다. 실제 호출·권한 제한·DSH 설정 변경은 수행하지 않습니다.', 'UI prototype · Changes stay in memory. No agent calls, permission enforcement or DSH configuration changes.', 'UI 原型 · 修改仅保留在内存中，不调用代理、不限制权限、不修改 DSH 配置。')}</Note>;
  const sharedCard = (key: keyof Settings) => <section className="studio-component" key={key}><div className="studio-component-body"><SectionHead title={labels[key]} />{field(t('공통 기본값', 'Shared default', '公共默认值'), editor(key, common[key], value => setCommon(c => ({ ...c, [key]: value }))))}<p className="studio-muted">{t('상속 중인 서브에이전트에 반영됩니다. 현재 DSH 프로필에는 적용되지 않습니다.', 'Inherited by subagents without an override. Does not modify the current DSH profile.', '由未覆盖此设置的子代理继承，不修改当前 DSH 配置。')}</p></div></section>;
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
  return <DetailLayout title={t('최적화', 'Optimization', '优化')} navigation={t('최적화 메뉴', 'Optimization navigation', '优化导航')} group={t('설정 초안', 'Configuration draft', '配置草案')} selected={page} onSelect={setPage} pages={[
    { id: 'agents', label: t('서브에이전트 설정', 'Subagent settings', '子代理设置'), content: agentPage },
    { id: 'prompt', label: t('프롬프트·도구', 'Prompts & tools', '提示词与工具'), content: <PromptToolsPrototype {...(exportPreset ? { exportPreset } : {})} onPreview={onPreview} locale={locale} catalog={catalog} catalogError={catalogError} prompt={common.prompt} onPromptChange={prompt => setCommon(c => ({ ...c, prompt }))} provided={provided} onProvidedChange={tools => { setProvided(tools); setCommon(c => ({ ...c, tools: tools.join(' / ') })); }} /> },
    { id: 'convenience', label: t('작업 편의', 'Task utilities', '任务辅助'), content: <><PageHead title={t('작업 편의', 'Task utilities', '任务辅助')} description={t('기존 DSH 기능을 재사용하는 공통 옵션입니다.', 'Shared options that reuse existing DSH capabilities.', '复用现有 DSH 功能的公共选项。')} />{mockNote}{sharedCard('spill')}{sharedCard('wait')}<section className="studio-component"><div className="studio-component-body"><SectionHead title={t('읽기 전용 batch', 'Read-only batch', '只读批量操作')} />{field(t('최대 항목 수 · 목업', 'Maximum items · mock', '最大项数 · 原型'), select(batch, [['4', '4'], ['8', '8']], setBatch))}<p className="studio-muted">read / grep / glob</p></div></section><Note>{t('Spill은 추정 토큰 예산이며 hard cap이 아닙니다. batch 항목 수는 목업 값이며 실제 제한이 아닙니다.', 'Spill uses an estimated token budget, not a hard cap. Batch limits are mock values, not enforcement.', 'Spill 使用估算 token 预算，而非硬上限。批量限制仅为原型值。')}</Note></> },
    { id: 'export', label: t('프리셋 내보내기', 'Export preset', '导出预设'), content: <><PageHead title={t('프리셋 내보내기', 'Export preset', '导出预设')} description={t('공통 옵션과 서브에이전트 구성을 DSH에 전달하는 단계입니다.', 'Package shared options and subagent configurations for DSH.', '将公共选项与子代理配置打包供 DSH 使用。')} />{mockNote}<SectionHead title={t('현재 초안 미리보기', 'Current draft preview', '当前草案预览')} /><pre className="studio-effect">{JSON.stringify({ prototype: true, common, providedTools: provided, batch: { maxItems: Number(batch) }, agents }, null, 2)}</pre><Button disabled primary>{t('프리셋 내보내기 · 미연결', 'Export preset · not connected', '导出预设 · 尚未连接')}</Button><Note>{t('이 JSON은 상태 확인용이며 설치 가능한 DSH 프리셋이 아닙니다. 기존 프로필을 자동 변경하지 않습니다.', 'This JSON displays draft state; it is not an installable DSH preset. Existing profiles are never modified.', '此 JSON 仅用于查看草案状态，不是可安装的 DSH 预设。不自动修改现有配置。')}</Note></> },
  ]} />;
}
