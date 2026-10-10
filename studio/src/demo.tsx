import React from "react";
import type { FeatureContext, Dispose } from "./contracts.js";
import { createTimer } from "./timer.js";
export const inject = ["slots"];
export function apply(ctx: FeatureContext) {
    ctx.slots.inject("local.dsh-studio.features", () => {
        const timer = createTimer();
        function Counter() {
            const elapsed = React.useSyncExternalStore(
                timer.subscribe,
                timer.getSnapshot,
            );
            return (
                <div
                    role="status"
                    style={{
                        padding: 20,
                        borderRadius: 8,
                        background: "var(--dsw-alias-bg-layer-2)",
                    }}
                >
                    <strong
                        style={{
                            fontSize: 32,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {elapsed}
                        <span style={{ fontSize: 14 }}> 초</span>
                    </strong>
                    <p>
                        이 페이지의 Client 플러그인이 실행 중입니다. 화면을
                        이동해도 유지되며 OFF 시 정리됩니다.
                    </p>
                </div>
            );
        }
        let unregister: Dispose;
        try {
            unregister = ctx.slots.register(
                {
                    name: "local.dsh-studio.features",
                    id: "demo-timer",
                    order: 0,
                },
                Counter,
            );
        } catch (error) {
            timer.dispose();
            throw error;
        }
        return () => {
            timer.dispose();
            unregister();
        };
    });
}
