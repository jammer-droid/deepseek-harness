/** Client half of Pixie: Remote descriptors, the Studio settings page, and the right-sidebar tab.
 * The tab registers only where the right sidebar exists, so Studio still loads without it.
 */
import React from 'react';
import type { StudioContext } from './contracts.js';
import { PACKAGE_NAME } from './package-name.ts';
import { StudioSurface } from './ui.tsx';
import { PixieCommandRow, PixieTab, type PixieTabActions } from './pixie-tab.tsx';
import { PixieSettingsPage, type PixieSettingsActions } from './pixie-settings.tsx';
import { pixieText } from './pixie-locale.ts';
import type { JudgeResult, PixieAskFrame, PixieSettings, PixieThread } from './pixie-contracts.ts';

const NAMESPACE = 'studioPixie';
const TAB_ID = `${PACKAGE_NAME}/pixie`;
const KIND = 'studio-pixie';

const stringCodec = { mode: 'strict', typeSymbol: 'string', create: () => ({ parse: (value: unknown) => { if (typeof value !== 'string') throw new TypeError('Expected a string'); return value; } }) } as const;
const parameter = (name: string) => ({ name, wire: name, source: 'json', codec: stringCodec });
const descriptor = (method: string, parameters: string[], extra: Record<string, unknown> = {}) => ({
  id: `${PACKAGE_NAME}#${NAMESPACE}/${method}`, service: NAMESPACE, namespace: NAMESPACE, method,
  invocation: { kind: 'direct' }, parameters: parameters.map(parameter), result: { mode: 'src-json' }, ...extra,
});

type RemoteValue<T> = Promise<{ ok: true; value: T } | { ok: false; error: { message: string } }>;
interface PixieRemote {
  view(sessionId: string): RemoteValue<import('./pixie-tab.tsx').PixieViewValue>;
  createThread(sessionId: string, payload: string): RemoteValue<PixieThread>;
  activate(sessionId: string, threadId: string): RemoteValue<boolean>;
  ask(sessionId: string, payload: string): RemoteValue<{ threadId: string; turnId: string }>;
  cancel(sessionId: string): RemoteValue<boolean>;
  follow(sessionId: string): AsyncIterable<PixieAskFrame> & { dispose(): void };
  readSettings(): RemoteValue<PixieSettings>;
  saveSettings(payload: string): RemoteValue<PixieSettings>;
  models(): RemoteValue<unknown>;
  judge(payload: string): RemoteValue<JudgeResult>;
}

