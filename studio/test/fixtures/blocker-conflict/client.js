/** Independent writer intentions observed through the public composer-block API. */
window.__ModuleLoader__.load({
  id: '@fixture/studio-blocker-conflict',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const labels = {
      title: 'Block ownership fixture', a: 'A blocks input', same: 'B writes same reason', other: 'B writes different reason',
      clear: 'A clears by identity', original: 'Seed original block', restore: 'A restores previous block',
      ordinary: 'Open ordinary session', reasonA: 'Producer A blocks input',
      reasonB: 'Producer B blocks input', reasonOriginal: 'Original producer blocks input',
    }
    return {
      inject: ['conversation', 'slots', 'locale', 'sessions', 'uiWorkspace', 'workspaces'],
      apply(ctx) {
        const states = new Map()
        const stateFor = sessionId => {
          let state = states.get(sessionId)
          if (state) return state
          const store = ctx.conversation.blocks.storeFor(sessionId)
          state = { store, previous: undefined, a: undefined, b: undefined, notifications: 0 }
          const stop = store.subscribe(() => { state.notifications++ })
          states.set(sessionId, state)
          ctx.effect(() => () => {
            stop()
            if (store.getSnapshot() === state.a) ctx.conversation.blocks.set(sessionId, state.previous)
          })
          return state
        }
        function View({ sessionId, state, t }) {
          const [, refresh] = React.useReducer(n => n + 1, 0)
          React.useSyncExternalStore(state.store.subscribe, state.store.getSnapshot)
          const action = operation => () => { operation(); refresh() }
          const write = value => ctx.conversation.blocks.set(sessionId, value)
          const current = state.store.getSnapshot()
          return h('section', { 'aria-label': t('title'), style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: 16 } },
            h('output', { 'data-block-observation': '', style: { maxWidth: '100%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, JSON.stringify({
              sessionId, notifications: state.notifications, reason: current?.reason ?? null,
              identity: current === undefined ? 'none' : current === state.a ? 'A' : current === state.b ? 'B' : 'original',
              bIntent: state.b?.reason ?? null,
            })),
            h('button', { onClick: action(() => { state.previous = current; state.a = { reason: t('reasonA') }; write(state.a) }) }, t('a')),
            h('button', { onClick: action(() => { state.b = { reason: t('reasonA') }; write(state.b) }) }, t('same')),
            h('button', { onClick: action(() => { state.b = { reason: t('reasonB') }; write(state.b) }) }, t('other')),
            h('button', { onClick: action(() => { if (state.store.getSnapshot() === state.a) write(undefined) }) }, t('clear')),
            h('button', { onClick: action(() => write({ reason: t('reasonOriginal') })) }, t('original')),
            h('button', { onClick: action(() => write(state.previous)) }, t('restore')),
            h('button', { onClick: async () => {
              const workspace = ctx.workspaces.list.getSnapshot().items.find(item => item.sessionIds.includes(sessionId))
              if (!workspace) throw new Error('Fixture session has no workspace')
              const id = await ctx.sessions.create({ workspaceId: workspace.workspaceId })
              ctx.uiWorkspace.openSession(id)
            } }, t('ordinary')),
          )
        }
        ctx.effect(() => ctx.locale.register('fixtureBlockConflict', { en: labels, zh: labels }))
        ctx.slots.inject('conversation.view', () => ctx.slots.register({
          name: 'conversation.view', id: 'block-ownership-fixture', locale: 'fixtureBlockConflict',
          label: () => labels.title, inject: sessionId => ({ sessionId, state: stateFor(sessionId) }),
        }, View))
      },
    }
  },
})
