/** Public preset plugin entry declaration. */
import type { Context } from '@deepseek-ai/cordis';
import type { CompiledInstructions } from './apply-types.ts';
export declare const inject: string[];
export declare function apply(ctx: Context, config: { id: string; revision: number; instructions: CompiledInstructions[] }): void;
