import React from 'react';
import { Button, Note, PageHead } from './ui.tsx';
import type { PreviewRequest } from './prompt-composition.ts';

export type SavedPreset = { readOnly?: boolean; id: string; name: string; description: string; request: PreviewRequest; agents: unknown[]; status: 'draft' | 'applied' | 'modified'; applyWarning?: string };
export type PresetActions = {
  list(): Promise<SavedPreset[]>;
  save(payload: string): Promise<SavedPreset>;
  apply(id: string): Promise<SavedPreset>;
  delete(id: string): Promise<unknown>;
};
export function PresetList({ locale, api, revision }: { locale: string; api?: PresetActions | undefined; revision: number }) {
  const t = (ko: string, en: string, zh: string) => locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [items, setItems] = React.useState<SavedPreset[]>([]);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState<SavedPreset>();
  const dialog = React.useRef<HTMLDialogElement>(null);
  const refresh = React.useCallback(async () => { if (api) setItems(await api.list()); }, [api]);
  React.useEffect(() => { let active = true; if (!api) return; api.list().then(items => { if (active) setItems(items); }, e => { if (active) setError(String(e)); }); return () => { active = false; }; }, [api, revision]);
  const run = async (action: () => Promise<unknown>) => { setBusy(true); setError(''); try { await action(); await refresh(); } catch (e) { setError(String(e)); } finally { setBusy(false); } };
  return <><PageHead title={t('프리셋 목록', 'Preset list', '预设列表')} description={t('저장한 구성을 DSH 에이전트 프리셋에 반영하거나 삭제합니다.', 'Apply saved configurations to DSH agent presets or delete them.', '将已保存的配置应用到 DSH 代理预设或删除。')} actions={<Button disabled={busy || !api} onClick={() => void run(refresh)}>{t('새로고침', 'Refresh', '刷新')}</Button>} />
    {error && <Note>{error}</Note>}
    {!items.length && <Note>{t('저장된 프리셋이 없습니다. 프리셋 생성 메뉴에서 새로 만들어 주세요.', 'No saved presets. Create one from Create preset.', '没有已保存的预设。请从创建预设菜单开始。')}</Note>}
    <div className="studio-tool-cards">{items.map(item => <article className="studio-component" key={item.id}><div className="studio-component-body"><h3>{item.name}</h3><p>{item.description}</p><p className="studio-muted">{item.status === 'applied' ? t('반영됨', 'Applied', '已应用') : item.status === 'modified' ? t('재반영 필요', 'Needs reapply', '需要重新应用') : t('미반영', 'Not applied', '未应用')} · {t('도구', 'Tools', '工具')} {item.request.tools.length} · {t('서브에이전트 초안', 'Subagent drafts', '子代理草稿')} {Array.isArray(item.agents) ? item.agents.length : 0}</p>
    {item.applyWarning && <Note>{item.applyWarning}</Note>}
    <div className="studio-inline-actions"><Button disabled={busy || !api || item.readOnly} onClick={() => void run(() => api!.apply(item.id))}>{t('DSH에 반영', 'Apply to DSH', '应用到 DSH')}</Button><Button disabled={busy || !api || item.readOnly} onClick={() => { setDeleting(item); dialog.current?.showModal(); }}>{t('삭제', 'Delete', '删除')}</Button></div></div></article>)}</div>
    <dialog ref={dialog} className="studio-detail-dialog" aria-label={t('프리셋 삭제', 'Delete preset', '删除预设')}><div className="studio-selection-detail"><h3>{deleting?.name}</h3><Note>{t('저장된 프리셋과 Studio가 등록한 DSH 프리셋을 삭제합니다. 기존 대화는 삭제하지 않습니다.', 'Delete the saved preset and its Studio-owned DSH registration. Existing conversations are not deleted.', '删除已保存预设及 Studio 注册的 DSH 预设，不删除现有对话。')}</Note><Button onClick={() => dialog.current?.close()}>{t('취소', 'Cancel', '取消')}</Button><Button disabled={busy || !deleting} onClick={() => void run(async () => { await api!.delete(deleting!.id); dialog.current?.close(); setDeleting(undefined); })}>{t('삭제 확인', 'Confirm delete', '确认删除')}</Button></div></dialog>
  </>;
}
