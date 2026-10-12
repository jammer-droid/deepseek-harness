/** Studio-only navigation; hidden sections stay mounted to retain drafts. */
import React from 'react';
import { DetailLayout } from './detail-layout.tsx';

/** Addressable Studio page sections. */
export type StudioSection = 'workflows' | 'agents' | 'components' | 'systems';
/** Mock design pages supplied by the shell; this module stays free of host primitives. */
export type DesignPages = Partial<Record<'workflows' | 'agents' | 'components' | 'systems', React.ReactNode>>;

const ko = {
  navigation: 'Studio 영역', design: '설계', mock: '목업',
  workflows: '워크플로우', agents: '에이전트', components: '컴포넌트', systems: '시스템',
};
const en: typeof ko = {
  navigation: 'Studio sections', design: 'Design', mock: 'Mock',
  workflows: 'Workflows', agents: 'Agents', components: 'Components', systems: 'Systems',
};
const zh: typeof ko = {
  navigation: 'Studio 区域', design: '设计', mock: '模拟',
  workflows: '工作流', agents: '智能体', components: '组件', systems: '系统',
};

const DESIGN = ['workflows', 'agents', 'components', 'systems'] as const;

/** Left navigation over Studio sections with a separate content scroller.
 * @param props Active locale, optional controlled section, and mock design pages.
 * @returns Navigation and one visible section; every section stays mounted.
 */
export function SettingsLayout({ locale, pages = {}, section: controlled, onSectionChange }: {
  locale: string; pages?: DesignPages; section?: StudioSection; onSectionChange?: (section: StudioSection) => void;
}) {
  const t = locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [local, setLocal] = React.useState<StudioSection>('workflows');
  const section = controlled ?? local;
  const select = (next: StudioSection) => { setLocal(next); onSectionChange?.(next); };
  return <DetailLayout title="DSH Studio" navigation={t.navigation}
    group={<>{t.design}<span className="studio-nav-badge">{t.mock}</span></>}
    pages={DESIGN.map(value => ({ id: value, label: t[value], content: pages[value] }))}
    selected={section} onSelect={id => { const value = DESIGN.find(value => value === id); if (value) select(value); }} />;
}