async function unwrap<T>(call: RemoteValue<T>): Promise<T> {
  const result = await call;
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

interface SidebarServices {
  sidebarRightTabs: { register(definition: { id: string; kind: string; priority?: string; title: () => string; guide?: readonly { id: string; order: number; title: () => string; description?: () => string }[] }): () => void };
  sidebarRight: { openTab(kind: string, options?: Record<string, unknown>): void };
}

/** Pixie Remote descriptors. The runtime accepts one contribution per package, so the shell mounts these with its own. */
export function pixieDescriptors() {
  return [
    descriptor('view', ['sessionId']),
    descriptor('createThread', ['sessionId', 'payload']),
    descriptor('activate', ['sessionId', 'threadId']),
    descriptor('ask', ['sessionId', 'payload']),
    descriptor('cancel', ['sessionId']),
    descriptor('follow', ['sessionId'], { mode: 'stream', cancellation: { parameter: 'signal' } }),
    descriptor('readSettings', []),
    descriptor('saveSettings', ['payload']),
    descriptor('models', []),
    descriptor('judge', ['payload'], { cancellation: { parameter: 'signal' } }),
  ];
}

/** Register Pixie's settings page, right-sidebar tab, and /pixie row. Call after the shell mounted {@link pixieDescriptors}. */
export function mountPixie(ctx: StudioContext): void {
  const remote = () => {
    const service = ctx.get(`remote.${NAMESPACE}` as never) as unknown as PixieRemote | undefined;
    if (!service) throw new Error('Pixie API unavailable');
    return service;
  };
  const locale = () => ctx.locale.getLocale().active;
  const useLocale = () => React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), locale);

  const settingsActions: PixieSettingsActions = {
    read: () => unwrap(remote().readSettings()),
    save: settings => unwrap(remote().saveSettings(JSON.stringify(settings))),
    models: () => unwrap(remote().models()) as ReturnType<PixieSettingsActions['models']>,
  };
  function SettingsPage() {
    const active = useLocale();
    return <StudioSurface className="studio-pixie-settings"><PixieSettingsPage actions={settingsActions} locale={active} /></StudioSurface>;
  }
  ctx.slots.inject('local.dsh-studio.services', () => ctx.slots.register({
    name: 'local.dsh-studio.services', id: 'pixie', order: 10, label: () => pixieText(locale(), 'settingsTitle'),
  }, SettingsPage));

  const tabActions = (sessionId: string): PixieTabActions => ({
    view: () => unwrap(remote().view(sessionId)),
    follow: listener => {
      let stopped = false;
      let handle: (AsyncIterable<PixieAskFrame> & { dispose(): void }) | undefined;
      const run = async () => {
        // Reconnect after a carrier loss while the tab stays open.
        while (!stopped) {
          try {
            handle = remote().follow(sessionId);
            for await (const frame of handle) { if (stopped) break; listener(frame); }
          } catch { /* fall through to retry */ }
          if (!stopped) await new Promise(resolve => setTimeout(resolve, 1000));
        }
      };
      void run();
      return () => { stopped = true; handle?.dispose(); };
    },
    ask: (question, threadId) => unwrap(remote().ask(sessionId, JSON.stringify({ question, ...(threadId ? { threadId } : {}) }))),
    cancel: () => unwrap(remote().cancel(sessionId)),
    createThread: options => unwrap(remote().createThread(sessionId, JSON.stringify(options))),
    activate: threadId => unwrap(remote().activate(sessionId, threadId)),
    models: () => unwrap(remote().models()) as ReturnType<PixieTabActions['models']>,
    judge: request => unwrap(remote().judge(JSON.stringify(request))),
  });

  // The right sidebar may load after Studio; register the tab and the /pixie row once its services exist.
  ctx.inject(['sidebarRightTabs', 'sidebarRight'] as never, scope => {
    const tabs = (scope as unknown as SidebarServices).sidebarRightTabs;
    const right = (scope as unknown as SidebarServices).sidebarRight;
    scope.effect(() => tabs.register({
      id: TAB_ID, kind: KIND, priority: 'extension', title: () => pixieText(locale(), 'title'),
      guide: [{ id: 'open', order: 60, title: () => pixieText(locale(), 'title'), description: () => pixieText(locale(), 'isolation') }],
    }));
    function Body({ sessionId }: { sessionId: string }) {
      const active = useLocale();
      const actions = React.useMemo(() => tabActions(sessionId), [sessionId]);
      return <PixieTab actions={actions} locale={active} />;
    }
    scope.slots.inject('sidebar.right.pane.tab' as never, () => scope.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID } as never, Body as never));
    // The /pixie row shows the question, the status line, and a button that opens this tab.
    const openTab = () => { right.openTab(KIND, { revealIfOpened: true }); };
    function CommandRow({ node }: { node: { args: string | null; outcome: { kind: 'success' | 'error'; text?: string } | null } }) {
      const active = useLocale();
      return <StudioSurface className="studio-pixie-command">
        <PixieCommandRow question={node.args?.trim() ?? ''} outcome={node.outcome} locale={active} onOpen={openTab} />
      </StudioSurface>;
    }
    scope.slots.inject('conversation.chat.commandview' as never, () => scope.slots.register({ name: 'conversation.chat.commandview', key: 'pixie' } as never, CommandRow as never));
  });
}
