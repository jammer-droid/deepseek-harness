/** Scoped Studio stylesheet embedded in distributable Client JavaScript. */
export const studioStyles = `/* Only this adapter references host tokens. Studio never installs a global theme. */
.studio-ui {
  --studio-bg: var(--dsw-alias-bg-base);
  --studio-surface: var(--dsw-alias-bg-layer-1);
  --studio-inset: var(--dsw-alias-bg-layer-2);
  --studio-ink: var(--dsw-alias-label-primary);
  --studio-muted: var(--dsw-alias-label-secondary);
  --studio-line: var(--dsw-alias-border-l1);
  --studio-accent: var(--dsw-alias-brand-primary);
  --studio-error: var(--dsw-alias-state-error-primary);
  --studio-radius: 12px;
  --studio-gap: 16px;
  color: var(--studio-ink);
  font: inherit;
  font-size: 13px;
  line-height: 1.6;
  min-width: 0;
  overflow-wrap: anywhere;
}
.studio-ui *, .studio-ui *::before, .studio-ui *::after { box-sizing: border-box; }
.studio-ui h1, .studio-ui h2, .studio-ui h3, .studio-ui strong, .studio-ui legend { font-weight: 500; }
.studio-ui h1 { font-size: 28px; line-height: 1.3; margin: 8px 0 12px; }
.studio-ui h2 { font-size: 18px; line-height: 1.4; margin: 0 0 12px; }
.studio-ui h3 { font-size: 14px; line-height: 1.5; margin: 16px 0 8px; }
.studio-ui p { margin: 8px 0 16px; }
.studio-ui .studio-muted, .studio-ui dt { color: var(--studio-muted); }
.studio-ui .studio-page { background: var(--studio-bg); padding: clamp(16px, 4vw, 48px); min-height: 100%; }
.studio-ui.studio-shell { height: 100%; overflow: auto; }
.studio-ui .studio-content { max-width: 1000px; margin: auto; display: grid; gap: 24px; }
.studio-ui .studio-feature-stack { display: grid; gap: 24px; }
.studio-ui nav.studio-section-nav { margin-top: 0; padding-bottom: 12px; border-bottom: .5px solid var(--studio-line); }
.studio-ui .studio-section-nav [aria-pressed=true] { color: var(--studio-accent); border-color: var(--studio-accent); background: var(--studio-inset); }
.studio-ui h3.studio-section-title { margin: 0; font-size: 18px; }
.studio-ui .studio-status-label { padding: 4px 12px; border-radius: var(--studio-radius); background: var(--studio-inset); color: var(--studio-muted); }
.studio-ui .studio-preview-note { border-top: .5px solid var(--studio-line); padding-top: 16px; color: var(--studio-muted); }
.studio-ui .studio-eyebrow { color: var(--studio-accent); font-size: 12px; line-height: 1.5; letter-spacing: 1px; }
.studio-ui .studio-card, .studio-ui article { padding: 20px; border: .5px solid var(--studio-line); border-radius: var(--studio-radius); background: var(--studio-surface); min-width: 0; }
.studio-ui article + article { margin-top: var(--studio-gap); }
.studio-ui .studio-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--studio-gap); }
.studio-ui .studio-actions, .studio-ui nav { display: flex; flex-wrap: wrap; gap: 8px; margin-top: var(--studio-gap); }
.studio-ui .studio-button { font: inherit; font-weight: 500; line-height: 1.5; min-height: 34px; padding: 6px 12px; margin: 2px 4px 2px 0; border: .5px solid var(--studio-line); border-radius: 8px; background: var(--studio-surface); color: var(--studio-ink); cursor: pointer; }
.studio-ui .studio-button:hover:not(:disabled) { background: var(--studio-inset); }
.studio-ui .studio-primary, .studio-ui [role=switch][aria-checked=true] { color: var(--studio-accent); border-color: var(--studio-accent); }
.studio-ui :is(button, input, textarea):focus-visible { outline: 2px solid var(--studio-accent); outline-offset: 3px; }
.studio-ui :is(button, input, textarea):disabled { cursor: not-allowed; opacity: .6; }
.studio-ui fieldset { min-width: 0; margin: 16px 0; padding: 16px; border: .5px solid var(--studio-line); border-radius: var(--studio-radius); }
.studio-ui legend { padding: 0 8px; font-size: 14px; line-height: 1.5; }
.studio-ui .studio-role-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: var(--studio-gap); }
.studio-ui label { display: grid; gap: 6px; margin: 12px 0; }
.studio-ui input, .studio-ui textarea { width: 100%; min-width: 0; font: inherit; color: var(--studio-ink); background: var(--studio-bg); border: .5px solid var(--studio-line); border-radius: 8px; padding: 8px 10px; }
.studio-ui textarea { min-height: 144px; resize: vertical; }
.studio-ui dl { display: grid; grid-template-columns: minmax(80px, 1fr) minmax(0, 3fr); gap: 8px 16px; margin: 16px 0; }
.studio-ui dd { margin: 0; min-width: 0; }
.studio-ui [role=alert] { color: var(--studio-error); border-inline-start: 2px solid var(--studio-error); padding: 8px 12px; }
.studio-ui [role=status] { color: var(--studio-muted); }
.studio-ui pre { max-width: 100%; overflow: auto; padding: 12px; border-radius: 8px; background: var(--studio-inset); font-size: 12px; line-height: 1.6; }
.studio-ui .studio-history-content { white-space: pre-wrap; overflow-wrap: anywhere; }
.studio-ui ol, .studio-ui ul { padding-inline-start: 20px; }
.studio-ui li { margin-bottom: 8px; }
.studio-ui .studio-agents { padding: 20px; }
.studio-ui .studio-timer { padding: 20px; border-radius: var(--studio-radius); background: var(--studio-inset); }
.studio-ui .studio-timer strong { font-size: 28px; line-height: 1.4; font-variant-numeric: tabular-nums; }
.studio-ui .studio-timer span { font-size: 13px; line-height: 1.6; }
@media (max-width: 480px) {
  .studio-ui .studio-card, .studio-ui article, .studio-ui .studio-agents { padding: 12px; }
  .studio-ui dl { grid-template-columns: 1fr; gap: 4px; }
  .studio-ui dd { margin-bottom: 8px; }
}
`;
