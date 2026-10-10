import React from "react";
import type { StudioContext, StudioProps, IconProps } from "./contracts.js";
import { createController, remoteManager } from "./controller.js";

export const inject = ["slots", "remote", "remote.pluginManager"];
const panel = "local-dsh-studio";
const colors = {
    background: "var(--dsw-alias-bg-base)",
    color: "var(--dsw-alias-label-primary)",
};
const card = {
    padding: 24,
    border: "1px solid var(--dsw-alias-border-l1)",
    borderRadius: 12,
    background: "var(--dsw-alias-bg-layer-1)",
};

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
        const row = state.row;
        return (
            <main
                style={{
                    ...colors,
                    height: "100%",
                    overflow: "auto",
                    padding: "40px clamp(20px, 5vw, 72px)",
                    boxSizing: "border-box",
                }}
            >
                <div style={{ maxWidth: 1000, margin: "0 auto" }}>
                    <div
                        style={{
                            color: "var(--dsw-alias-brand-primary)",
                            fontSize: 12,
                            letterSpacing: 3,
                        }}
                    >
                        HARNESS ENGINEERING LAB
                    </div>
                    <h1 style={{ fontSize: 34, marginBottom: 8 }}>
                        DSH Studio
                    </h1>
                    <p
                        style={{
                            color: "var(--dsw-alias-label-secondary)",
                            marginBottom: 32,
                        }}
                    >
                        기능을 켜고 끄며 실행 환경을 구성합니다. 설정은 현재
                        프로필 전체에 적용됩니다.
                    </p>
                    <section style={card} aria-label="Studio 기능">
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 20,
                            }}
                        >
                            <div>
                                <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>
                                    데모 타이머
                                </h2>
                                <p style={{ margin: 0 }}>
                                    플러그인의 활성화와 자원 정리를 확인하는
                                    작은 실험입니다.
                                </p>
                            </div>
                            <button
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
                                style={{
                                    padding: "10px 22px",
                                    borderRadius: 24,
                                    border: "1px solid var(--dsw-alias-border-l2)",
                                    background: row?.enabled
                                        ? "var(--dsw-alias-brand-primary)"
                                        : "var(--dsw-alias-bg-layer-2)",
                                    color: "var(--dsw-alias-label-primary)",
                                    cursor: "pointer",
                                }}
                            >
                                {state.busy
                                    ? "적용 중…"
                                    : !row
                                      ? "확인 불가"
                                      : row.enabled
                                        ? "ON"
                                        : "OFF"}
                            </button>
                        </div>
                        <p
                            style={{
                                fontSize: 13,
                                color: "var(--dsw-alias-label-secondary)",
                            }}
                        >
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
                                style={{
                                    color: "var(--dsw-alias-state-error-primary)",
                                }}
                            >
                                {state.error}
                            </p>
                        )}
                        {state.notice && <p role="status">{state.notice}</p>}
                        <button
                            type="button"
                            onClick={() => void controller.refresh()}
                        >
                            상태 새로고침
                        </button>
                    </section>
                    <section
                        style={{ ...card, marginTop: 20 }}
                        aria-label="실행 중인 기능"
                    >
                        <h2 style={{ fontSize: 18 }}>Client 실행 영역</h2>
                        <p
                            style={{
                                fontSize: 13,
                                color: "var(--dsw-alias-label-secondary)",
                            }}
                        >
                            실제로 로드된 기능만 아래에 표시됩니다. OFF이면
                            타이머와 화면 등록이 모두 해제됩니다.
                        </p>
                        {renderSlot("local.dsh-studio.features", {})}
                    </section>
                </div>
            </main>
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
