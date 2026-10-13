import React from 'react';
import { SelectionTransfer } from './selection-transfer.tsx';
import { Button, Note, PageHead, SectionHead } from './ui.tsx';
import { mergePresetTools, type PresetCatalog } from './preset-catalog.ts';
import type { PreviewAction, PreviewResult } from './prompt-composition.ts';

export const defaultProvidedTools: string[] = [];
export function PromptToolsPrototype({ locale, prompt, onPromptChange, provided, onProvidedChange, catalog, catalogError, onPreview }: {
  catalog?: PresetCatalog | undefined; catalogError?: string | undefined; onPreview?: PreviewAction | undefined;
  locale: string; prompt: string; onPromptChange: (value: string) => void;
  provided: string[]; onProvidedChange: (value: string[]) => void;
}) {
  const t = (ko: string, en: string, zh: string) => locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const base = 'minimal';
  const [toolOverrides, setToolOverrides] = React.useState<Record<string, { description?: string; parameters?: Record<string, string> }>>({});
  const [sections, setSections] = React.useState<Record<string, string>>({});
  const providers = ['@deepseek-ai/dsh-persona'];
  const [providerConfigs, setProviderConfigs] = React.useState<Record<string, Record<string, unknown>>>({});
  const [query, setQuery] = React.useState('');
  const [toolPresets, setToolPresets] = React.useState<string[]>([]);
  const [manual, setManual] = React.useState(provided);
  const [excluded, setExcluded] = React.useState<string[]>([]);
  const [result, setResult] = React.useState<PreviewResult>();
  const [resultKey, setResultKey] = React.useState('');
  const [error, setError] = React.useState('');
  const previewDialog = React.useRef<HTMLDialogElement>(null);
  const previewTitleId = React.useId();
  const previewTrigger = React.useRef<HTMLElement | null>(null);
  const closePreview = () => { previewDialog.current?.close(); previewTrigger.current?.focus(); };
  const [busy, setBusy] = React.useState(false);
  const presets = catalog?.presets ?? [];
  const tools = catalog?.tools ?? [];
  const current = presets.find(preset => preset.id === base);
  const selectedSections = new Set(tools.filter(tool => provided.includes(tool.name)).flatMap(tool => tool.promptSections?.map(section => section.name) ?? []));
  const request = { preset: base, providers, tools: provided, prompt, model: 'testLLM',
    toolOverrides: Object.fromEntries(Object.entries(toolOverrides).filter(([name]) => provided.includes(name))),
    sections: Object.fromEntries(Object.entries(sections).filter(([name]) => selectedSections.has(name))),
    providerConfigs: Object.fromEntries(Object.entries(providerConfigs).filter(([name]) => providers.includes(name))),
  };
  const personaFields = current?.promptProviders?.find(provider => provider.name === providers[0])?.fields ?? [];
  const requestKey = JSON.stringify(request);
  const labels = { available: t('사용 가능', 'Available', '可用'), selected: t('선택됨', 'Selected', '已选'), add: t('추가 →', 'Add →', '添加 →'), remove: t('← 제외', '← Remove', '← 移除'), empty: t('항목 없음', 'No items', '无项目'), details: t('상세', 'Details', '详情'), close: t('닫기', 'Close', '关闭') };
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
    previewTrigger.current = document.activeElement as HTMLElement | null;
    previewDialog.current?.showModal();
    setBusy(true); setError(''); setResult(undefined);
    try { const value = await onPreview(request); setResult(value); setResultKey(requestKey); }
    catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  };
  return <React.Fragment>
    <PageHead title={t('프롬프트·도구', 'Prompts & tools', '提示词与工具')} description={t('Persona·Studio 지침과 도구를 편집하고 조립 결과를 확인합니다. 설정은 아직 저장되지 않습니다.', 'Edit Persona, Studio instructions and tools, then preview the assembled result. Configuration is not saved yet.', '编辑 Persona、Studio 指令与工具并预览组装结果。配置尚未保存。')} actions={<Button disabled={!onPreview || !current || busy} onClick={() => void preview()}>{busy ? t('조립 중…', 'Assembling…', '组装中…') : t('프롬프트 미리보기', 'Preview prompt', '预览提示词')}</Button>} />
    {catalogError ? <Note>{catalogError}</Note> : !catalog ? <Note>{t('불러오는 중…', 'Loading…', '正在加载…')}</Note> : null}
    <SectionHead title={t('프롬프트 조립', 'Prompt composition', '提示词组装')} />
    <Note>{t('Persona와 Studio 전용 지침을 편집합니다. 변경은 미리보기에만 적용되며 실제 대화에는 아직 적용되지 않습니다.', 'Edit Persona and Studio instructions. Changes apply to preview only, not live conversations yet.', '编辑 Persona 与 Studio 专用指令。更改仅用于预览，尚未应用到实际对话。')}</Note>
    {(['prefix', 'suffix'] as const).map(key => {
      const name = providers[0]!;
      const config = providerConfigs[name] ?? {};
      const original = personaFields.find(field => field.key === key)?.value;
      return <React.Fragment key={key}><label className="studio-field"><span>{key === 'prefix' ? t('Persona 기본 지침', 'Persona instructions', 'Persona 基本指令') : t('Persona 후행 지침', 'Persona suffix', 'Persona 后置指令')}</span><textarea rows={key === 'prefix' ? 6 : 3} value={typeof config[key] === 'string' ? config[key] : typeof original === 'string' ? original : ''} onChange={e => setProviderConfigs({ ...providerConfigs, [name]: { ...config, [key]: e.target.value } })} /></label><Button small disabled={!Object.hasOwn(config, key)} onClick={() => { const next = { ...config }; delete next[key]; setProviderConfigs({ ...providerConfigs, [name]: next }); }}>{t('원본 사용', 'Use original', '使用原始值')}</Button></React.Fragment>;
    })}
    <label className="studio-field"><span>{t('Studio 추가 지침', 'Additional Studio instructions', 'Studio 附加指令')}</span><textarea rows={8} value={prompt} onChange={e => onPromptChange(e.target.value)} /></label>
    <SectionHead title={t('제공 도구', 'Provided tools', '提供的工具')} description={t('상세에서 설명을 편집합니다. 원본 사용으로 돌아갈 수 있으며 실행 구현은 변경하지 않습니다.', 'Edit descriptions in Details. Reset to the original at any time; execution implementations are unchanged.', '在详情中编辑描述，可恢复原始值；执行实现保持不变。')} />
    <div className="studio-row">{presets.filter(p => ['standard', 'ptc', 'minimal', 'cordis', 'creator'].includes(p.id)).map(p => <Button key={p.id} disabled={!!p.error} aria-pressed={toolPresets.includes(p.id)} onClick={() => togglePreset(p.id)}>{p.id === 'cordis' ? 'creator (cordis)' : p.id}</Button>)}</div>
    <label className="studio-field"><span>{t('도구 검색', 'Search tools', '搜索工具')}</span><input value={query} onChange={e => setQuery(e.target.value)} /></label>
    <SelectionTransfer items={[...tools, ...provided.filter(name => !tools.some(tool => tool.name === name)).map(name => ({ name, description: t('현재 카탈로그에 없음', 'Absent from current catalog', '不在当前目录中') }))].filter(tool => `${tool.name}\n${tool.description}`.toLowerCase().includes(query.toLowerCase()))} selected={provided} onChange={changeTools} labels={labels} renderDetails={name => {
      const tool = tools.find(tool => tool.name === name);
      const parameters = parameterFields(tool?.parameters);
      const override = toolOverrides[name];
      return <><Note>{t('변경은 편집 초안에 즉시 반영됩니다. 선택한 도구만 미리보기에 적용되며 실제 대화에는 적용되지 않습니다.', 'Edits update the draft immediately. Only selected tools affect preview; live conversations are unchanged.', '编辑立即更新草稿。仅选中的工具影响预览，不影响实际对话。')}</Note><SectionHead title={t('도구 설명', 'Tool description', '工具描述')} description={t('모델에 전달되는 도구 전체의 설명입니다.', 'The overall tool description sent to the model.', '发送给模型的工具整体描述。')} /><label className="studio-field"><span>{t('도구 설명', 'Tool description', '工具描述')}</span><textarea value={override?.description ?? tool?.description ?? ''} onChange={e => setToolOverrides({ ...toolOverrides, [name]: { ...override, description: e.target.value } })} /></label>
        <SectionHead title={t('도구 사용 지침', 'Tool usage instructions', '工具使用指令')} description={t('시스템 프롬프트 본문에 반영되는 사용 규칙입니다. 같은 섹션을 사용하는 도구끼리는 지침을 공유합니다.', 'Usage rules included in the system prompt. Tools referencing the same section share these instructions.', '包含在系统提示词中的使用规则。引用同一章节的工具共享这些指令。')} />
        {!tool?.promptSections?.length && <Note>{t('별도로 편집할 수 있는 사용 지침이 없습니다.', 'No separately editable usage instructions.', '没有可单独编辑的使用指令。')}</Note>}
        {tool?.promptSections?.map(section => <section key={section.name}><label className="studio-field"><span>{section.name}</span><textarea rows={5} value={sections[section.name] ?? section.text} onChange={e => setSections({ ...sections, [section.name]: e.target.value })} /></label><Button small disabled={!Object.hasOwn(sections, section.name)} onClick={() => { const next = { ...sections }; delete next[section.name]; setSections(next); }}>{t('원본 사용', 'Use original', '使用原始值')}</Button></section>)}
        <SectionHead title={t('인자 설명', 'Parameter descriptions', '参数描述')} description={t('도구 스키마의 설명 문구만 편집합니다. 인자 이름·타입·필수 여부·제약은 변경하지 않습니다.', 'Edit only description text within the tool schema. Names, types, required status and constraints remain unchanged.', '仅编辑工具定义中的说明文字。名称、类型、必填状态与约束保持不变。')} />
        {!parameters.length && <Note>{t('편집 가능한 인자가 없습니다.', 'No editable parameters.', '没有可编辑的参数。')}</Note>}
        {parameters.map(parameter => <label className="studio-field" key={parameter.path}><span>{parameter.path} <span className="studio-schema-meta">{parameter.type} · {parameter.required ? t('필수', 'required', '必填') : t('선택', 'optional', '可选')}</span></span><textarea aria-label={parameter.path} value={override?.parameters?.[parameter.path] ?? parameter.description} onChange={e => setToolOverrides({ ...toolOverrides, [name]: { ...override, parameters: { ...override?.parameters, [parameter.path]: e.target.value } } })} /></label>)}
        <Button small disabled={!override} onClick={() => { const next = { ...toolOverrides }; delete next[name]; setToolOverrides(next); }}>{t('원본 사용', 'Use original', '使用原始值')}</Button>
      </>;

    }} />

    <dialog ref={previewDialog} className="studio-detail-dialog" aria-labelledby={previewTitleId} onCancel={e => { e.preventDefault(); closePreview(); }}>
      <div className="studio-selection-detail">
        <div className="studio-row"><h2 id={previewTitleId}>{t('프롬프트 결과 미리보기', 'Prompt result preview', '提示词结果预览')}</h2><Button onClick={closePreview}>{t('닫기', 'Close preview', '关闭预览')}</Button></div>
        {busy && <Note>{t('조립 중…', 'Assembling…', '组装中…')}</Note>}
    {error && <Note>{error}</Note>}
    {result && <section aria-label={t('프롬프트 미리보기', 'Prompt preview', '提示词预览')}>
      <Note>{resultKey !== requestKey ? t('설정이 변경되었습니다. 미리보기를 다시 실행하세요.', 'Configuration changed. Run preview again.', '配置已更改，请重新预览。') : t('DSH assemble/render 결과입니다. 세션 없는 스냅샷이며 환경 기여는 유지하며 도구 스키마는 본문 뒤에 표시합니다.', 'DSH assemble/render output. Sessionless snapshot; environment contributions are preserved; tool schemas follow the sections.', 'DSH assemble/render 结果。无会话快照；保留环境贡献；工具定义显示在正文后。')}</Note>
      <div className="studio-prompt-document" tabIndex={0} aria-label={t('조립 순서와 내용', 'Assembly order and content', '组装顺序和内容')}>
        {result.sections.map((section, index) => <section key={section.name} className="studio-prompt-section"><h3><span className="studio-schema-meta">{index + 1} · </span>{section.name}</h3><p className="studio-tool-description">{section.text}</p></section>)}
        <section className="studio-prompt-tools"><h3>{t('모델에 제공할 도구 스키마', 'Model-facing tool schemas', '提供给模型的工具定义')}</h3>{result.tools.length ? result.tools.map(tool => <details className="studio-schema-tool" key={tool.name}><summary>{tool.name}</summary><p className="studio-tool-description">{tool.description}</p><SchemaValue value={tool.parameters} /></details>) : <p>{labels.empty}</p>}</section>
      </div>
    </section>}
      </div>
    </dialog>
  </React.Fragment>;
}

