# DSH Studio

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin for building agent presets in the web GUI: choose tools, edit prompts and tool descriptions, override plugin Configs, define role-based subagents, preview the assembled system prompt, and apply the result as a DSH agent preset.

## Install

Requires DSH `0.2.0-rc.2` or `0.2.1-alpha.2`.

```sh
dsh plugin --profile web add @matamt-dbg/dsh-studio
```

Restart the web GUI, then open **DSH Studio** from the sidebar.

## Features

- **Presets** — a read-only Master listing every installed tool, a built-in *Optimized* preset, and your own presets. Edit, copy, delete, apply to DSH, or unapply.
- **Prompts & tools** — persona and additional instructions, per-tool description and parameter text, built-in tool sets, and a live prompt preview.
- **Execution settings** — override plugin Config values for one preset only.
- **Subagents** — DSH's generic subagent tools are replaced by one `subagent_role` tool. Define roles with their own model, reasoning effort, fresh or fork start, and persona. With no roles, `subagent_role` starts a child that inherits the parent's settings.

Presets are stored per profile in `studio-data/`. Applying a preset registers a Studio-owned DSH agent preset; it never edits other presets or the profile's packages.

## Development

```sh
pnpm install
pnpm test        # typecheck, build, tests
node pack.mjs    # writes dist/matamt-dbg-dsh-studio-<version>.tgz
```

Please report bugs and requests in [Issues](https://github.com/matamt-dbg/dsh-studio/issues).

## License

MIT
