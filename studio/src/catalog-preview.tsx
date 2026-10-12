/** Localized illustrative comparison; never reads or launches real agents. */
import React from 'react';
const en = {
  title: 'Panel comparison', example: 'Illustrative example — not a running agent.', off: 'OFF · Default list', on: 'ON · Additional information',
  agent: 'Research assistant', summary: 'Running · 1,240 tokens · 12 s', navigation: 'Open conversation · Open in sidebar',
  role: 'Role: Research assistant · Evidence research', task: 'Assignment: Compare three sources', snapshot: 'Creation snapshot',
  revision: 'Saved role revision: 3', instructions: 'Instructions: Cite sources and distinguish facts from estimates.', model: 'Requested model: example-provider / example-model', tools: 'Tool filter: allow web_search, web_fetch',
  note: 'Both modes retain ordinary subagents and conversation navigation. Additional fields appear only when recorded. Currently, role snapshots are available for children launched through Studio; ordinary children do not acquire a Studio role or new settings.',
};
const ko: typeof en = {
  title: '패널 표시 비교', example: '이해를 돕기 위한 예시이며 실제 실행 중인 에이전트가 아닙니다.', off: 'OFF · 기본 목록', on: 'ON · 추가 정보 표시',
  agent: '자료 조사 도우미', summary: '실행 중 · 1,240 토큰 · 12초', navigation: '대화 열기 · 사이드바에서 열기',
  role: '역할: 자료 조사 도우미 · 근거 조사', task: '할 일: 세 가지 출처 비교', snapshot: '생성 시점 정보',
  revision: '저장된 역할 리비전: 3', instructions: '지시문: 출처를 인용하고 사실과 추정을 구분하세요.', model: '요청 모델: example-provider / example-model', tools: '도구 필터: web_search, web_fetch 허용',
  note: '두 모드 모두 일반 서브에이전트와 대화 열기를 유지합니다. 추가 항목은 기록이 있을 때만 표시됩니다. 현재 역할 스냅샷은 Studio로 호출한 자식에 제공되며, 일반 자식에 Studio 역할이나 새 설정을 적용하지 않습니다.',
};
const zh: typeof en = {
  title: '面板显示对比', example: '仅为示例，并非正在运行的智能体', off: 'OFF · 默认列表', on: 'ON · 附加信息',
  agent: '资料研究助手', summary: '运行中 · 1,240 令牌 · 12 秒', navigation: '打开会话 · 在侧栏打开',
  role: '角色：资料研究助手 · 证据研究', task: '任务：比较三个来源', snapshot: '创建时快照',
  revision: '已保存角色版本：3', instructions: '指令：引用来源，区分事实与估计', model: '请求模型：example-provider / example-model', tools: '工具过滤：允许 web_search、web_fetch',
  note: '两种模式均保留普通子智能体和会话导航。仅显示有记录的附加信息。目前角色快照仅适用于通过 Studio 启动的子会话，不会为普通子会话应用 Studio 角色或新设置',
};
/** @param locale Active language. @returns Non-interactive examples of the same child in both modes. */
export function CatalogPreview({ locale }: { locale: string }): React.ReactElement {
  const t = locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const samples = [
    { title: 'Prepare isolated worktree tooling', task: 'New worktree /Users/example/project', tokens: '825K tok', time: '4m 47s' },
    { title: 'Implement DSH model adapter', task: 'Implement independent model adapter', tokens: '2.5M tok', time: '8m 39s' },
    { title: 'Implement role editing UI', task: 'Implement role editing and validation', tokens: '2.8M tok', time: '14m 30s' },
  ];
  return <section className="studio-comparison" aria-label={t.title}><h3>{t.title}</h3><p>{t.example}</p>
    <div className="studio-comparison-grid">{[false, true].map(enabled => <section key={String(enabled)} aria-label={enabled ? t.on : t.off}>
      <h4>{enabled ? 'After' : 'Before'} <span className="studio-catalog-meta">{enabled ? t.on : t.off}</span></h4>
      <div className="studio-comparison-panel">{samples.map((sample, index) => enabled ?
        <section className="studio-catalog-row" key={sample.title}>
          <strong>{sample.title}</strong><div className="studio-catalog-meta">{sample.task}</div>
          <div className="studio-catalog-meta">{sample.tokens} · {sample.time}</div>
          {index === 0 && <><p>{t.role}</p><p className="studio-catalog-task">{t.task}</p><details open><summary>{t.snapshot}</summary>
            <div className="studio-comparison-snapshot">{[t.revision, t.instructions, t.model, t.tools].map(value => <p key={value}>{value}</p>)}</div>
          </details></>}
          <p className="studio-comparison-navigation">{t.navigation}</p>
        </section> : <div className="studio-comparison-native-row" key={sample.title}>
          <span className="studio-comparison-dot" aria-hidden="true" />
          <div className="studio-comparison-label"><div>{sample.title}</div><div className="studio-comparison-secondary">{sample.task}</div></div>
          <div className="studio-comparison-metrics"><div>{sample.tokens}</div><div>{sample.time}</div></div>
          <span className="studio-comparison-chevron" aria-hidden="true">›</span>
        </div>)}</div>
    </section>)}</div><p>{t.note}</p>
  </section>;
}
