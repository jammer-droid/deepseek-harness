import type { RemoteResult, RemotePluginManager, PluginManager, PluginRow } from './contracts.js';
interface Snapshot { row: PluginRow | null; loading: boolean; busy: boolean; error: string; notice: string }

export const DEMO_PACKAGE = '@local/dsh-studio-demo';
export const DEMO_PATCH = 'local-dsh-studio-demo';

export function unwrapRemote<T>(result: RemoteResult<T>): T {
  if (!result || typeof result.ok !== 'boolean') throw new Error('잘못된 Remote 응답입니다.');
  if (!result.ok) throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error ?? 'Remote 요청 실패'));
  return result.value;
}

export function remoteManager(remote: RemotePluginManager): PluginManager {
  return {
    async listPlugins() { return unwrapRemote(await remote.listPlugins()); },
    async setPluginEnabled(id, enabled) { return unwrapRemote(await remote.setPluginEnabled(id, enabled)); },
  };
}

export function createController(manager: PluginManager) {
  let disposed = false, generation = 0;
  let snapshot: Snapshot = { row: null, loading: true, busy: false, error: '', notice: '' };
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<Snapshot>) => {
    if (disposed) return;
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  async function refresh() {
    const request = ++generation;
    try {
      const rows = await manager.listPlugins();
      if (disposed || request !== generation) return;
      const matches = rows.filter(row => row.moduleName === DEMO_PACKAGE && row.patchId === DEMO_PATCH);
      publish({ row: matches.length === 1 ? matches[0]! : null, loading: false,
        error: matches.length === 1 ? '' : '데모 플러그인 행을 고유하게 찾을 수 없습니다.' });
    } catch (error) {
      if (request === generation) publish({ row: null, loading: false, error: String(error) });
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    refresh,
    async toggle() {
      const row = snapshot.row;
      if (disposed || snapshot.busy || !row || row.readOnlyReason) return;
      publish({ busy: true, error: '', notice: '' });
      try {
        const result = await manager.setPluginEnabled(row.entryId, !row.enabled);
        await refresh();
        const messages = { applied: '프로필에 저장하고 적용했습니다.', 'restart-required': '저장했습니다. DSH 재시작이 필요합니다.', overridden: '상위 설정이 변경을 덮어썼습니다.', failed: '변경 적용에 실패했습니다.', cancelled: '변경이 취소되었습니다.' };
        publish({ notice: [messages[result.application] ?? result.application, ...(result.warnings ?? [])].filter(Boolean).join(' '), error: result.error ? JSON.stringify(result.error) : '' });
      } catch (error) { publish({ error: String(error) }); }
      finally { publish({ busy: false }); }
    },
    dispose() { disposed = true; generation++; listeners.clear(); },
  };
}
