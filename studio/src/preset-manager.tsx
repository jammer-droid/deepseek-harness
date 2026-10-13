import React from 'react';
import { Button, Note, Notice, PageHead } from './ui.tsx';
import type { PreviewRequest } from './prompt-composition.ts';

export type SavedPreset = { readOnly?: boolean; nonDeletable?: boolean; template?: boolean; id: string; name: string; description: string; request: PreviewRequest; agents: import('./role-settings.ts').StudioRole[]; conveniences?: { spill?: string }; status: 'draft' | 'applied' | 'modified'; applyWarning?: string };
export type PresetActions = {
  list(): Promise<SavedPreset[]>;
  save(payload: string): Promise<SavedPreset>;
  apply(id: string): Promise<SavedPreset>;
  models?(): Promise<import('./role-editor.tsx').RoleModelCatalog>;
  unapply?(id: string): Promise<unknown>;
  delete(id: string): Promise<unknown>;
};
type ListLoad = { phase: 'loading' | 'ready' | 'failed'; items?: SavedPreset[]; error?: string };
type ActionKind = 'apply' | 'unapply' | 'delete';
type ActionState = { id: string; kind: ActionKind; error?: string };
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export function PresetList({ locale, api, revision, onEdit, onCopy }: { locale: string; api?: PresetActions | undefined; revision: number; onEdit?: ((preset: SavedPreset) => void) | undefined; onCopy?: ((preset: SavedPreset) => void) | undefined }) {
  const t = (ko: string, en: string, zh: string) => locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  // `items` survives a failed reload so a transient error never looks like data loss.
  const [load, setLoad] = React.useState<ListLoad>({ phase: 'loading' });
  const [action, setAction] = React.useState<ActionState>();
  const [deleting, setDeleting] = React.useState<SavedPreset>();
  const dialog = React.useRef<HTMLDialogElement>(null);
  const request = React.useRef(0);
  const refresh = React.useCallback(async () => {
    if (!api) return;
    const ticket = ++request.current;
    setLoad(old => ({ phase: 'loading', ...(old.items ? { items: old.items } : {}) }));
    try {
      const items = await api.list();
      if (ticket === request.current) setLoad({ phase: 'ready', items });
    } catch (error) {
      if (ticket === request.current) setLoad(old => ({ phase: 'failed', error: message(error), ...(old.items ? { items: old.items } : {}) }));
    }
  }, [api]);
  React.useEffect(() => { void refresh(); return () => { request.current++; }; }, [refresh, revision]);
  const busy = action !== undefined && action.error === undefined;
  const run = async (id: string, kind: ActionKind, perform: () => Promise<unknown>) => {
    if (busy) return;
    setAction({ id, kind });
    try { await perform(); } catch (error) { setAction({ id, kind, error: message(error) }); return; }
    setAction(undefined);
    await refresh();
  };
  const items = load.items ?? [];
  const failedName = action?.error !== undefined ? items.find(item => item.id === action.id)?.name ?? deleting?.name ?? action.id : '';
  const failure = action?.error === undefined ? '' : action.kind === 'apply'
    ? t(`${failedName} 반영에 실패했습니다. 이전에 반영한 구성이 있으면 그대로 유지됩니다.`, `Could not apply ${failedName}. A previously applied configuration stays in effect.`, `无法应用 ${failedName}。之前已应用的配置保持不变`)
    : action.kind === 'unapply'
      ? t(`${failedName} 반영 해제에 실패했습니다. 반영 상태는 바뀌지 않았습니다.`, `Could not unapply ${failedName}. Its applied state did not change.`, `无法取消应用 ${failedName}。应用状态未改变`)
      : t(`${failedName} 삭제에 실패했습니다. 프리셋은 삭제되지 않았습니다.`, `Could not delete ${failedName}. The preset was not deleted.`, `无法删除 ${failedName}。预设未被删除`);
  const pending = (item: SavedPreset, kind: ActionKind) => busy && action?.id === item.id && action.kind === kind;
  const status = (item: SavedPreset) => item.status === 'applied' ? t('반영됨', 'Applied', '已应用') : item.status === 'modified' ? t('재반영 필요', 'Needs reapply', '需要重新应用') : t('미반영', 'Not applied', '未应用');
  const retry = <Button small disabled={load.phase === 'loading'} onClick={() => void refresh()}>{t('다시 시도', 'Retry', '重试')}</Button>;
  return <><PageHead title={t('프리셋 목록', 'Preset list', '预设列表')} description={t('저장한 구성을 DSH 에이전트 프리셋에 반영하거나 삭제합니다.', 'Apply saved configurations to DSH agent presets or delete them.', '将已保存的配置应用到 DSH 代理预设或删除。')} actions={<Button disabled={busy || !api || load.phase === 'loading'} onClick={() => void refresh()}>{load.phase === 'loading' && load.items ? t('새로고침 중…', 'Refreshing…', '刷新中…') : t('새로고침', 'Refresh', '刷新')}</Button>} />
    {!api && <Notice>{t('Studio Host API에 연결되지 않아 프리셋을 불러올 수 없습니다.', 'Presets are unavailable because the Studio Host API is not connected.', 'Studio Host API 未连接，无法加载预设')}</Notice>}
    {api && load.phase === 'loading' && !load.items && <p role="status" className="studio-muted">{t('프리셋을 불러오는 중…', 'Loading presets…', '正在加载预设…')}</p>}
    {load.phase === 'failed' && <Notice action={retry}>{load.items
      ? t(`목록을 새로 불러오지 못했습니다. 마지막으로 불러온 목록을 표시합니다. (${load.error})`, `Could not reload the list. Showing the last loaded list. (${load.error})`, `无法重新加载列表，正在显示上次加载的列表（${load.error}）`)
      : t(`프리셋 목록을 불러오지 못했습니다. 저장된 프리셋은 변경되지 않았습니다. (${load.error})`, `Could not load presets. Saved presets were not changed. (${load.error})`, `无法加载预设，已保存的预设未被更改（${load.error}）`)}</Notice>}
    {failure && <Notice action={<Button small onClick={() => setAction(undefined)}>{t('닫기', 'Dismiss', '关闭')}</Button>}>{failure} ({action!.error})</Notice>}
    {load.phase === 'ready' && !items.length && <p role="status" className="studio-muted">{t('저장된 프리셋이 없습니다. 프리셋 생성 메뉴에서 새로 만들어 주세요.', 'No saved presets. Create one from Create preset.', '没有已保存的预设。请从创建预设菜单开始。')}</p>}
    <div className="studio-tool-cards" aria-busy={load.phase === 'loading' || busy}>{items.map(item => <article className="studio-component" key={item.id}><div className="studio-component-body"><h3>{item.name}</h3><p>{item.description}</p><p className="studio-muted">{status(item)} · {t('도구', 'Tools', '工具')} {item.request.tools.length} · {t('서브에이전트 역할', 'Subagent roles', '子代理角色')} {Array.isArray(item.agents) ? item.agents.length : 0}</p>
    {item.applyWarning && <Note>{item.applyWarning}</Note>}
    <div className="studio-inline-actions"><Button disabled={busy || item.readOnly || !onEdit} onClick={() => onEdit?.(item)}>{t('편집', 'Edit', '编辑')}</Button>{item.template && <Button disabled={busy || !onCopy} onClick={() => onCopy?.(item)}>{t('사본 만들기', 'Create copy', '创建副本')}</Button>}<Button disabled={busy || item.readOnly || item.status === 'draft' || !api?.unapply} onClick={() => void run(item.id, 'unapply', () => api!.unapply!(item.id))}>{pending(item, 'unapply') ? t('해제 중…', 'Unapplying…', '取消中…') : t('DSH 반영 해제', 'Unapply from DSH', '取消应用到 DSH')}</Button><Button disabled={busy || !api || item.readOnly} onClick={() => void run(item.id, 'apply', () => api!.apply(item.id))}>{pending(item, 'apply') ? t('반영 중…', 'Applying…', '应用中…') : item.status === 'draft' ? t('DSH에 반영', 'Apply to DSH', '应用到 DSH') : t('DSH에 다시 반영', 'Reapply to DSH', '重新应用到 DSH')}</Button><Button disabled={busy || !api || item.readOnly || item.nonDeletable} onClick={() => { setDeleting(item); dialog.current?.showModal(); }}>{t('삭제', 'Delete', '删除')}</Button></div></div></article>)}</div>
    <dialog ref={dialog} className="studio-detail-dialog" aria-label={t('프리셋 삭제', 'Delete preset', '删除预设')}><div className="studio-selection-detail"><h3>{deleting?.name}</h3><Note>{t('저장된 프리셋과 Studio가 등록한 DSH 프리셋을 삭제합니다. 기존 대화는 삭제하지 않습니다.', 'Delete the saved preset and its Studio-owned DSH registration. Existing conversations are not deleted.', '删除已保存预设及 Studio 注册的 DSH 预设，不删除现有对话。')}</Note><Button disabled={busy} onClick={() => dialog.current?.close()}>{t('취소', 'Cancel', '取消')}</Button><Button disabled={busy || !deleting} onClick={() => { const target = deleting!; dialog.current?.close(); void run(target.id, 'delete', () => api!.delete(target.id)).then(() => setDeleting(undefined)); }}>{t('삭제 확인', 'Confirm delete', '确认删除')}</Button></div></dialog>
  </>;
}
