import React from 'react';
import { Badge, Button, DetailDialog, Note, SectionHead } from './ui.tsx';
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
  const close = () => setSelected(undefined);
  return <>
    <SectionHead title={<h3 className="studio-panel-title">{t('서브에이전트 역할', 'Subagent roles', '子代理角色')}<span className="studio-count">{roles.length}</span></h3>} description={t('바꾼 내용은 프리셋을 저장하고 DSH에 다시 반영해야 적용됩니다.', 'Save the preset and reapply it to DSH after changes.', '修改后需保存预设并重新应用到 DSH。')} actions={<><Button small disabled={loading || !loadModels} onClick={() => void refresh()}>{loading ? t('모델 불러오는 중…', 'Loading models…', '正在加载模型…') : t('모델 목록 새로고침', 'Refresh models', '刷新模型列表')}</Button><Button small onClick={() => { setSelected(roles.length); onChange([...roles, { name: '', role: '', model: 'inherit', reasoning: 'inherit', spawn: 'fresh', persona: '' }]); }}>{t('역할 추가', 'Add role', '添加角色')}</Button></>} />
    {error && <Note>{error}</Note>}{catalog?.failures.map(failure => <Note key={failure.name}>{failure.name}: {failure.message}</Note>)}
    {!roles.length && <p className="studio-muted" role="status">{t('역할이 없습니다. 역할을 추가해 보세요.', 'No roles yet.', '还没有角色。')}</p>}
    <div className="studio-tool-cards studio-card-pair">{roles.map((item, index) => <article className="studio-role-card" key={index}>
      <div className="studio-card-head"><h3>{item.name || t('이름 없음', 'Untitled', '未命名')}</h3><Badge tone="outline">{item.spawn === 'fork' ? t('부모 대화 이어받기', 'Continue parent', '继承父对话') : t('새 대화', 'New conversation', '新对话')}</Badge></div>
      {item.role && <p className="studio-card-text studio-mono">{item.role}</p>}
      <p className="studio-card-meta">{item.model === 'inherit' ? t('부모 모델 사용', 'Inherit parent model', '继承父级模型') : models.find(model => model.value === item.model)?.label ?? item.model} · {t('추론', 'Reasoning', '推理')} {item.reasoning === 'inherit' ? t('기본', 'inherit', '默认') : item.reasoning}</p>
      <div className="studio-card-footer"><Button small aria-haspopup="dialog" onClick={() => setSelected(index)}>{t('편집', 'Edit', '编辑')}</Button></div>
    </article>)}</div>
    <DetailDialog open={role !== undefined} title={role?.name || t('새 역할', 'New role', '新角色')} subtitle={t('역할 편집', 'Edit role', '编辑角色')} onClose={close}
      footer={<><Button small onClick={() => { onChange(roles.filter((_, index) => index !== selected)); close(); }}>{t('역할 삭제', 'Remove role', '移除角色')}</Button><Button small primary onClick={close}>{t('완료', 'Done', '完成')}</Button></>}>
      {role && <><div className="studio-field-grid">
        {field(t('이름', 'Name', '名称'), <input value={role.name} onChange={e => update({ name: e.target.value })} />)}
        {field(t('역할 ID', 'Role', '角色'), <input className="studio-mono" value={role.role} onChange={e => update({ role: e.target.value })} />)}
      </div>
      <div className="studio-field-grid">
        {field(t('모델', 'Model', '模型'), <select value={role.model} onChange={e => update({ model: e.target.value, reasoning: 'inherit' })}><option value="inherit">{t('부모 모델 사용', 'Inherit parent model', '继承父级模型')}</option>{role.model !== 'inherit' && !model && <option value={role.model} disabled>{role.model} · {t('목록에 없음 · 반영할 때 확인', 'Not confirmed in catalog · checked on apply', '目录中未确认 · 应用时验证')}</option>}{models.map(model => <option key={model.value} value={model.value}>{model.label}</option>)}</select>)}
        {field(t('추론 수준', 'Reasoning', '推理级别'), <select value={role.reasoning} disabled={!model} onChange={e => update({ reasoning: e.target.value })}><option value="inherit">{role.model === 'inherit' ? t('부모 설정 사용', 'Inherit parent setting', '继承父级设置') : t('모델 기본값', 'Model default', '模型默认值')}</option>{role.reasoning !== 'inherit' && !model?.reasoning?.efforts.some(e => e.id === role.reasoning) && <option value={role.reasoning} disabled>{role.reasoning} · {t('지원 여부 확인 필요', 'Check support', '需确认支持')}</option>}{model?.reasoning?.efforts.map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select>)}
        {field(t('시작 방식', 'Spawn mode', '生成方式'), <select value={role.spawn} onChange={e => update({ spawn: e.target.value as StudioRole['spawn'] })}><option value="fresh">{t('새 대화 (Fresh)', 'New conversation (Fresh)', '新对话（Fresh）')}</option><option value="fork">{t('부모 대화 이어받기 (Fork)', 'Continue parent (Fork)', '继承父对话（Fork）')}</option></select>)}
      </div>
      {field(t('역할 지침 (persona)', 'User instructions (persona)', '用户指令（persona）'), <textarea rows={6} value={role.persona} onChange={e => update({ persona: e.target.value })} />)}
      <p className="studio-muted studio-hint">{t('비워 두면 기본 persona를 사용합니다. 새 대화는 지시만 받고 시작하고, 부모 대화 이어받기는 지금까지의 대화를 함께 넘겨받습니다.', 'Passed to native subagent persona. Empty preserves the deployment persona. Fresh starts a standalone task; Fork inherits completed parent turns.', '传给原生子代理的 persona。留空保留部署默认值。Fresh 为独立任务，Fork 继承父级已完成对话。')}</p></>}
    </DetailDialog>
  </>;
}
