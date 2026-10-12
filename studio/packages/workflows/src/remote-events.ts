/** Client-safe event typing; transport forwarding requires an application event-source contribution. */
import type {} from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-typert-protocol';
declare module '@deepseek-ai/cordis' {
  interface Events {
    /** Registration availability changed; consumers must re-read the catalog.
     * @param revision Current catalog revision.
     * @mode emit
     */
    'studio-workflows/catalog-changed'(revision: number): void;
  }
}
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteEventSelection { 'studio-workflows/catalog-changed': true }
}
