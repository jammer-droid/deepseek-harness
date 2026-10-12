import { Button, StudioSurface } from './ui.tsx';
import React from "react";
import type {} from '@deepseek-ai/dsh-client-locale/client';
import { SettingsLayout, type StudioSection } from './settings-layout.tsx';
import { MockStudioProvider } from './mock-store.tsx';
import { MockWorkflow } from './mock-workflow.tsx';
import { MockAgents, MockComponents, MockSystems } from './mock-library.tsx';
import type { StudioContext, StudioProps, IconProps } from "./contracts.js";
import { createController, remoteManager } from "./controller.js";

export const inject = ["slots", "remote", "remote.pluginManager", "locale"];
const panel = "local-dsh-studio";
export function apply(ctx: StudioContext) {
    const controller = createController(
        remoteManager(ctx.remote.pluginManager),
    );
    ctx.effect(() => () => controller.dispose());
    ctx.effect(() => {
        const refresh = () => void controller.refresh();
        const offChange = ctx.remote.$on("plugin-manager/changed", refresh);
        const offReset = ctx.on("connection/reset", refresh);
        refresh();
        return () => {
            offChange();
            offReset();
        };
    });
    function Studio({ renderSlot }: StudioProps) {
        const state = React.useSyncExternalStore(
            controller.subscribe,
            controller.getSnapshot,
        );
        const locale = React.useSyncExternalStore(
            listener => ctx.locale.subscribe(listener),
            () => ctx.locale.getLocale().active,
        );
        const row = state.row;
        const [section, setSection] = React.useState<StudioSection>('workflows');
        return (
            <StudioSurface className="studio-shell"><main className="studio-page">
                <MockStudioProvider locale={locale} go={setSection}>
                    <SettingsLayout locale={locale} section={section} onSectionChange={setSection} presets={renderSlot('local.dsh-studio.presets', {})}
                        pages={{ workflows: <MockWorkflow />, agents: <MockAgents />, components: <MockComponents />, systems: <MockSystems /> }}>
                    <section className="studio-card" aria-label="Studio 기능">
                        <div className="studio-row">
                            <div>
                                <h2>
                                    데모 타이머
                                </h2>
                                <p className="studio-muted">
                                    플러그인의 활성화와 자원 정리를 확인하는
                                    작은 실험입니다.
                                </p>
                            </div>
                            <Button
                                type="button"
                                role="switch"
                                aria-label="데모 타이머"
                                aria-checked={Boolean(row?.enabled)}
                                disabled={
                                    !row ||
                                    state.busy ||
                                    Boolean(row.readOnlyReason)
                                }
                                onClick={() => void controller.toggle()}
                            >
                                {state.busy
                                    ? "적용 중…"
                                    : !row
                                      ? "확인 불가"
                                      : row.enabled
                                        ? "ON"
                                        : "OFF"}
                            </Button>
                        </div>
                        <p className="studio-muted">
                            설정:{" "}
                            {state.loading
                                ? "조회 중"
                                : !row
                                  ? "확인 불가"
                                  : row.enabled
                                    ? "ON"
                                    : "OFF"}{" "}
                            · Host 상태:{" "}
                            {!row ? "확인 불가" : (row.fiberPhase ?? "비활성")}{" "}
                            · 범위: 현재 profile
                        </p>
                        {row?.readOnlyReason && (
                            <p role="alert">
                                변경할 수 없는 행입니다: {row.readOnlyReason}
                            </p>
                        )}
                        {state.error && (
                            <p
                                role="alert"
                            >
                                {state.error}
                            </p>
                        )}
                        {state.notice && <p role="status">{state.notice}</p>}
                        <Button
                            type="button"
                            onClick={() => void controller.refresh()}
                        >
                            상태 새로고침
                        </Button>
                    </section>
                    <section className="studio-card"
                        aria-label="실행 중인 기능"
                    >
                        <h2>Client 실행 영역</h2>
                        <p className="studio-muted">
                            실제로 로드된 기능만 아래에 표시됩니다. OFF이면
                            타이머와 화면 등록이 모두 해제됩니다.
                        </p>
                        {renderSlot("local.dsh-studio.features", {})}
                    </section>
                    </SettingsLayout>
                </MockStudioProvider>
            </main></StudioSurface>
        );
    }
    function Icon({ size = 20 }: IconProps) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
            >
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
                <path d="M17.5 14v7M14 17.5h7" />
            </svg>
        );
    }
    ctx.slots.inject("main", () =>
        ctx.slots.register(
            {
                name: "main",
                key: panel,
                children: {
                    'local.dsh-studio.presets': { kind: 'list', scope: 'root' },
                    "local.dsh-studio.features": {
                        kind: "list",
                        scope: "root",
                    },
                },
            },
            Studio,
        ),
    );
    ctx.slots.inject("sidebar.panellist", () =>
        ctx.slots.register(
            {
                name: "sidebar.panellist",
                id: panel,
                order: 20,
                label: "DSH Studio",
            },
            Icon,
        ),
    );
}
