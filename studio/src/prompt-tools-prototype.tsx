import React from 'react';
import { SelectionTransfer } from './selection-transfer.tsx';
import { Button, Note, PageHead, SectionHead } from './ui.tsx';
import { mergePresetTools, type PresetCatalog } from './preset-catalog.ts';
import type { PreviewAction, PreviewResult } from './prompt-composition.ts';

export const defaultProvidedTools = ['read', 'grep', 'glob'];
export function PromptToolsPrototype({ locale, prompt, onPromptChange, provided, onProvidedChange, catalog, catalogError, onPreview, exportPreset }: {
  exportPreset?: (request: Parameters<PreviewAction>[0]) => Promise<{ files: Record<string, string> }>;
  catalog?: PresetCatalog | undefined; catalogError?: string | undefined; onPreview?: PreviewAction | undefined;
  locale: string; prompt: string; onPromptChange: (value: string) => void;
  provided: string[]; onProvidedChange: (value: string[]) => void;
}) {
  const t = (ko: string, en: string, zh: string) => locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const base = 'minimal';
  const [persona, setPersona] = React.useState<string>();
  const [toolOverrides, setToolOverrides] = React.useState<Record<string, { description?: string; parameters?: Record<string, string> }>>({});
  const [sections, setSections] = React.useState<Record<string, string>>({});
  const [providers, setProviders] = React.useState<string[]>([]);
  const [providerConfigs, setProviderConfigs] = React.useState<Record<string, Record<string, unknown>>>({});
  const [model, setModel] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [toolPresets, setToolPresets] = React.useState<string[]>([]);
  const [manual, setManual] = React.useState(provided);
  const [excluded, setExcluded] = React.useState<string[]>([]);
  const [result, setResult] = React.useState<PreviewResult>();
  const [resultKey, setResultKey] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const presets = catalog?.presets ?? [];
  const tools = catalog?.tools ?? [];
  const current = presets.find(preset => preset.id === base);
  const request = { preset: base, providers, tools: provided, prompt, model, ...(persona === undefined ? {} : { persona }), toolOverrides, sections, providerConfigs };
  const allProviders = [...new Map(presets.flatMap(p => p.promptProviders ?? []).map(p => [p.name, p])).values()];
  const requestKey = JSON.stringify(request);
  const labels = { available: t('사용 가능', 'Available', '可用'), selected: t('선택됨', 'Selected', '已选'), add: t('추가 →', 'Add →', '添加 →'), remove: t('← 제외', '← Remove', '← 移除'), empty: t('항목 없음', 'No items', '无项目'), details: t('상세', 'Details', '详情') };
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
    try { const value = await onPreview(request); setResult(value); setResultKey(requestKey); }
    catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  };
  return <React.Fragment>
    <PageHead title={t('프롬프트·도구', 'Prompts & tools', '提示词与工具')} description={t('프롬프트 플러그인과 도구를 선택하고 DSH 조립기로 미리 봅니다. 설정은 아직 저장되지 않습니다.', 'Select prompt plugins and tools, then preview with the DSH assembler. Configuration is not saved yet.', '选择提示词插件和工具后使用 DSH 组装器预览。配置尚未保存。')} />
    {catalogError ? <Note>{catalogError}</Note> : !catalog ? <Note>{t('불러오는 중…', 'Loading…', '正在加载…')}</Note> : null}
    <SectionHead title={t('프롬프트 조립', 'Prompt composition', '提示词组装')} />
    <Note>{t('minimal 복사본으로 구성합니다. 환경 자동 지침은 선택 대상이 아니며 유지됩니다.', 'Build a minimal-based copy. Automatic environment guidance is preserved, not selectable.', '基于 minimal 副本构建。自动环境指令保留且不可选择。')}</Note>
    <SelectionTransfer items={allProviders} selected={providers} onChange={setProviders} labels={labels} renderDetails={name => {
      const config = providerConfigs[name] ?? {};
      const update = (key: string, value: unknown) => setProviderConfigs({ ...providerConfigs, [name]: { ...config, [key]: value } });
      const reset = () => { const next = { ...providerConfigs }; delete next[name]; setProviderConfigs(next); };
      const original = t('원본 사용', 'Use original', '使用原始值');
      return <>{name === '@deepseek-ai/dsh-persona' ? <>
        <label className="studio-field"><span>{t('Persona 후행 문구', 'Persona suffix', 'Persona 后缀')}</span><textarea value={typeof config.suffix === 'string' ? config.suffix : ''} placeholder={original} onChange={e => update('suffix', e.target.value)} /></label>
        <label className="studio-field"><span>{t('런타임 컨텍스트 포함', 'Include runtime context', '包含运行时上下文')}</span><select value={typeof config.includeRuntimeContext === 'boolean' ? String(config.includeRuntimeContext) : 'original'} onChange={e => { if (e.target.value === 'original') { const next = { ...config }; delete next.includeRuntimeContext; setProviderConfigs({ ...providerConfigs, [name]: next }); } else update('includeRuntimeContext', e.target.value === 'true'); }}><option value="original">{original}</option><option value="true">{t('포함', 'Include', '包含')}</option><option value="false">{t('제외', 'Exclude', '排除')}</option></select></label>
      </> : name === '@deepseek-ai/dsh-agent-instructions' ? <label className="studio-field"><span>maxBytes</span><input type="number" min={1} step={1} placeholder={original} value={typeof config.maxBytes === 'number' ? config.maxBytes : ''} onChange={e => { const value = Number(e.target.value); if (Number.isSafeInteger(value) && value > 0) update('maxBytes', value); }} /></label> : <Note>{t('편집 가능한 공개 설정이 없습니다.', 'No editable public settings.', '没有可编辑的公开设置。')}</Note>}
      {name !== '@deepseek-ai/dsh-time-context' && <Button small disabled={!Object.hasOwn(providerConfigs, name)} onClick={reset}>{original}</Button>}</>;
    }} />
    <label className="studio-field"><span>{t('Persona · 비워 두면 빈 문구로 변경', 'Persona · clearing overrides with empty text', 'Persona · 清空将覆盖为空文本')}</span><textarea rows={3} placeholder={t('원본 사용', 'Use original', '使用原始值')} value={persona ?? ''} onChange={e => setPersona(e.target.value)} /></label>
    <Button small disabled={persona === undefined} onClick={() => setPersona(undefined)}>{t('Persona 원본 사용', 'Use original persona', '使用原始 Persona')}</Button>
    <details><summary>tool:jobs</summary><label className="studio-field"><span>{t('작업 관리 지침', 'Job management instructions', '任务管理指令')}</span><textarea value={sections['tool:jobs'] ?? ''} placeholder={t('원본 사용', 'Use original', '使用原始值')} onChange={e => setSections({ 'tool:jobs': e.target.value })} /></label><Button small disabled={!Object.hasOwn(sections, 'tool:jobs')} onClick={() => setSections({})}>{t('원본 사용', 'Use original', '使用原始值')}</Button></details>
    <label className="studio-field"><span>{t('Studio 추가 지침', 'Additional Studio instructions', 'Studio 附加指令')}</span><textarea rows={8} value={prompt} onChange={e => onPromptChange(e.target.value)} /></label>
    <label className="studio-field"><span>{t('미리보기 모델명 · {{model}} 치환용', 'Preview model name · for {{model}} interpolation', '预览模型名称 · 用于 {{model}} 替换')}</span><input value={model} onChange={e => setModel(e.target.value)} /></label>
    <Button disabled={!onPreview || !current || busy} onClick={() => void preview()}>{busy ? t('조립 중…', 'Assembling…', '组装中…') : t('프롬프트 미리보기', 'Preview prompt', '预览提示词')}</Button>
    {exportPreset && <Button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const bundle = await exportPreset(request); for (const [name, content] of Object.entries(bundle.files)) { const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } } catch (cause) { setError(String(cause)); } finally { setBusy(false); } }}>{t('프리셋 내보내기', 'Export preset', '导出预设')}</Button>}
    {exportPreset && <Note>{t('여러 파일을 내려받습니다. 브라우저에서 다중 다운로드를 허용하고 파일명을 유지해 같은 폴더에 모으세요.', 'Downloads multiple files. Allow multiple downloads in your browser and keep the original filenames together in one folder.', '将下载多个文件。请允许浏览器多文件下载，并保留原始文件名放在同一文件夹。')}</Note>}
    {error && <Note>{error}</Note>}
    {result && <section aria-label={t('프롬프트 미리보기', 'Prompt preview', '提示词预览')}>
      <Note>{resultKey !== requestKey ? t('설정이 변경되었습니다. 미리보기를 다시 실행하세요.', 'Configuration changed. Run preview again.', '配置已更改，请重新预览。') : t('DSH assemble/render 결과입니다. 세션 없는 스냅샷이며 환경 기여는 유지하며 도구 스키마는 본문 뒤에 표시합니다.', 'DSH assemble/render output. Sessionless snapshot; environment contributions are preserved; tool schemas follow the sections.', 'DSH assemble/render 结果。无会话快照；保留环境贡献；工具定义显示在正文后。')}</Note>
      <div className="studio-prompt-document" tabIndex={0} aria-label={t('조립 순서와 내용', 'Assembly order and content', '组装顺序和内容')}>
        {result.sections.map((section, index) => <section key={section.name} className="studio-prompt-section"><span className="studio-schema-meta">{index + 1}</span><h3>{section.name}</h3><p className="studio-tool-description">{section.text}</p></section>)}
        <section className="studio-prompt-section"><h3>{t('모델에 제공할 도구 스키마', 'Model-facing tool schemas', '提供给模型的工具定义')}</h3>{result.tools.length ? result.tools.map(tool => <details className="studio-schema-tool" key={tool.name}><summary>{tool.name}</summary><p className="studio-tool-description">{tool.description}</p><SchemaValue value={tool.parameters} /></details>) : <p>{labels.empty}</p>}</section>
      </div>
    </section>}
    <SectionHead title={t('제공 도구', 'Provided tools', '提供的工具')} description={t('상세에서 설명을 편집합니다. 원본 사용으로 돌아갈 수 있으며 실행 구현은 변경하지 않습니다.', 'Edit descriptions in Details. Reset to the original at any time; execution implementations are unchanged.', '在详情中编辑描述，可恢复原始值；执行实现保持不变。')} />
    <div className="studio-row">{presets.filter(p => ['standard', 'ptc', 'minimal', 'cordis', 'creator'].includes(p.id)).map(p => <Button key={p.id} disabled={!!p.error} aria-pressed={toolPresets.includes(p.id)} onClick={() => togglePreset(p.id)}>{p.id === 'cordis' ? 'creator (cordis)' : p.id}</Button>)}</div>
    <label className="studio-field"><span>{t('도구 검색', 'Search tools', '搜索工具')}</span><input value={query} onChange={e => setQuery(e.target.value)} /></label>
    <SelectionTransfer items={[...tools, ...provided.filter(name => !tools.some(tool => tool.name === name)).map(name => ({ name, description: t('현재 카탈로그에 없음', 'Absent from current catalog', '不在当前目录中') }))].filter(tool => `${tool.name}\n${tool.description}`.toLowerCase().includes(query.toLowerCase()))} selected={provided} onChange={changeTools} labels={labels} renderDetails={name => {
      const tool = tools.find(tool => tool.name === name);
      const parameters = (tool as { parameters?: { properties?: Record<string, { description?: string }> } } | undefined)?.parameters?.properties ?? {};
      const override = toolOverrides[name];
      return <><label className="studio-field"><span>{t('도구 설명', 'Tool description', '工具描述')}</span><textarea value={override?.description ?? tool?.description ?? ''} onChange={e => setToolOverrides({ ...toolOverrides, [name]: { ...override, description: e.target.value } })} /></label>{Object.entries(parameters).map(([parameter, schema]) => <label className="studio-field" key={parameter}><span>{parameter}</span><textarea value={override?.parameters?.[parameter] ?? schema.description ?? ''} onChange={e => setToolOverrides({ ...toolOverrides, [name]: { ...override, parameters: { ...override?.parameters, [parameter]: e.target.value } } })} /></label>)}<Button small disabled={!override} onClick={() => { const next = { ...toolOverrides }; delete next[name]; setToolOverrides(next); }}>{t('원본 사용', 'Use original', '使用原始值')}</Button></>;
    }} />
  </React.Fragment>;
}

/** Render every schema keyword recursively without hiding constraints in raw JSON. */
function SchemaValue({ value }: { value: unknown }): React.ReactElement {
  if (Array.isArray(value)) return <ul className="studio-schema-list">{value.map((entry, index) => <li key={index}><SchemaValue value={entry} /></li>)}</ul>;
  if (value !== null && typeof value === 'object') return <dl className="studio-schema-fields">{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{key}</dt><dd>{key === 'properties' || key === 'items' || key === '$defs' ? <details><summary>{key}</summary><SchemaValue value={entry} /></details> : <SchemaValue value={entry} />}</dd></div>)}</dl>;
  return <span className="studio-tool-description">{String(value)}</span>;
}
