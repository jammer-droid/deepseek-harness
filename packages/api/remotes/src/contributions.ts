/** Effect-owned ordinary-event contributions to the application's sole Remote source. */
import { Service, type Context } from '@deepseek-ai/cordis'
import type { TypertForwardableEventEntry } from '@deepseek-ai/dsh-typert-protocol'
import type { TypertRemoteEventDispatch } from '@deepseek-ai/dsh-api-gateway'
import { isJsonValue } from '@deepseek-ai/dsh-util-values'
import { API_REMOTE_FORWARDED_EVENTS } from './remote-events.ts'

/** Unscoped void notification names accepted by the Remote carrier. */
export type RemoteNotificationEvent = Extract<TypertForwardableEventEntry, { mode: 'emit' }>['event']

declare module '@deepseek-ai/cordis' {
  interface Context { remoteEventContributions: RemoteEventContributions }
}

/** Adds notifications without replacing Gateway's application source or built-in events. */
export class RemoteEventContributions extends Service {
  private readonly registrations = new Map<string, () => void>()
  private readonly consumers = new Set<(dispatch: TypertRemoteEventDispatch) => void>()
  constructor(ctx: Context) {
    super(ctx, 'remoteEventContributions')
    ctx.effect(() => () => {
      for (const dispose of this.registrations.values()) dispose()
      this.registrations.clear()
      this.consumers.clear()
    })
  }

  /**
   * Forward one ordinary notification to connected Clients.
   * @param event Ordinary Cordis event selected by its owner.
   * @returns Idempotent disposer for use with the owner's ctx.effect().
   */
  register(event: RemoteNotificationEvent): () => void {
    if (this.registrations.has(event) || API_REMOTE_FORWARDED_EVENTS.some(entry => entry.event === event)) throw new Error(`Remote event already registered: ${event}`)
    const dispose = this.ctx.on(event as never, ((...args: unknown[]) => {
      if (!args.every(isJsonValue)) throw new TypeError(`Remote event ${event} requires JSON arguments`)
      for (const consumer of this.consumers) consumer({ event, args })
    }) as never)
    this.registrations.set(event, dispose)
    return () => {
      if (this.registrations.get(event) !== dispose) return
      this.registrations.delete(event)
      dispose()
    }
  }

  /**
   * Subscribe an application-source Client stream to contributed notifications.
   * @param consume One Client stream queue.
   * @returns Disposer detaching that stream from future notifications.
   */
  attach(consume: (dispatch: TypertRemoteEventDispatch) => void): () => void {
    this.consumers.add(consume)
    return () => { this.consumers.delete(consume) }
  }
}
