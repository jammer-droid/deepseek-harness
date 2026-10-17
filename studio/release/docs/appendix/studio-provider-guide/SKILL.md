---
name: studio-provider-guide
description: Write, check, and install a DSH Studio SettingsX provider definition file so a model endpoint appears in DSH model selection, Pixie, and roles. Use when the user asks to add a provider, model server, or endpoint to DSH through Studio, or asks why a definition shows as invalid.
---

# DSH Studio provider definitions

A SettingsX provider is one JSON file. Studio reads every `*.json` in the definition folder, validates it, and registers valid files as DSH model routes. The folder path is shown on **DSH Studio → SettingsX → Providers**; it is `<profile>/studio-data/providers`. After adding or changing a file, the user presses **Reload** on that page.

## File format (version 1)

```json
{
  "version": 1,
  "id": "local-llm",
  "name": "Local LLM",
  "protocol": "openai-chat",
  "baseURL": "http://127.0.0.1:11434/v1",
  "headers": { "X-Team": "studio" },
  "models": [
    { "id": "qwen3:8b", "name": "Qwen3 8B", "contextWindow": 32768, "maxTokens": 4096 }
  ],
  "credential": { "kind": "none" }
}
```

| Field | Rule |
| --- | --- |
| `version` | Always `1`. |
| `id` | Route key in DSH. Lowercase letter first, then lowercase letters, digits, hyphens; at most 63 characters. Must not equal another provider's route (for example `deepseek`). |
| `name` | Display name. |
| `protocol` | `openai-chat` (POST `<baseURL>/chat/completions`) or `openai-responses` (POST `<baseURL>/responses`, sent with `store: false`). Both stream SSE. |
| `baseURL` | `http` or `https`, without user name, password, query, or fragment. A trailing `/` is removed. |
| `headers` | Optional extra request headers. `Authorization`, `User-Agent`, `Content-Type`, `Content-Length`, `Accept`, and `Host` cannot be set. Values are stored in the file in plain text, so never put secrets here. |
| `models` | At least one entry. Only listed models can be chosen in the DSH GUI. `contextWindow` and `maxTokens` are optional positive integers; `maxTokens` is the default output cap. |
| `credential` | `{ "kind": "none" }`. `credential` and `command` kinds are planned and are refused by this version. |

Unknown fields are rejected. Studio sends text only: image attachments are replaced by text handles before the request.

## Procedure

1. Ask which endpoint and protocol the server speaks, and which model IDs it serves. If the server lists models (for example `GET <baseURL>/models`), use those IDs.
2. Write the file with a name such as `<id>.json` in the definition folder.
3. Check it: valid JSON, every rule above. Tell the user to press **Reload** and confirm the row shows **Registered**. An **Invalid** row lists each problem with its field path; fix them all and reload.
4. Tell the user the models now appear under the provider name in DSH model selection, Pixie, and role model lists.

## Do not

- Do not write API keys, tokens, or cookies into a definition. This version supports keyless endpoints only.
- Do not imitate another product's client (forged user agents, session IDs, placeholder tools, or IP rotation) to get around a provider's access limits. Use only endpoints the user is allowed to call this way.
- The user is responsible for each provider's terms of use.
