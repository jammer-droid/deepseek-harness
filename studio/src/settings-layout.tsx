/** Studio-only navigation; hidden feature content stays mounted to retain drafts. */
import React from 'react';
import { Button } from './ui.tsx';

const ko = {
  navigation: 'Studio 설정 영역', dsh: 'DSH 설정', studio: 'Studio 기능',
  intro: 'DSH 기본 설정과 Studio 전용 기능을 구분하여 관리합니다.',
  title: 'DSH 설정 오버라이드',
  description: '기본 설정 화면은 그대로 두고, Studio에서 필요한 설정을 재정의하는 영역입니다.',
  preset: '에이전트 프리셋',
  presetDescription: '프리셋의 지침, 도구 구성, 플러그인 옵션을 편집할 공간입니다.',
  pending: '편집 기능 준비 중',
  note: '현재는 화면 구성만 제공하며, DSH 설정을 읽거나 변경하지 않습니다.',
  studioDescription: 'Studio에서 제공하는 역할 설정과 실험 기능을 관리합니다.',
};
const en: typeof ko = {
  navigation: 'Studio settings sections', dsh: 'DSH settings', studio: 'Studio features',
  intro: 'Manage DSH settings separately from Studio-specific features.',
  title: 'DSH settings overrides',
  description: 'Override selected DSH settings here while keeping the built-in settings screen unchanged.',
  preset: 'Agent presets', presetDescription: 'A dedicated space for preset instructions, tools, and plugin options.',
  pending: 'Editing coming later', note: 'This is a layout preview. It does not read or change DSH settings.',
  studioDescription: 'Manage role settings and experimental features provided by Studio.',
};
const zh: typeof ko = {
  navigation: 'Studio 设置区域', dsh: 'DSH 设置', studio: 'Studio 功能',
  intro: '分别管理 DSH 设置与 Studio 专属功能', title: 'DSH 设置覆盖',
  description: '在此覆盖所需的 DSH 设置，同时保留内置设置界面',
  preset: '智能体预设', presetDescription: '用于编辑预设指令、工具组合和插件选项的专属区域',
  pending: '编辑功能尚未开放', note: '目前仅展示界面布局，不会读取或修改 DSH 设置',
  studioDescription: '管理 Studio 提供的角色设置和实验功能',
};

/** Separate native settings overrides from Studio features without changing their operations.
 * @param props Active locale and existing Studio feature controls.
 * @returns Local navigation and two independently labelled sections.
 */
export function SettingsLayout({ locale, children, presets }: React.PropsWithChildren<{ locale: string; presets?: React.ReactNode }>) {
  const t = locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [section, setSection] = React.useState<'dsh' | 'studio'>('studio');
  const id = React.useId();
  return <>
    <p className="studio-muted">{t.intro}</p>
    <nav className="studio-section-nav" aria-label={t.navigation}>
      <Button aria-pressed={section === 'dsh'} aria-controls={`${id}-dsh`} onClick={() => setSection('dsh')}>{t.dsh}</Button>
      <Button aria-pressed={section === 'studio'} aria-controls={`${id}-studio`} onClick={() => setSection('studio')}>{t.studio}</Button>
    </nav>
    <section id={`${id}-dsh`} aria-label={t.dsh} hidden={section !== 'dsh'}>
      <header><h2>{t.title}</h2><p className="studio-muted">{t.description}</p></header>
      {presets}
    </section>
    <section id={`${id}-studio`} aria-label={t.studio} hidden={section !== 'studio'}>
      <header><h2>{t.studio}</h2><p className="studio-muted">{t.studioDescription}</p></header>
      <div className="studio-feature-stack">{children}</div>
    </section>
  </>;
}
