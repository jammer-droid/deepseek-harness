/** Explicit profile-wide opt-in, independently owned from the catalog plugin. */
import React from 'react';
import type { PluginManager, PluginRow } from './contracts.ts';
import { Button, Notice, StudioSurface } from './ui.tsx';
import { CatalogPreview } from './catalog-preview.tsx';
const en = { title: 'Subagent additional information', description: 'Launch saved roles and show creation snapshots in the native subagent list. Turning this off restores the original list. Changes affect this profile.', enable: 'Enable', disable: 'Disable', reload: 'Read state', loading: 'Reading plugin state', unavailable: 'Install the Studio catalog package and use a managed profile to enable this experiment.', failed: 'Could not confirm the change. Read the state before trying again.', restart: 'Saved. Restart this profile to apply the change.', done: 'Applied. Refresh the workflow editor to load the available role components.' };
const ko: typeof en = { title: '서브에이전트 추가 정보 표시', description: '저장된 역할을 호출하고 기존 서브에이전트 목록에 생성 시점 설정을 표시합니다. 끄면 원래 목록이 복구됩니다. 변경은 이 프로필 전체에 적용됩니다.', enable: '켜기', disable: '끄기', reload: '상태 읽기', loading: '플러그인 상태 읽는 중', unavailable: 'Studio 카탈로그 패키지를 설치하고 관리 가능한 프로필에서 실험을 켜 주세요.', failed: '변경 결과를 확인하지 못했습니다. 다시 시도하기 전에 상태를 읽어 주세요.', restart: '저장했습니다. 적용하려면 이 프로필을 다시 시작하세요.', done: '적용했습니다. 역할 컴포넌트를 불러오려면 워크플로 편집기를 새로 열어 주세요.' };
const zh: typeof en = { title: '子智能体附加信息', description: '调用已保存的角色，在原生子智能体列表中显示创建时的设置。关闭后恢复原列表。更改影响整个配置文件。', enable: '启用', disable: '禁用', reload: '读取状态', loading: '正在读取插件状态', unavailable: '请安装 Studio 目录包并使用可管理的配置文件以启用此实验。', failed: '无法确认更改结果。重试前请读取状态。', restart: '已保存。请重启此配置文件以应用更改。', done: '已应用。请重新打开工作流编辑器以加载角色组件。' };
/** @param locale Active language. @returns Shared navigation and panel title. */
export function catalogSettingsTitle(locale: string): string { return (locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en).title; }
/** @param props Locale and profile management operations. @returns Recoverable opt-in control. */
export function CatalogToggle({ locale, api }: { locale: string; api: PluginManager }) {
  const t = locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [row, setRow] = React.useState<PluginRow>();
  const [busy, setBusy] = React.useState(true);
  const [status, setStatus] = React.useState<'failed' | 'restart' | 'done'>();
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = React.useCallback(async () => {
    setBusy(true); setStatus(undefined);
    try { const rows = await api.listPlugins(); if (alive.current) setRow(rows.find(item => item.moduleName === '@local/dsh-studio-catalog')); }
    catch { if (alive.current) setStatus('failed'); }
    finally { if (alive.current) setBusy(false); }
  }, [api]);
  React.useEffect(() => { void load(); }, [load]);
  async function toggle() {
    if (!row) return;
    setBusy(true); setStatus(undefined);
    try {
      const result = await api.setPluginEnabled(row.entryId, !row.enabled);
      const rows = await api.listPlugins();
      if (alive.current) {
        setRow(rows.find(item => item.entryId === row.entryId));
        setStatus(result.application === 'applied' ? 'done' : result.application === 'restart-required' ? 'restart' : 'failed');
      }
    } catch { if (alive.current) setStatus('failed'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <StudioSurface><section className="studio-card"><h2>{t.title}</h2><p>{t.description}</p>
    {status === 'failed' ? <Notice>{t.failed}</Notice> : status && <p role="status">{t[status]}</p>}
    {busy ? <p role="status">{t.loading}</p> : (!row || row.readOnlyReason) && <p>{t.unavailable}</p>}
    <Button disabled={busy || !row || Boolean(row.readOnlyReason) || status === 'failed' || status === 'restart'} onClick={() => void toggle()}>{row?.enabled ? t.disable : t.enable}</Button>
    <Button disabled={busy} onClick={() => void load()}>{t.reload}</Button>
    <CatalogPreview locale={locale} />
  </section></StudioSurface>;
}
