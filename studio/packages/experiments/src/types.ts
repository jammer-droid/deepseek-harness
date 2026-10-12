/** User-only experiment settings wire types. */
import type { Branded } from '@deepseek-ai/dsh-brand';
/** Durable optimistic-write token for one confirmed experiment configuration. */
export type ExperimentRevision = Branded<'StudioExperimentRevision'>;
import type { ExperimentSettings } from './settings.ts';
export type { ExperimentSettings, ExperimentTarget } from './settings.ts';
/** Detached settings and durable compare-and-swap token. */
export interface ExperimentState { revision: ExperimentRevision; settings: ExperimentSettings }
/** Entire draft and revision the editor loaded. */
export interface ExperimentChange { expectedRevision: ExperimentRevision; settings: ExperimentSettings }
