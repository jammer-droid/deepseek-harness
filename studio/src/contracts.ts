import type { Context } from '@deepseek-ai/cordis';
import type { ReactNode } from 'react';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type { PluginInfo, ChangeResult, PluginEntryId } from '@deepseek-ai/dsh-plugin-manager/types';
export type { RemoteResult } from '@deepseek-ai/dsh-api-remotes/client';
export type { ChangeResult };
export type Dispose = () => void;
export type PluginRow = PluginInfo;
export type StudioContext = Context;
export type FeatureContext = Context;
export type RemotePluginManager = Pick<Context['remote']['pluginManager'], 'listPlugins' | 'setPluginEnabled'>;
export interface PluginManager {
  listPlugins(): Promise<PluginInfo[]>;
  setPluginEnabled(id: PluginEntryId, enabled: boolean): Promise<ChangeResult>;
}
export interface StudioProps {
  renderSlot(name: 'local.dsh-studio.features', props: Record<string, never>): ReactNode;
}
export interface IconProps { size?: number; active?: boolean }
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'local.dsh-studio.features': { kind: 'list'; props: Record<string, never> };
  }
}
