import { StudioSurface } from './ui.tsx';
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
                <StudioSurface><div role="status" className="studio-timer">
                    <strong>{elapsed}<span> 초</span></strong>
                    <p>
                        이 페이지의 Client 플러그인이 실행 중입니다. 화면을
                        이동해도 유지되며 OFF 시 정리됩니다.
                    </p>
                </div></StudioSurface>
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
