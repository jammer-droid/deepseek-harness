import React from 'react';
import { SelectionTransfer } from './selection-transfer.tsx';
import { Button, Note, PageHead, SectionHead } from './ui.tsx';
import { mergePresetTools, type PresetCatalog } from './preset-catalog.ts';
import type { PreviewAction, PreviewResult } from './prompt-composition.ts';

export const defaultProvidedTools = ['read', 'grep', 'glob'];
export function PromptToolsPrototype({ locale, prompt, onPromptChange, provided, onProvidedChange, catalog, catalogError, onPreview }: {
  catalog?: PresetCatalog | undefined; catalogError?: string | undefined; onPreview?: PreviewAction | undefined;
  locale: string; prompt: string; onPromptChange: (value: string) => void;
  provided: string[]; onProvidedChange: (value: string[]) => void;
}) {
  const t = (ko: string, en: string, zh: string) => locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [base, setBase] = React.useState('standard');
  const [providers, setProviders] = React.useState<string[]>([]);
  const [model, setModel] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [toolPresets, setToolPresets] = React.useState<string[]>([]);
  const [manual, setManual] = React.useState(provided);
  const [excluded, setExcluded] = React.useState<string[]>([]);
  const [result, setResult] = React.useState<PreviewResult>();
  const [resultKey, setResultKey] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [stage, setStage] = React.useState('');
  const id = React.useId();
  const presets = catalog?.presets ?? [];
  const tools = catalog?.tools ?? [];
  const current = presets.find(preset => preset.id === base);
  const request = { preset: base, providers, tools: provided, prompt, model };
  const requestKey = JSON.stringify(request);
  const labels = { available: t('사용 가능', 'Available', '可用'), selected: t('선택됨', 'Selected', '已选'), add: t('추가 →', 'Add →', '添加 →'), remove: t('← 제외', '← Remove', '← 移除'), empty: t('항목 없음', 'No items', '无项目') };
  const togglePreset = (presetId: string) => {
    const active = toolPresets.includes(presetId) ? toolPresets.filter(p => p !== presetId) : [...toolPresets, presetId];
    const nextExcluded = excluded.filter(name => !presets.find(p => p.id === presetId)?.tools.some(tool => tool.name === name));
    setToolPresets(active); setExcluded(nextExcluded);
    onProvidedChange(mergePresetTools(manual, presets, active, nextExcluded));
  };
  const changeTools = (next: string[]) => {
    const removed = provided.filter(name => !next.includes(name));
    const added = next.filter(name => !provided.includes(name));
    setManual([...new Set([...manual.filter(name => !removed.includes(name)), ...added])]);
    setExcluded([...new Set([...excluded.filter(name => !added.includes(name)), ...removed])]);
    onProvidedChange(next);
  };
  const preview = async () => {
    if (!onPreview) return;
    setBusy(true); setError(''); setResult(undefined);
    try { const value = await onPreview(request); setResult(value); setResultKey(requestKey); setStage(value.sections[0]?.name ?? ''); }
    catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  };
  return <React.Fragment>
    <PageHead title={t('프롬프트·도구', 'Prompts & tools', '提示词与工具')} description={t('프롬프트 플러그인과 도구를 선택하고 DSH 조립기로 미리 봅니다. 설정은 아직 저장되지 않습니다.', 'Select prompt plugins and tools, then preview with the DSH assembler. Configuration is not saved yet.', '选择提示词插件和工具后使用 DSH 组装器预览。配置尚未保存。')} />
    {catalogError ? <Note>{catalogError}</Note> : !catalog ? <Note>{t('불러오는 중…', 'Loading…', '正在加载…')}</Note> : null}
    <SectionHead title={t('프롬프트 조립', 'Prompt composition', '提示词组装')} />
    <label className="studio-field"><span>{t('제공자 기준 프리셋', 'Provider source preset', '提供者来源预设')}</span><select value={base} onChange={e => { setBase(e.target.value); setProviders([]); }}>{presets.filter(p => ['standard', 'ptc', 'minimal', 'cordis'].includes(p.id)).map(p => <option key={p.id} value={p.id} disabled={!!p.error}>{p.id === 'cordis' ? 'creator (cordis)' : p.id}</option>)}</select></label>
    <Note>{t('DSH 기본 공통 지침은 항상 포함됩니다. 아래는 기준 프리셋에서 확인한 persona·프로젝트 지침·시간 플러그인입니다. persona의 complete 설정은 다른 지침을 대체할 수 있습니다.', 'Global DSH guidance always participates. Below are vetted persona, project-instruction and time plugins from the source preset. A complete persona can replace other instructions.', '始终包含 DSH 全局指令。以下是来源预设中的 persona、项目指令和时间插件。complete persona 可能替换其他指令。')}</Note>
    <SelectionTransfer items={current?.promptProviders ?? []} selected={providers} onChange={setProviders} labels={labels} />
    <label className="studio-field"><span>{t('Studio 추가 지침', 'Additional Studio instructions', 'Studio 附加指令')}</span><textarea rows={8} value={prompt} onChange={e => onPromptChange(e.target.value)} /></label>
    <label className="studio-field"><span>{t('미리보기 모델명 · {{model}} 치환용', 'Preview model name · for {{model}} interpolation', '预览模型名称 · 用于 {{model}} 替换')}</span><input value={model} onChange={e => setModel(e.target.value)} /></label>
    <Button disabled={!onPreview || !current || busy} onClick={() => void preview()}>{busy ? t('조립 중…', 'Assembling…', '组装中…') : t('프롬프트 미리보기', 'Preview prompt', '预览提示词')}</Button>
    {error && <Note>{error}</Note>}
    {result && <section aria-label={t('프롬프트 미리보기', 'Prompt preview', '提示词预览')}>
      <Note>{resultKey !== requestKey ? t('설정이 변경되었습니다. 미리보기를 다시 실행하세요.', 'Configuration changed. Run preview again.', '配置已更改，请重新预览。') : t('DSH assemble/render 결과입니다. 세션 없는 스냅샷이며 런타임 컨텍스트와 도구 스키마는 별도입니다.', 'DSH assemble/render output. Sessionless snapshot; runtime context and tool schemas are separate.', 'DSH assemble/render 结果。无会话快照；运行时上下文和工具定义单独显示。')}</Note>
      <div className="studio-prompt-workbench"><nav className="studio-prompt-stages">{result.sections.map((section, index) => <Button key={section.name} aria-current={stage === section.name ? 'step' : undefined} onClick={() => { setStage(section.name); document.getElementById(`${id}-${index}`)?.scrollIntoView?.({ block: 'nearest' }); }}>{section.name}</Button>)}</nav><div className="studio-prompt-document">{result.sections.map((section, index) => <section key={section.name} id={`${id}-${index}`} className="studio-prompt-section" data-selected={stage === section.name}><h3>{section.name}</h3><p className="studio-tool-description">{section.text}</p></section>)}</div></div>
      <details><summary>{t('완성된 시스템 프롬프트 원문', 'Complete system prompt', '完整系统提示词')}</summary><pre className="studio-effect">{result.prompt}</pre></details>
      <details><summary>{t('런타임 컨텍스트', 'Runtime context', '运行时上下文')}</summary><pre className="studio-effect">{result.context}</pre></details>
      <details><summary>{t('모델에 제공할 도구 스키마', 'Model-facing tool schemas', '提供给模型的工具定义')}</summary><pre className="studio-effect">{JSON.stringify(result.tools, null, 2)}</pre></details>
    </section>}
    <SectionHead title={t('제공 도구', 'Provided tools', '提供的工具')} description={t('도구 설명 원문은 읽기 전용입니다. 기준 프리셋에 없는 도구를 선택하면 미리보기에서 오류로 알려줍니다.', 'Tool descriptions are read-only. Selecting a tool absent from the source preset produces a preview error.', '工具描述为只读。选择来源预设中不存在的工具会在预览时报错。')} />
    <div className="studio-row">{presets.filter(p => ['standard', 'ptc', 'minimal', 'cordis', 'creator'].includes(p.id)).map(p => <label key={p.id}><input type="checkbox" disabled={!!p.error} checked={toolPresets.includes(p.id)} onChange={() => togglePreset(p.id)} />{p.id === 'cordis' ? 'creator (cordis)' : p.id}</label>)}</div>
    <label className="studio-field"><span>{t('도구 검색', 'Search tools', '搜索工具')}</span><input value={query} onChange={e => setQuery(e.target.value)} /></label>
    <SelectionTransfer items={[...tools, ...provided.filter(name => !tools.some(tool => tool.name === name)).map(name => ({ name, description: t('현재 카탈로그에 없음', 'Absent from current catalog', '不在当前目录中') }))].filter(tool => `${tool.name}\n${tool.description}`.toLowerCase().includes(query.toLowerCase()))} selected={provided} onChange={changeTools} labels={labels} />
  </React.Fragment>;
}
