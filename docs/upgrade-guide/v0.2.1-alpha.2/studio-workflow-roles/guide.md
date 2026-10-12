---
kind: upgrade-guide
description: "Studio workflow drafts use version 3 role references and asynchronous model validation."
---

# Studio workflow roles

English | [中文](guide.zh.md)

## Change

Studio workflow drafts store `documentVersion: 3`, a `roles` array, and `mainRoleId` instead of the version 2 inline `mainRole`. Each role can hold an independent model selection. `studioWorkflows.validate()` returns a Promise and checks advertised DSH models and reasoning options. This affects users of the local Studio plugin and consumers of its generated Remote API, not existing General or fixed-role settings.

## Migration

1. Back up the Studio draft storage before upgrading. Reading legacy or version 2 drafts preserves their revision and data without rewriting storage. The existing main role receives a deterministic ID; no model is silently assigned.
2. Open a draft, explicitly choose its initial model, and inspect the role selections. The first choice is copied to existing roles and becomes the seed for new roles; subsequent role edits are independent.
3. Save explicitly to record version 3. Confirm the draft can be reopened with its role names, components, connections, and model selections intact. Invalid model selections remain savable and appear as diagnostics.
4. Update custom Remote consumers to send version 3 documents and await `validate()`. Rebuild their generated clients together with the Host. Do not run older Studio code against newly saved version 3 drafts; downgrade is unsupported. Restore the pre-upgrade backup if reverting.