/** Render every schema keyword recursively without hiding constraints in raw JSON. */
function SchemaValue({ value }: { value: unknown }): React.ReactElement {
  if (Array.isArray(value)) return <ul className="studio-schema-list">{value.map((entry, index) => <li key={index}><SchemaValue value={entry} /></li>)}</ul>;
  if (value !== null && typeof value === 'object') return <dl className="studio-schema-fields">{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{key}</dt><dd>{key === 'properties' || key === 'items' || key === '$defs' ? <details><summary>{key}</summary><SchemaValue value={entry} /></details> : <SchemaValue value={entry} />}</dd></div>)}</dl>;
  return <span className="studio-tool-description">{String(value)}</span>;
}

/** Description-only paths match the composition override contract; schema structure stays read-only. */
function parameterFields(schema: unknown, prefix = ''): { path: string; type: string; required: boolean; description: string }[] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [];
  const row = schema as Record<string, unknown>;
  if (!row.properties || typeof row.properties !== 'object' || Array.isArray(row.properties)) return [];
  return Object.entries(row.properties).flatMap(([key, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const field = value as Record<string, unknown>;
    const path = prefix ? `${prefix}.${key}` : key;
    return [{ path, type: Array.isArray(field.type) ? field.type.join(' | ') : typeof field.type === 'string' ? field.type : '—', required: Array.isArray(row.required) && row.required.includes(key), description: typeof field.description === 'string' ? field.description : '' }, ...parameterFields(field, path)];
  });
}
