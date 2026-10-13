import React from 'react';
import { Button, Note, SectionHead } from './ui.tsx';
import type { StudioRole } from './role-settings.ts';
export interface RoleModelCatalog {
  groups: { id: string; name: string; models: { id: string; name: string; reasoning?: { efforts: { id: string; name: string }[] } }[] }[];
  failures: { name: string; message: string }[];
}
export function RoleEditor({ locale, roles, onChange, loadModels }: { locale: string; roles: StudioRole[]; onChange: (roles: StudioRole[]) => void; loadModels?: (() => Promise<RoleModelCatalog>) | undefined }) {
  const t = (ko: string, en: string, zh: string) => locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [selected, setSelected] = React.useState<number>();
  const [catalog, setCatalog] = React.useState<RoleModelCatalog>();
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const refresh = React.useCallback(async () => {
    if (!loadModels) return;
    setLoading(true); setError('');
    try { setCatalog(await loadModels()); } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }, [loadModels]);
  React.useEffect(() => { void refresh(); }, [refresh]);
  const models = (catalog?.groups ?? []).flatMap(group => group.models.map(model => ({ ...model, value: `${group.id}/${model.id}`, label: `${group.name} · ${model.name}` })));
  const role = selected === undefined ? undefined : roles[selected];
  const model = models.find(model => model.value === role?.model);
  const update = (patch: Partial<StudioRole>) => onChange(roles.map((role, index) => index === selected ? { ...role, ...patch } : role));
  const field = (label: string, content: React.ReactNode) => <label className="studio-field"><span>{label}</span>{content}</label>;
  return <>
    <SectionHead title={t('서브에이전트 역할', 'Subagent roles', '子代理角色')} />
    <Note>{t('카드에서 역할을 선택해 편집하세요. 변경 후 프리셋 저장과 DSH 재반영이 필요합니다.', 'Select a role card to edit. Save the preset and reapply it to DSH after changes.', '选择角色卡片编辑。修改后需保存预设并重新应用到 DSH。')}</Note>
    <div className="studio-tool-cards">{roles.map((item, index) => <article className="studio-component" key={index}><div className="studio-component-body">
      <h3>{item.name}</h3><p>{item.role}</p><p className="studio-muted">{item.model === 'inherit' ? t('부모 모델 상속', 'Inherit parent model', '继承父级模型') : models.find(model => model.value === item.model)?.label ?? item.model} · {item.reasoning} · {item.spawn}</p>
      <Button aria-pressed={selected === index} onClick={() => setSelected(index)}>{t('편집', 'Edit', '编辑')}</Button>
    </div></article>)}</div>
    <div className="studio-inline-actions"><Button onClick={() => { setSelected(roles.length); onChange([...roles, { name: '', role: '', model: 'inherit', reasoning: 'inherit', spawn: 'fresh', persona: '' }]); }}>{t('역할 추가', 'Add role', '添加角色')}</Button><Button disabled={loading || !loadModels} onClick={() => void refresh()}>{loading ? t('모델 조회 중…', 'Loading models…', '正在加载模型…') : t('모델 목록 새로고침', 'Refresh models', '刷新模型列表')}</Button></div>
    {error && <Note>{error}</Note>}{catalog?.failures.map(failure => <Note key={failure.name}>{failure.name}: {failure.message}</Note>)}
    {role && <section className="studio-component"><div className="studio-component-body"><SectionHead title={t('역할 편집', 'Edit role', '编辑角色')} /><div className="studio-field-grid">
      {field(t('이름', 'Name', '名称'), <input value={role.name} onChange={e => update({ name: e.target.value })} />)}
      {field(t('역할', 'Role', '角色'), <input value={role.role} onChange={e => update({ role: e.target.value })} />)}
      {field(t('모델', 'Model', '模型'), <select value={role.model} onChange={e => update({ model: e.target.value, reasoning: 'inherit' })}><option value="inherit">{t('부모 모델 상속', 'Inherit parent model', '继承父级模型')}</option>{role.model !== 'inherit' && !model && <option value={role.model} disabled>{role.model} · {t('목록에서 확인되지 않음 · 적용 시 검증', 'Not confirmed in catalog · checked on apply', '目录中未确认 · 应用时验证')}</option>}{models.map(model => <option key={model.value} value={model.value}>{model.label}</option>)}</select>)}
      {field(t('추론 수준', 'Reasoning', '推理级别'), <select value={role.reasoning} disabled={!model} onChange={e => update({ reasoning: e.target.value })}><option value="inherit">{role.model === 'inherit' ? t('부모 설정 상속', 'Inherit parent setting', '继承父级设置') : t('모델 기본값', 'Model default', '模型默认值')}</option>{role.reasoning !== 'inherit' && !model?.reasoning?.efforts.some(e => e.id === role.reasoning) && <option value={role.reasoning} disabled>{role.reasoning} · {t('지원 확인 필요', 'Check support', '需确认支持')}</option>}{model?.reasoning?.efforts.map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select>)}
      {field(t('스폰 방식', 'Spawn mode', '生成方式'), <select value={role.spawn} onChange={e => update({ spawn: e.target.value as StudioRole['spawn'] })}><option value="fresh">Fresh</option><option value="fork">Fork</option></select>)}
    </div>{field(t('사용자 지침 (persona)', 'User instructions (persona)', '用户指令（persona）'), <textarea rows={5} value={role.persona} onChange={e => update({ persona: e.target.value })} />)}
    <Note>{t('기존 subagent의 persona에 전달됩니다. 비워두면 배포 기본 persona를 유지합니다. Fresh는 독립 작업, Fork는 부모의 완료된 대화를 상속합니다.', 'Passed to native subagent persona. Empty preserves the deployment persona. Fresh starts a standalone task; Fork inherits completed parent turns.', '传给原生子代理的 persona。留空保留部署默认值。Fresh 为独立任务，Fork 继承父级已完成对话。')}</Note>
    <Button onClick={() => { onChange(roles.filter((_, index) => index !== selected)); setSelected(undefined); }}>{t('역할 제거', 'Remove role', '移除角色')}</Button>
    </div></section>}
  </>;
}
