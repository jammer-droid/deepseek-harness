/** Studio-only navigation; hidden sections stay mounted to retain drafts. */
import React from 'react';

/** Addressable Studio page sections. */
export type StudioSection = 'workflows' | 'agents' | 'components' | 'systems' | 'dsh' | 'studio';
/** Mock design pages supplied by the shell; this module stays free of host primitives. */
export type DesignPages = Partial<Record<'workflows' | 'agents' | 'components' | 'systems', React.ReactNode>>;

const ko = {
  navigation: 'Studio 영역', design: '설계', mock: '목업', legacy: '기존 기능',
  workflows: '워크플로우', agents: '에이전트', components: '컴포넌트', systems: '시스템',
  dsh: 'DSH 프리셋 편집', studio: '역할·실험 기능',
  title: 'DSH 프리셋 편집',
  description: '기본 설정 화면은 그대로 두고, 프로필의 에이전트 프리셋 선언을 직접 재정의합니다.',
  studioDescription: 'Studio에서 제공하는 기존 고정 역할 설정과 실험 기능을 관리합니다.',
};
const en: typeof ko = {
  navigation: 'Studio sections', design: 'Design', mock: 'Mock', legacy: 'Existing features',
  workflows: 'Workflows', agents: 'Agents', components: 'Components', systems: 'Systems',
  dsh: 'DSH preset editing', studio: 'Roles and experiments',
  title: 'DSH preset editing',
  description: 'Override the profile’s agent preset declarations while keeping the built-in settings screen unchanged.',
  studioDescription: 'Manage the existing fixed role settings and experimental features provided by Studio.',
};
const zh: typeof ko = {
  navigation: 'Studio 区域', design: '设计', mock: '模拟', legacy: '现有功能',
  workflows: '工作流', agents: '智能体', components: '组件', systems: '系统',
  dsh: 'DSH 预设编辑', studio: '角色与实验功能',
  title: 'DSH 预设编辑',
  description: '保留内置设置界面，直接覆盖配置文件中的智能体预设声明',
  studioDescription: '管理 Studio 提供的现有固定角色设置和实验功能',
};

const DESIGN = ['workflows', 'agents', 'components', 'systems'] as const;
const LEGACY = ['dsh', 'studio'] as const;

/** Left navigation over Studio sections with a separate content scroller.
 * @param props Active locale, optional controlled section, existing Studio features as children, the preset editor, and mock design pages.
 * @returns Navigation and one visible section; every section stays mounted.
 */
export function SettingsLayout({ locale, children, presets, pages = {}, section: controlled, onSectionChange }: React.PropsWithChildren<{
  locale: string; presets?: React.ReactNode; pages?: DesignPages; section?: StudioSection; onSectionChange?: (section: StudioSection) => void;
}>) {
  const t = locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [local, setLocal] = React.useState<StudioSection>('workflows');
  const section = controlled ?? local;
  const select = (next: StudioSection) => { setLocal(next); onSectionChange?.(next); };
  const id = React.useId();
  const scroller = React.useRef<HTMLDivElement>(null);
  // A different page starts at its top; staying on a page keeps its scroll position.
  React.useLayoutEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; }, [section]);
  const item = (value: StudioSection) => <button key={value} type="button" className="studio-nav-item" aria-current={section === value ? 'page' : undefined}
    aria-controls={`${id}-${value}`} onClick={() => select(value)}>{t[value]}</button>;
  return <div className="studio-layout">
    <nav className="studio-nav" aria-label={t.navigation}>
      <strong className="studio-nav-title">DSH Studio</strong>
      <span className="studio-nav-group">{t.design}<span className="studio-nav-badge">{t.mock}</span></span>
      {DESIGN.map(item)}
      <span className="studio-nav-group">{t.legacy}</span>
      {LEGACY.map(item)}
    </nav>
    <div className="studio-scroller" ref={scroller} data-studio-scroller="">
      <div className="studio-content">
        {DESIGN.map(value => <section key={value} id={`${id}-${value}`} aria-label={t[value]} hidden={section !== value}>{pages[value]}</section>)}
        <section id={`${id}-dsh`} aria-label={t.dsh} hidden={section !== 'dsh'}>
          <header className="studio-page-head"><h2>{t.title}</h2><p className="studio-muted">{t.description}</p></header>
          {presets}
        </section>
        <section id={`${id}-studio`} aria-label={t.studio} hidden={section !== 'studio'}>
          <header className="studio-page-head"><h2>{t.studio}</h2><p className="studio-muted">{t.studioDescription}</p></header>
          <div className="studio-feature-stack">{children}</div>
        </section>
      </div>
    </div>
  </div>;
}
