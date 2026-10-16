import React from 'react';
import { CONFIG_REQUIRES } from './config-overrides.ts';
import { isDelegationPlugin } from './delegation.ts';
import type { PluginCatalogEntry } from './plugin-catalog.ts';
import { Badge, SectionHead, SettingsRow, Toggle } from './ui.tsx';

type Locale = 'ko' | 'en' | 'zh';
const copy: Record<Locale, Record<string, string> & { title: string; hint: string }> = {
  ko: { title: '포함할 플러그인', hint: 'Studio 기준 구성의 플러그인은 기본으로 모두 포함됩니다. 끄면 이 프리셋 구성에서 빠지고, 값만 바꾸려면 아래 Config에서 덮어쓰세요. 선택한 도구를 제공하는 플러그인을 끄면 반영할 때 막힙니다.',
    included: '포함', excluded: '제외', overridden: '덮어쓰기', defaults: '기본값', follows: '함께 제외', requires: '필요: ',
    autoOff: '자동 압축 꺼짐 (auto: false)', autoOn: '자동 압축 켜짐', manual: '/compact 명령', declared: '선언 기준이며 실행 중 세션의 상태는 아닙니다.',
    '@deepseek-ai/dsh-agent-instructions': 'AGENTS.md 지침', '@deepseek-ai/dsh-time-context': '현재 시각 안내', '@deepseek-ai/dsh-skill-filesystem': '스킬 목록',
    '@deepseek-ai/dsh-compaction-basic': '자동 대화 압축', '@deepseek-ai/dsh-command-compact': '수동 압축 (/compact)', '@deepseek-ai/dsh-compaction-tool-result-pruner': '긴 도구 결과 줄이기' },
  en: { title: 'Included plugins', hint: 'Every plugin in the Studio base composition is included by default. Turning one off leaves it out of this preset; to change values only, override them in Config below. Applying is blocked if a selected tool loses its plugin.',
    included: 'Included', excluded: 'Excluded', overridden: 'Override', defaults: 'Defaults', follows: 'Excluded with dependency', requires: 'Requires: ',
    autoOff: 'Automatic compaction off (auto: false)', autoOn: 'Automatic compaction on', manual: '/compact command', declared: 'Shows the declaration, not the state of a running session.',
    '@deepseek-ai/dsh-agent-instructions': 'AGENTS.md instructions', '@deepseek-ai/dsh-time-context': 'Current time notice', '@deepseek-ai/dsh-skill-filesystem': 'Skill catalog',
    '@deepseek-ai/dsh-compaction-basic': 'Automatic compaction', '@deepseek-ai/dsh-command-compact': 'Manual compaction (/compact)', '@deepseek-ai/dsh-compaction-tool-result-pruner': 'Trim long tool results' },
  zh: { title: '包含的插件', hint: 'Studio 基础组成中的插件默认全部包含。关闭后将从此预设中移除；如只需修改值，请在下方 Config 中覆盖。若已选工具失去其插件，将无法应用',
    included: '包含', excluded: '排除', overridden: '覆盖', defaults: '默认值', follows: '随依赖排除', requires: '需要：',
    autoOff: '自动压缩已关闭 (auto: false)', autoOn: '自动压缩已开启', manual: '/compact 命令', declared: '显示的是声明，而非运行中会话的状态',
    '@deepseek-ai/dsh-agent-instructions': 'AGENTS.md 指令', '@deepseek-ai/dsh-time-context': '当前时间提示', '@deepseek-ai/dsh-skill-filesystem': '技能目录',
    '@deepseek-ai/dsh-compaction-basic': '自动压缩', '@deepseek-ai/dsh-command-compact': '手动压缩 (/compact)', '@deepseek-ai/dsh-compaction-tool-result-pruner': '精简过长的工具结果' },
};
export const localeOf = (locale: string): Locale => locale.startsWith('ko') ? 'ko' : locale.startsWith('zh') ? 'zh' : 'en';
export const featureLabel = (name: string, locale: string) => copy[localeOf(locale)][name] ?? name;

/** One row's three-way state: excluded wins; otherwise an override key, otherwise DSH defaults. */
export function featureState(id: string, overrides: Record<string, unknown>, excluded: readonly string[]): 'defaults' | 'overridden' | 'excluded' {
  return excluded.includes(id) ? 'excluded' : Object.hasOwn(overrides, id) ? 'overridden' : 'defaults';
}

/**
 * Include/exclude switches for the non-tool features in the Master. Turning a feature off records
 * an exclusion and drops its Config override (excluded and overridden cannot coexist); turning it
 * back on returns it to DSH defaults. Dependants follow their requirement and are shown as such.
 */
export function FeatureInclusion({ entries, overrides, excluded, onChange, locale }: {
  entries: readonly PluginCatalogEntry[]; overrides: Record<string, Record<string, unknown>>; excluded: readonly string[];
  onChange(next: { overrides: Record<string, Record<string, unknown>>; excluded: string[] }): void; locale: string;
}): React.ReactElement | null {
  const t = copy[localeOf(locale)];
  // Delegation plugins are replaced by the role tool on apply, so they are configured in the Subagent tab.
  const rows = entries.filter(entry => !isDelegationPlugin(entry.name));
  if (!rows.length) return null;
  const idOf = (name: string) => rows.find(entry => entry.name === name)?.id;
  const followed = (entry: PluginCatalogEntry) => { const needs = CONFIG_REQUIRES[entry.name]; const id = needs && idOf(needs); return !!id && excluded.includes(id) && !excluded.includes(entry.id); };
  const set = (id: string, include: boolean) => {
    const nextOverrides = { ...overrides };
    if (!include) delete nextOverrides[id];
    onChange({ overrides: nextOverrides, excluded: include ? excluded.filter(item => item !== id) : [...excluded, id] });
  };
  const compaction = rows.find(entry => entry.name === '@deepseek-ai/dsh-compaction-basic');
  const auto = compaction && (overrides[compaction.id]?.auto ?? (compaction.config as Record<string, unknown> | undefined)?.auto);
  return <section className="studio-stack">
    <SectionHead title={t.title} description={t.hint} />
    <div className="studio-settings-card" role="group" aria-label={t.title}>
      {rows.map(entry => {
        const follows = followed(entry);
        const state = follows ? 'excluded' : featureState(entry.id, overrides, excluded);
        const needs = CONFIG_REQUIRES[entry.name];
        const detail = follows ? `${t.follows} · ${t.requires}${featureLabel(needs!, locale)}`
          : entry.name === '@deepseek-ai/dsh-compaction-basic' && state !== 'excluded' ? `${entry.id} · ${auto === false ? t.autoOff : t.autoOn}`
            : featureLabel(entry.name, locale) === entry.name ? entry.id : `${entry.id} · ${entry.name}`;
        return <SettingsRow key={entry.id} title={<>{featureLabel(entry.name, locale)} <Badge tone={state === 'excluded' ? 'neutral' : state === 'overridden' ? 'info' : 'outline'}>{t[state]}</Badge></>} description={detail}
          control={<Toggle label={featureLabel(entry.name, locale)} checked={state !== 'excluded'} disabled={follows} onChange={include => set(entry.id, include)} />} />;
      })}
    </div>
    <p className="studio-muted studio-hint">{t.declared}</p>
  </section>;
}
