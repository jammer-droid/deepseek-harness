import React from 'react';
import { Button, Note } from './ui.tsx';
export interface MasterExtensionActions { read(): Promise<unknown>; save(payload: string): Promise<void> }
export function MasterExtensionsEditor({ locale, actions }: { locale: string; actions?: MasterExtensionActions | undefined }) {
  const t = (ko: string, en: string, zh: string) => locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en;
  const [text, setText] = React.useState('[]'); const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false); const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => { let active = true; if (actions) actions.read().then(value => { if (active) { setText(JSON.stringify(value, null, 2)); setLoaded(true); } }, e => { if (active) setError(String(e)); }); return () => { active = false; }; }, [actions]);
  return <details><summary>{t('Studio 추가 도구 제공자', 'Studio-added tool providers', 'Studio 添加的工具提供者')}</summary>
    <Note>{t('설치된 플러그인의 구성 목록을 JSON으로 등록합니다. 패키지를 설치하거나 도구 실행 코드를 생성하지 않습니다. 등록 시 플러그인 코드가 실행되므로 신뢰하는 제공자만 추가하세요. 설정은 로컬에 평문 저장됩니다. 기존 적용 프리셋은 자동 변경되지 않습니다.', 'Register installed provider compositions as JSON. This does not install packages or generate tool code. Registration executes plugin code: add trusted providers only. Settings are stored locally as plaintext. Applied presets are not automatically changed.', '以 JSON 注册已安装的提供者配置。不安装软件包或生成工具代码。注册会执行插件代码，请仅添加可信提供者。设置以明文保存在本地。已应用的预设不会自动改变。')}</Note>
    <ol>
      <li>{t('사용할 플러그인이 현재 DSH 프로필에 설치되어 있는지 확인하세요. 자동 설치는 하지 않습니다.', 'Ensure the plugin is installed in this DSH profile. Packages are not installed automatically.', '确认插件已安装在当前 DSH 配置中，不会自动安装。')}</li>
      <li>{t('아래 배열에 id(고유한 소문자 식별자), name(정확한 패키지 이름), config(해당 플러그인의 공개 설정)를 입력하세요.', 'Add an entry with id (unique lowercase identifier), name (exact package name), and config (public plugin settings).', '在数组中填写 id（唯一小写标识符）、name（准确的软件包名）和 config（插件公开设置）。')}</li>
      <li>{t('검증하고 마스터에 반영을 누르면 도구 목록이 갱신됩니다. 필요한 도구를 선택해 프리셋을 저장하세요.', 'Validate and update master to refresh the tool list, then select the tools and save your preset.', '验证并更新主预设后，选择所需工具并保存预设。')}</li>
    </ol>
    <p>{t('예시: 설치된 subagent 제공자를 별도 도구 이름으로 등록', 'Example: register the installed subagent provider under a distinct tool name', '示例：使用不同工具名注册已安装的 subagent 提供者')}</p>
    <pre>{JSON.stringify([{ id: 'extra-agent', name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'spawn', toolName: 'studio_extra_agent' } }], null, 2)}</pre>
    <Note>{t('저장은 추가 제공자 목록 전체를 교체합니다. 기존 항목을 유지하려면 배열에 남겨 두세요. []를 저장하면 추가 제공자만 모두 제거합니다. 기존 도구 이름과 충돌하지 않게 등록하세요. 플러그인별 의존 서비스가 없으면 활성화가 실패할 수 있습니다.', 'Saving replaces the entire extension list. Keep existing entries to retain them; [] removes all added providers only. Avoid existing tool names. Missing plugin service dependencies can prevent activation.', '保存会替换整个附加提供者列表。保留已有条目以免删除；保存 [] 仅移除全部附加提供者。避免工具重名；缺少依赖服务可能导致激活失败。')}</Note>
    <label className="studio-field"><span>{t('제공자 구성', 'Provider composition', '提供者配置')}</span><textarea rows={10} value={text} disabled={!loaded || busy} onChange={event => setText(event.target.value)} /></label>
    <Button disabled={!loaded || busy} onClick={async () => { if (!actions) return; setBusy(true); setError(''); try { await actions.save(text); } catch (e) { setError(String(e)); } finally { setBusy(false); } }}>{t('검증하고 마스터에 반영', 'Validate and update master', '验证并更新主预设')}</Button>
    {error && <p role="alert">{error}</p>}
  </details>;
}
