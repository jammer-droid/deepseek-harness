---
kind: upgrade-guide
description: "Studio workflow drafts gain stable instance identities and separate configuration diagnostics from saving."
---

# Studio workflow draft storage

English | [中文](guide.zh.md)

## Change

Studio workflow drafts use document version 2 with stable component instance IDs, system configurations, and port connections. Existing drafts remain readable without changing the storage domain version. Reading an old draft normalizes it in memory; its next explicit save writes the new document format. Older Studio builds do not support that format.

Saving now accepts structurally valid drafts with configuration errors, including missing systems and invalid field values. A saved draft is not necessarily valid, applied, or executable. Configuration validation reports these problems separately.

## Migration

Update the runtime and Studio packages together. This Studio version requires api-remotes' `remoteEventContributions` Host service for live catalog notifications; installing only the Studio package on an older runtime leaves its required service unavailable.

1. Back up the configured Studio workflow draft storage before using the newer build if you may need to return to an older build. Do not overwrite that backup after saving version 2 drafts.
2. Open existing drafts in Studio and check their names, component order, and retained settings. Missing or version-mismatched registrations remain visible and read-only; do not delete them to restore availability.
3. Save explicitly to persist the normalized document. Resolve configuration diagnostics separately. A configuration validation pass does not confirm model, permission, or execution support.
4. For a downgrade, restore the pre-upgrade backup rather than opening version 2 records with the older build. There is no automatic downgrade or component-version conversion.
