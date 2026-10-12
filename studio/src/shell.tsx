import { StudioSurface } from './ui.tsx';
import React from "react";
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots';
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots';
import { ServiceLayout, type StudioServiceItem } from './service-layout.tsx';
import { serviceText } from './service-locales.ts';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import { SettingsLayout, type StudioSection } from './settings-layout.tsx';
import { MockStudioProvider } from './mock-store.tsx';
import { MockWorkflow } from './mock-workflow.tsx';
import { MockAgents, MockComponents, MockSystems } from './mock-library.tsx';
import type { StudioContext, StudioProps, IconProps } from "./contracts.js";
import { DetailLayout } from './detail-layout.tsx';
import { experimentText } from './experiment-locales.ts';

export const inject = ["slots", "remote", "remote.pluginManager", "locale"];
const panel = "local-dsh-studio";
export function apply(ctx: StudioContext) {
    ctx.effect(() => ctx.locale.addLanguage({ id: 'ko', label: '한국어', fallback: 'en' }));
    const serviceListeners = new Set<() => void>();
    let services: readonly StudioServiceItem[] = [];
    const syncServices = () => {
        services = ctx.slots.entriesOfSlot('local.dsh-studio.services').slice().sort((a, b) => (a.options.order ?? 0) - (b.options.order ?? 0)).map(({ options }) => ({
            id: options.id!, label: resolveSlotLabel(options.label) ?? options.id!,
        }));
        serviceListeners.forEach(listener => listener());
    };
    ctx.effect(() => ctx.slots.subscribe('local.dsh-studio.services', syncServices));
    ctx.effect(() => ctx.locale.subscribe(syncServices));
    function StudioServices({ renderSlot }: PropsRenderSlots<'local.dsh-studio.services'>) {
        const items = React.useSyncExternalStore(listener => { serviceListeners.add(listener); return () => { serviceListeners.delete(listener); }; }, () => services);
        const locale = React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getLocale().active);
        return <StudioSurface className="studio-shell"><main className="studio-page">
            <ServiceLayout locale={locale} services={items} renderSlot={renderSlot} />
        </main></StudioSurface>;
    }
    function Experiments({ renderSlot }: StudioProps) {
        const locale = React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getLocale().active);
        const t = experimentText(locale);
        const [selected, select] = React.useState('agent-optimizations');
        return <DetailLayout title={serviceText(locale).experiments} navigation={t.title}
            pages={[{ id: 'agent-optimizations', label: t.title, content: renderSlot('local.dsh-studio.features', {}, { only: 'agent-optimizations' }) }]}
            selected={selected} onSelect={select} />;
    }
    function DesignPreview() {
        const locale = React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getLocale().active);
        const [section, setSection] = React.useState<StudioSection>('workflows');
        return <MockStudioProvider locale={locale} go={setSection}>
            <SettingsLayout locale={locale} section={section} onSectionChange={setSection}
                pages={{ workflows: <MockWorkflow />, agents: <MockAgents />, components: <MockComponents />, systems: <MockSystems /> }} />
        </MockStudioProvider>;
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
                    'local.dsh-studio.services': { kind: 'list', scope: 'root' },
                },
            },
            StudioServices,
        ),
    );
    ctx.slots.inject('local.dsh-studio.services', function* () {
        yield ctx.slots.register({ name: 'local.dsh-studio.services', id: 'design-preview', order: 40,
            label: () => serviceText(ctx.locale.getLocale().active).preview }, DesignPreview);
        yield ctx.slots.register({ name: 'local.dsh-studio.services', id: 'experiments', order: 50,
            label: () => serviceText(ctx.locale.getLocale().active).experiments,
            children: { 'local.dsh-studio.features': { kind: 'list', scope: 'root' } },
        }, Experiments);
    });
    syncServices();
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
