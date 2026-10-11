/** Disposable Client state owner; reconnect makes cached execution status untrusted. */
import type { RoleState, RoleApplyRequest } from '../packages/roles/src/roles-types.ts';
/** Confirmed view plus locally owned rendering revision. */
export interface RoleView { state: RoleState | null; unavailable: boolean; generation: number; locale: string }
/** Remote effects already unwrapped by the plugin owner. */
export interface RoleActions { describe(): Promise<RoleState>; apply(request: RoleApplyRequest): Promise<RoleState> }
/** Create the UI owner independently of mounting or navigating the page.
 * @param actions Public Remote calls.
 * @param locale Active locale id.
 * @returns Subscription and explicit request actions.
 */
export function createRoleStore(actions: RoleActions, locale: string) {
  let view: RoleView = { state: null, unavailable: false, generation: 0, locale };
  const listeners = new Set<() => void>();
  let disposed = false;
  let epoch = 0;
  const publish = (next: RoleView) => { if (disposed) return; view = next; listeners.forEach(listener => listener()); };
  async function reload(replaceDraft = true) {
    if (disposed) return;
    const request = ++epoch;
    try {
      const state = await actions.describe();
      if (request === epoch) publish({ ...view, state, unavailable: false, generation: view.generation + (replaceDraft ? 1 : 0) });
    } catch (_error) { if (request === epoch) publish({ ...view, unavailable: true }); } // Unknown state remains visibly blocked until confirmed.
  }
  return {
    getSnapshot: () => view,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reload,
    async apply(request: RoleApplyRequest) {
      if (disposed) throw new Error('roles-closed');
      const current = ++epoch;
      const state = await actions.apply(request);
      if (current === epoch) publish({ ...view, state, unavailable: false, generation: view.generation + 1 });
    },
    reset() { epoch++; publish({ ...view, unavailable: true }); void reload(false); },
    setLocale(next: string) { publish({ ...view, locale: next }); },
    dispose() { disposed = true; epoch++; listeners.clear(); },
  };
}
/** Store consumed by pure React rendering. */
export type RoleStore = ReturnType<typeof createRoleStore>;
