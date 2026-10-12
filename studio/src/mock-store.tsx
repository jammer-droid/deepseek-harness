/** Page-local state shared by the Studio design mock pages; nothing is persisted or sent to the Host. */
import React from 'react';
import { Toast } from '@deepseek-ai/dsh-client-ui-primitives';
import type { StudioSection } from './settings-layout.tsx';
import { initialData, type MockData } from './mock-data.ts';
import { mockCopy, type MockCopy } from './mock-locales.ts';

/** Workflow view: the overview or one role, optionally opening a component card. */
export type WorkflowTab = { kind: 'overview' } | { kind: 'role'; id: string; open?: string };

interface MockContext {
  t: MockCopy;
  data: MockData;
  update(change: (draft: MockData) => void): void;
  toast(text: string): void;
  go(section: StudioSection): void;
  workflowTab: WorkflowTab;
  setWorkflowTab(tab: WorkflowTab): void;
}
// Created on first render so loading the Client bundle has no React side effects.
let context: React.Context<MockContext | null> | undefined;
const Context = () => context ??= React.createContext<MockContext | null>(null);

/** @returns The surrounding mock state; throws outside {@link MockStudioProvider}. */
export function useMock(): MockContext {
  const value = React.useContext(Context());
  if (!value) throw new Error('Studio mock pages require MockStudioProvider');
  return value;
}

let sequence = 0;
/** @param prefix Readable id prefix. @returns Page-unique id for mock-created entities. */
export function mockId(prefix: string): string { sequence += 1; return `${prefix}-${sequence}`; }

/** Holds sample data for the mock pages and renders their transient toasts.
 * @param props Active locale, section navigation, and the pages.
 * @returns Provider with one toast host.
 */
export function MockStudioProvider({ locale, go, children }: React.PropsWithChildren<{ locale: string; go: (section: StudioSection) => void }>) {
  const t = mockCopy(locale);
  const [data, setData] = React.useState(() => initialData(t));
  const [toast, setToast] = React.useState<{ key: number; text: string }>();
  const [workflowTab, setWorkflowTab] = React.useState<WorkflowTab>({ kind: 'overview' });
  const value = React.useMemo<MockContext>(() => ({
    t, data, go, workflowTab, setWorkflowTab,
    update: change => setData(previous => { const next = structuredClone(previous); change(next); return next; }),
    toast: text => setToast({ key: Date.now(), text }),
  }), [t, data, go, workflowTab]);
  const Provider = Context().Provider;
  return <Provider value={value}>
    {children}
    {toast && <Toast key={toast.key} tone="success" text={toast.text} onDone={() => setToast(undefined)} />}
  </Provider>;
}
