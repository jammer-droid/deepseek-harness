# Changelog

## 0.1.0 — 2026-10-21

Requires DSH `0.2.0-rc.2`, `0.2.1-alpha.2`, `0.2.1-rc.1` or `0.2.1-rc.2`.

- First release. Registers the fetch provider `exa-contents`, which reads pages through the Exa Contents API (`POST /contents`) as extracted text. Select it with `fetchProvider: exa-contents` on the web service; DSH Studio 0.6.4 or later lists it under **Profile settings → Web search and fetch**.
- Uses `EXA_API_KEY` unless `apiKey` is set. Text is capped at `maxCharacters` (default 100,000) and reported as truncated when cut. A missing page resolves with its HTTP status; other crawl failures and Exa API errors fail with `WEB_PROVIDER_ERROR` without echoing the key. Requests to Exa refuse redirects.
