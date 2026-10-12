/** Scoped Studio stylesheet embedded in distributable Client JavaScript. */
export const studioStyles = `/* Only this adapter references host tokens. Studio never installs a global theme. */
.studio-ui {
  --studio-bg: var(--dsw-alias-bg-base);
  --studio-surface: var(--dsw-alias-bg-layer-1);
  --studio-inset: var(--dsw-alias-bg-layer-2);
  --studio-ink: var(--dsw-alias-label-primary);
  --studio-muted: var(--dsw-alias-label-secondary);
  --studio-subtle: var(--dsw-alias-label-tertiary);
  --studio-line: var(--dsw-alias-border-l2);
  --studio-control-line: var(--dsw-alias-border-l3);
  --studio-accent: var(--dsw-alias-brand-primary);
  --studio-hover: var(--dsw-alias-interactive-bg-hover);
  --studio-pressed: var(--dsw-alias-interactive-bg-active);
  --studio-primary-fill: var(--dsw-alias-button-primary-fill);
  --studio-primary-hover: var(--dsw-alias-button-primary-hover);
  --studio-on-primary: var(--dsw-alias-label-primary-foreground);
  --studio-focus: var(--dsw-focus-ring-color);
  --studio-error: var(--dsw-alias-state-error-primary);
  --studio-radius: 12px;
  --studio-control-radius: var(--dsw-radius-md);
  --studio-small-radius: var(--dsw-radius-sm);
  --studio-gap: 16px;
  color: var(--studio-ink);
  font: inherit;
  font-size: 13px;
  line-height: 1.6;
  min-width: 0;
  overflow-wrap: anywhere;
}
.studio-ui *, .studio-ui *::before, .studio-ui *::after { box-sizing: border-box; }
.studio-ui .studio-comparison { margin-top: 24px; }
.studio-ui .studio-comparison-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: var(--studio-gap); align-items: start; }
.studio-ui .studio-comparison-grid > section { min-width: 0; }
.studio-ui .studio-comparison h4 { font-size: 14px; font-weight: 500; margin: 8px 0; }
.studio-ui .studio-comparison-panel { border: 1px solid var(--studio-line); border-radius: var(--studio-radius); background: var(--studio-surface); padding: 6px; overflow: hidden; }
.studio-ui .studio-comparison-native-row { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto 12px; gap: 12px; padding: 12px; align-items: center; border-radius: var(--studio-radius); }
.studio-ui .studio-comparison-native-row:first-child { background: var(--studio-hover); }
.studio-ui .studio-comparison-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); align-self: start; margin-top: 8px; }
.studio-ui .studio-comparison-label > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.studio-ui .studio-comparison-secondary, .studio-ui .studio-comparison-metrics, .studio-ui .studio-comparison-chevron { color: var(--studio-muted); }
.studio-ui .studio-comparison-metrics { text-align: right; font-size: 12px; white-space: nowrap; }
.studio-ui .studio-comparison-chevron { font-size: 20px; }
.studio-ui .studio-comparison-panel .studio-catalog-row { padding: 10px; }
.studio-ui .studio-comparison-panel .studio-catalog-row:first-child { border-top: 0; }
.studio-ui .studio-comparison-snapshot { background: var(--studio-inset); border-radius: var(--studio-small-radius); padding: 8px; margin-top: 8px; }
.studio-ui .studio-comparison-navigation { color: var(--studio-muted); }
.studio-ui.studio-catalog { width: min(336px, calc(100vw - 32px)); max-height: 65vh; overflow: auto; padding: 8px; }
.studio-ui .studio-catalog-row { padding: 8px 0; border-top: 1px solid var(--studio-line); }
.studio-ui .studio-catalog-row p { margin: 4px 0; }
.studio-ui .studio-catalog-meta { color: var(--studio-muted); font-size: 12px; }
.studio-ui .studio-catalog-branch .studio-catalog-branch { margin-left: 12px; padding-left: 8px; border-left: 1px solid var(--studio-line); }
.studio-ui .studio-catalog-task, .studio-ui .studio-catalog-row pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.studio-ui .studio-catalog-expand { color: var(--studio-ink); background: transparent; border: 0; border-radius: var(--studio-small-radius); padding: 4px 8px; font: inherit; cursor: pointer; }
.studio-ui .studio-catalog-expand:hover { background: var(--studio-hover); }
.studio-ui .studio-catalog-expand:focus-visible { outline: 2px solid var(--studio-focus); }
.studio-ui.studio-catalog-launch fieldset { border: 0; padding: 0; margin: 0 0 12px; }
.studio-ui.studio-catalog-launch textarea { min-height: 100px; }

.studio-ui h1, .studio-ui h2, .studio-ui h3, .studio-ui h4, .studio-ui strong, .studio-ui legend { font-weight: 500; }
.studio-ui h1 { font-size: 28px; line-height: 1.3; margin: 8px 0 12px; }
.studio-ui h2 { font-size: 18px; line-height: 1.4; margin: 0 0 12px; }
.studio-ui h3 { font-size: 14px; line-height: 1.5; margin: 16px 0 8px; }
.studio-ui h4 { font-size: 13px; line-height: 1.5; margin: 0; }
.studio-ui p { margin: 8px 0 16px; }
.studio-ui .studio-muted, .studio-ui dt { color: var(--studio-muted); }
.studio-ui .studio-hint { font-size: 12px; margin: 0; }
.studio-ui .studio-grow { flex: 1 1 auto; min-width: 0; }
.studio-ui .studio-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }

/* Page frame: navigation and content scroll independently, so selecting a section never moves the navigation. */
.studio-ui.studio-shell { height: 100%; overflow: hidden; container: studio-shell / inline-size; }
.studio-ui .studio-page { height: 100%; background: var(--studio-bg); }
.studio-ui .studio-services { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.studio-ui .studio-service-nav { display: flex; flex: 0 0 auto; gap: 8px; padding: 12px 16px; overflow-x: auto; border-bottom: .5px solid var(--studio-line); }
.studio-ui .studio-service-nav .studio-nav-item { white-space: nowrap; flex-shrink: 0; }
.studio-ui .studio-service-panel { flex: 1; min-height: 0; overflow-y: auto; }
.studio-ui .studio-service-panel[hidden] { display: none; }
.studio-ui .studio-service-panel > .studio-ui { max-width: 960px; margin: 0 auto; padding: 24px clamp(16px, 3vw, 40px) 48px; }
.studio-ui .studio-layout { display: grid; grid-template-columns: 208px minmax(0, 1fr); height: 100%; }
.studio-ui nav.studio-nav { display: flex; flex-direction: column; flex-wrap: nowrap; gap: 2px; margin: 0; padding: 24px 12px; border-inline-end: .5px solid var(--studio-line); overflow-y: auto; }
.studio-ui .studio-nav-title { padding: 0 10px 8px; font-size: 14px; }
.studio-ui .studio-nav-group, .studio-ui .studio-list-group { display: flex; align-items: center; gap: 6px; padding: 16px 10px 4px; color: var(--studio-subtle); font-size: 12px; }
.studio-ui .studio-nav-badge { padding: 0 6px; border: .5px solid var(--studio-control-line); border-radius: 999px; font-size: 11px; line-height: 16px; }
.studio-ui :is(.studio-nav-item, .studio-list-item) { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; padding: 5px 10px; border: 0; border-radius: var(--studio-control-radius); background: none; color: var(--studio-ink); font: inherit; text-align: start; cursor: pointer; }
.studio-ui :is(.studio-nav-item, .studio-list-item):hover { background: var(--studio-hover); }
.studio-ui :is(.studio-nav-item, .studio-list-item)[aria-current] { background: var(--studio-hover); font-weight: 500; }
.studio-ui .studio-scroller { min-width: 0; overflow-y: auto; container: studio-main / inline-size; }
.studio-ui .studio-content { max-width: 960px; margin: 0 auto; padding: 24px clamp(16px, 3vw, 40px) 48px; }
.studio-ui .studio-feature-stack { display: grid; gap: 24px; }
.studio-ui .studio-page-stack { display: grid; gap: var(--studio-gap); min-width: 0; }
.studio-ui .studio-page-stack > p, .studio-ui .studio-detail > p { margin: 0; }
.studio-ui .studio-page-head h2 { margin: 0 0 4px; }
.studio-ui .studio-page-head p { margin: 0; }
.studio-ui .studio-page-head + * { margin-top: 0; }
.studio-ui section > .studio-page-head { margin-bottom: var(--studio-gap); }
.studio-ui .studio-page-head-actions { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--studio-gap); }
.studio-ui .studio-status-line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0 0; }
.studio-ui .studio-note { margin: 0; padding: 6px 12px; border-radius: var(--studio-control-radius); background: var(--studio-hover); color: var(--studio-muted); font-size: 12px; }
.studio-ui .studio-section-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.studio-ui .studio-section-head :is(h3, h4, p) { margin: 0; }
.studio-ui .studio-section-head p { margin-top: 2px; }
.studio-ui .studio-section-head-field { align-items: flex-end; }
.studio-ui .studio-section-head-field > label { margin: 0; }
.studio-ui .studio-panel-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; }
.studio-ui h3.studio-section-title { margin: 0; font-size: 18px; }
.studio-ui .studio-block-section { display: grid; gap: 8px; }
.studio-ui .studio-block-section > :is(h3, p) { margin: 0; }

/* Buttons follow the DSH outline and primary variants. */
.studio-ui .studio-button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 32px; padding: 0 12px; margin: 2px 4px 2px 0; border: .5px solid var(--studio-control-line); border-radius: var(--studio-control-radius); background: transparent; color: var(--studio-ink); font: inherit; font-weight: 500; line-height: 20px; white-space: nowrap; cursor: pointer; }
.studio-ui .studio-button:hover:not(:disabled) { background: var(--studio-hover); }
.studio-ui .studio-button:active:not(:disabled) { background: var(--studio-pressed); }
.studio-ui .studio-button.studio-primary { border-color: transparent; background: var(--studio-primary-fill); color: var(--studio-on-primary); }
.studio-ui .studio-button.studio-primary:hover:not(:disabled) { background: var(--studio-primary-hover); }
.studio-ui .studio-button.studio-small { height: 28px; padding: 0 10px; font-size: 12px; line-height: 18px; border-radius: var(--studio-small-radius); }
.studio-ui [role=switch][aria-checked=true] { border-color: var(--studio-ink); }
.studio-ui .studio-inline-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.studio-ui .studio-inline-actions .studio-button, .studio-ui.studio-modal-footer .studio-button { margin: 0; }
.studio-ui.studio-modal-footer { display: flex; justify-content: flex-end; gap: 8px; }
.studio-ui :is(button, input, textarea, select):focus-visible { outline: 2px solid var(--studio-focus, var(--studio-accent)); outline-offset: 2px; }
.studio-ui :is(button, input, textarea, select):disabled { cursor: not-allowed; opacity: .4; }

/* Tabs follow the Plugins page: tertiary labels with a primary underline. */
.studio-ui .studio-tabs { position: sticky; top: 0; z-index: 2; display: flex; align-items: flex-end; gap: 22px; margin: 0; padding-top: 8px; border-bottom: .5px solid var(--studio-line); background: var(--studio-bg); overflow-x: auto; scrollbar-width: none; }
.studio-ui .studio-tab { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 7px 1px 9px; border: 0; background: transparent; color: var(--studio-subtle); font: inherit; line-height: 20px; white-space: nowrap; cursor: pointer; }
.studio-ui .studio-tab:hover, .studio-ui .studio-tab[aria-selected=true] { color: var(--studio-ink); }
.studio-ui .studio-tab[aria-selected=true]::after { position: absolute; right: 0; bottom: 0; left: 0; height: 2px; border-radius: 2px 2px 0 0; background: var(--studio-ink); content: ''; }
.studio-ui .studio-view-switch { max-width: 320px; }
.studio-ui .studio-tab-panel { min-height: calc(100vh - 48px); }

/* Forms. Field rules skip checkbox labels and inputs so host primitives such as Checkbox keep their own layout. */
.studio-ui fieldset { min-width: 0; margin: 16px 0; padding: 16px; border: .5px solid var(--studio-line); border-radius: var(--studio-radius); }
.studio-ui legend { padding: 0 8px; font-size: 14px; line-height: 1.5; }
.studio-ui .studio-role-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: var(--studio-gap); }
.studio-ui label:not(:has(> input[type=checkbox])) { display: grid; gap: 6px; margin: 12px 0; }
.studio-ui label:not([class]):has(> input[type=checkbox]) { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
/* A preset field label wraps its control inline; the fieldset ancestor outranks the grid label rule above. */
.studio-ui fieldset label.studio-inline-label { display: block; }
.studio-ui input:not([type=checkbox]), .studio-ui textarea, .studio-ui select { width: 100%; min-width: 0; padding: 6px 10px; border: .5px solid var(--studio-control-line); border-radius: var(--studio-control-radius); background: var(--studio-bg); color: var(--studio-ink); font: inherit; }
.studio-ui input:not([type=checkbox]), .studio-ui select { min-height: 32px; }
.studio-ui textarea { min-height: 144px; resize: vertical; }
.studio-ui .studio-field { display: grid; gap: 6px; margin: 12px 0; }
.studio-ui .studio-field-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 0 var(--studio-gap); }

/* Existing Studio surfaces. */
.studio-ui .studio-card, .studio-ui article { padding: 20px; border: .5px solid var(--studio-line); border-radius: var(--studio-radius); background: var(--studio-surface); min-width: 0; }
.studio-ui article + article { margin-top: var(--studio-gap); }
.studio-ui .studio-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--studio-gap); }
.studio-ui .studio-actions, .studio-ui nav { display: flex; flex-wrap: wrap; gap: 8px; margin-top: var(--studio-gap); }
.studio-ui dl { display: grid; grid-template-columns: minmax(80px, 1fr) minmax(0, 3fr); gap: 8px 16px; margin: 16px 0; }
.studio-ui dd { margin: 0; min-width: 0; }
.studio-ui [role=alert] { margin: 0; padding: 8px 12px; border-inline-start: 2px solid var(--studio-error); color: var(--studio-error); }
.studio-ui [role=status] { color: var(--studio-muted); }
.studio-ui pre { max-width: 100%; overflow: auto; padding: 12px; border-radius: 8px; background: var(--studio-inset); font-size: 12px; line-height: 1.6; }
.studio-ui .studio-history-content { white-space: pre-wrap; overflow-wrap: anywhere; }
.studio-ui ol, .studio-ui ul { padding-inline-start: 20px; }
.studio-ui li { margin-bottom: 8px; }
.studio-ui .studio-agents { padding: 20px; }
.studio-ui .studio-timer { padding: 20px; border-radius: var(--studio-radius); background: var(--studio-inset); }
.studio-ui .studio-timer strong { font-size: 28px; line-height: 1.4; font-variant-numeric: tabular-nums; }
.studio-ui .studio-timer span { font-size: 13px; line-height: 1.6; }

/* Design mock: cards, lists, and tables. */
.studio-ui .studio-inline-state { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.studio-ui .studio-notice-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.studio-ui .studio-cards { display: grid; gap: 8px; }
.studio-ui .studio-component { min-width: 0; border: .5px solid var(--studio-line); border-radius: var(--studio-radius); background: var(--studio-surface); }
.studio-ui .studio-component-flat { padding: 4px 16px 16px; }
.studio-ui .studio-component-head { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 12px 16px; border: 0; border-radius: var(--studio-radius); background: none; color: var(--studio-ink); font: inherit; text-align: start; cursor: pointer; }
.studio-ui .studio-component-head[aria-expanded=true] { border-radius: var(--studio-radius) var(--studio-radius) 0 0; }
.studio-ui .studio-component-head:hover { background: var(--studio-hover); }
.studio-ui .studio-component-title { flex: 0 0 auto; font-size: 14px; font-weight: 500; }
.studio-ui .studio-component-summary { flex: 1 1 auto; min-width: 0; overflow: hidden; color: var(--studio-muted); text-overflow: ellipsis; white-space: nowrap; }
.studio-ui .studio-chevron { flex: 0 0 auto; color: var(--studio-muted); }
.studio-ui .studio-chevron[data-open=true] { transform: rotate(180deg); }
.studio-ui .studio-component-body { padding: 4px 16px 16px; border-top: .5px solid var(--studio-line); }
.studio-ui .studio-reason { margin: 12px 0; padding: 8px 12px; border-radius: var(--studio-control-radius); background: var(--studio-hover); color: var(--studio-muted); }
.studio-ui .studio-reason-warning { border-inline-start: 2px solid var(--studio-subtle); color: var(--studio-ink); }
.studio-ui .studio-effect { margin-top: 16px; padding-top: 12px; border-top: .5px solid var(--studio-line); }
.studio-ui .studio-effect span { color: var(--studio-muted); font-size: 12px; }
.studio-ui .studio-effect p { margin: 4px 0 0; }
.studio-ui .studio-card-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.studio-ui .studio-card-actions .studio-button { margin: 0; }
.studio-ui .studio-card-actions:empty { display: none; }
.studio-ui .studio-blocks { margin: 0 0 8px; padding: 0; list-style: none; }
.studio-ui .studio-block { margin: 0; padding: 12px 0; border-bottom: .5px solid var(--studio-line); }
.studio-ui .studio-block-head { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; }
.studio-ui .studio-block-name { flex: 1 1 200px; margin: 0; }
.studio-ui .studio-block textarea { min-height: 72px; }
.studio-ui .studio-tool-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 8px var(--studio-gap); }
.studio-ui .studio-tool-groups fieldset { display: grid; align-content: start; gap: 8px; margin: 8px 0 0; padding: 8px 12px 12px; }
.studio-ui .studio-tool-groups legend { color: var(--studio-muted); font-size: 13px; }
.studio-ui .studio-targets { display: grid; gap: 8px; margin: 12px 0; }
.studio-ui .studio-target { padding: 8px 12px; border: .5px solid var(--studio-line); border-radius: var(--studio-control-radius); }
.studio-ui .studio-target-body { padding-inline-start: 26px; }
.studio-ui .studio-target .studio-field { margin: 8px 0; }
.studio-ui .studio-tile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 8px; }
.studio-ui .studio-tile { display: grid; gap: 2px; padding: 12px 14px; border: .5px solid var(--studio-line); border-radius: var(--studio-radius); background: var(--studio-surface); color: var(--studio-ink); font: inherit; text-align: start; cursor: pointer; }
.studio-ui .studio-tile:hover { background: var(--studio-hover); }
.studio-ui .studio-tile-title { display: flex; align-items: center; gap: 6px; font-weight: 500; }
.studio-ui .studio-plain-list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.studio-ui .studio-plain-list > li { margin: 0; }
.studio-ui .studio-list-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: .5px solid var(--studio-line); }
.studio-ui .studio-system-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
.studio-ui .studio-system-grid > li { margin: 0; }
.studio-ui .studio-system { display: grid; gap: 4px; padding: 16px; }
.studio-ui .studio-system > p { margin: 0; }
.studio-ui .studio-facts { grid-template-columns: minmax(96px, 140px) minmax(0, 1fr); gap: 6px 12px; margin: 8px 0 0; }
.studio-ui .studio-master-detail { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; align-items: start; }
.studio-ui nav.studio-list { position: sticky; top: 0; display: flex; flex-direction: column; flex-wrap: nowrap; gap: 2px; margin: 0; }
.studio-ui .studio-list-group:first-child { padding-top: 0; }
.studio-ui .studio-list-text { display: grid; min-width: 0; }
.studio-ui .studio-list-text .studio-muted { font-size: 12px; font-weight: 400; }
.studio-ui .studio-detail { display: grid; gap: 12px; min-width: 0; }
.studio-ui .studio-detail > label { margin: 0; }
.studio-ui .studio-matrix-scroll { overflow-x: auto; }
.studio-ui .studio-matrix { width: 100%; border-collapse: collapse; }
.studio-ui .studio-matrix :is(th, td) { padding: 6px; border-bottom: .5px solid var(--studio-line); font-weight: 500; text-align: start; vertical-align: middle; }
.studio-ui .studio-matrix thead th { color: var(--studio-muted); font-size: 12px; }
.studio-ui .studio-matrix-cell { display: grid; align-content: center; width: 100%; min-height: 44px; padding: 6px 10px; border: 0; border-radius: var(--studio-control-radius); background: none; color: var(--studio-ink); font: inherit; text-align: start; cursor: pointer; }
.studio-ui .studio-matrix-cell:hover { background: var(--studio-hover); }
.studio-ui .studio-matrix-cell .studio-muted { font-size: 12px; }
.studio-ui .studio-checklist { margin: 0 0 12px; padding: 0; list-style: none; }
.studio-ui .studio-checklist li { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.studio-ui .studio-simulate { margin: 16px 0 0; padding-top: 12px; border-top: .5px dashed var(--studio-line); }
.studio-ui .studio-pick-list { display: grid; gap: 6px; margin: 0 0 12px; padding: 0; list-style: none; }
.studio-ui .studio-pick-list > li { margin: 0; }
.studio-ui .studio-pick { display: grid; gap: 2px; width: 100%; padding: 10px 12px; border: .5px solid var(--studio-control-line); border-radius: var(--studio-control-radius); background: transparent; color: var(--studio-ink); font: inherit; text-align: start; cursor: pointer; }
.studio-ui .studio-pick:hover { background: var(--studio-hover); }
.studio-ui .studio-pick[aria-checked=true] { border-color: var(--studio-ink); background: var(--studio-hover); }
.studio-ui .studio-pick-title { display: flex; align-items: center; gap: 6px; }

/* Width rules follow the Studio surface and its content column, which the host sidebar and the Studio navigation narrow. */
@container studio-shell (max-width: 760px) {
  .studio-ui .studio-page { overflow-y: auto; }
  .studio-ui .studio-layout { grid-template-columns: 1fr; height: auto; }
  .studio-ui nav.studio-nav { flex-direction: row; overflow-x: auto; padding: 8px 12px; border-inline-end: 0; border-bottom: .5px solid var(--studio-line); }
  .studio-ui .studio-nav-title, .studio-ui .studio-nav-group { display: none; }
  .studio-ui .studio-nav-item { flex: 0 0 auto; }
  .studio-ui .studio-scroller { overflow: visible; }
}
@container studio-main (max-width: 640px) {
  .studio-ui .studio-master-detail { grid-template-columns: 1fr; }
  .studio-ui nav.studio-list { position: static; flex-direction: row; flex-wrap: wrap; }
  .studio-ui .studio-list-group { display: none; }
  .studio-ui .studio-component-summary { display: none; }
  .studio-ui .studio-facts { grid-template-columns: 1fr; gap: 4px; }
}
@media (max-width: 480px) {
  .studio-ui .studio-card, .studio-ui article, .studio-ui .studio-agents { padding: 12px; }
  .studio-ui dl { grid-template-columns: 1fr; gap: 4px; }
  .studio-ui dd { margin-bottom: 8px; }
}
`;
