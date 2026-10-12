/** Stable, wire-preserved refusal reasons for explicit recovery. */
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Unknown admissions carry the reserved child identity; never retry them automatically. */
export type CatalogFailure = 'revision-conflict' | 'task-required' | 'unsupported-component' | 'invalid-component' | 'admission-unavailable' | 'parent-not-live' | 'role-not-found' | 'admission-unknown';
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap { 'studio-catalog/rejected': { reason: CatalogFailure; childId?: SessionId } }
}
/** @param reason Stable refusal. @param childId Reserved child when acceptance is uncertain. @param cause Original diagnostic. @returns Wire-preserved failure. */
export function catalogFailure(reason: CatalogFailure, childId?: SessionId, cause?: unknown): RemoteError<'studio-catalog/rejected'> {
  return new RemoteError('studio-catalog/rejected', `studio-catalog/${reason}${childId ? `:${childId}` : ''}`, { reason, ...(childId ? { childId } : {}) }, { cause });
}
