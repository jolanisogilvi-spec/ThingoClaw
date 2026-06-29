# ThingoClaw

ThingoClaw is a cross-platform AI agent desktop application built as a secondary development project on top of OpenClaw. It uses Electron, React, Vite, and TypeScript to combine agent chat, provider configuration, skills, scheduled jobs, messaging channels, diagnostics, and packaging-friendly runtime management into one desktop client.

> Note: ThingoClaw deeply integrates the OpenClaw runtime and adds desktop GUI, system integration, packaging, and runtime-management capabilities. Some internal engineering identifiers remain stable for configuration, upgrade, and OpenClaw runtime compatibility.

## Features

- Guided first-run setup for language, providers, API keys, and OAuth-capable accounts.
- Multi-provider AI configuration for OpenAI, Anthropic, Moonshot, Ollama, and custom OpenAI-compatible gateways.
- Agent chat with Markdown, tables, math rendering, skill insertion, `@agent` routing, and multiple sessions.
- Local-first skill management with bundled skills, workspace skills, managed directories, and extension-provided sources.
- Cron automation for recurring and one-time tasks, including external channel delivery.
- Channel management with multi-account binding for supported OpenClaw plugins.
- Main-process-owned OpenClaw Gateway lifecycle management.
- System integration for tray, startup launch, theme preference, update prompts, and secure credential storage.
- Developer diagnostics including OpenClaw Doctor, proxy settings, and image-generation endpoint configuration.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Desktop runtime | Electron 40 |
| UI | React 19 + TypeScript |
| Build | Vite + electron-builder |
| Styling | Tailwind CSS |
| State | Zustand |
| i18n | react-i18next |
| Tests | Vitest + Playwright Electron |
| Agent runtime | OpenClaw |

## Project Layout

```text
ThingoClaw/
+-- electron/                 Electron main process, preload bridge, Gateway manager
|   +-- main/                  app entry, windows, tray, menu, IPC registration
|   +-- gateway/               OpenClaw Gateway lifecycle management
|   +-- services/              typed host services for settings/providers/skills/etc.
|   +-- preload/               secure renderer bridge
|   +-- utils/                 paths, storage, auth, telemetry utilities
+-- src/                      React renderer application
|   +-- components/            reusable UI components
|   +-- pages/                 Setup, Chat, Cron, Skills, Channels, Settings
|   +-- stores/                Zustand stores
|   +-- lib/                   host-api, api-client, frontend error model
|   +-- assets/                renderer assets
+-- shared/i18n/locales/      locale files
+-- resources/                icons, binaries, packaging resources
+-- scripts/                  build, download, packaging, patching scripts
+-- tests/                    unit and Electron E2E tests
+-- harness/                  spec-driven validation and communication checks
+-- build/                    intermediate build output
+-- dist/                     Vite renderer output
+-- dist-electron/            Electron main/preload output
+-- release/                  electron-builder output
```

## Runtime Flow

```text
User launches ThingoClaw
    ↓
Electron Main initializes app name, windows, tray, menu, settings, and system integration
    ↓
Main starts or reconnects to the OpenClaw Gateway
    ↓
React Renderer loads the GUI and calls host-api/api-client
    ↓
Requests cross the Electron IPC boundary
    ↓
Main handles settings, files, skills, providers, sessions, diagnostics, and Gateway proxying
    ↓
OpenClaw Runtime executes agents, skills, channels, and model calls
```

Renderer code should not call Gateway HTTP endpoints directly and should not add new direct `window.electron.ipcRenderer.invoke(...)` calls. Use `src/lib/host-api.ts` and `src/lib/api-client.ts` as the frontend entry points.

## Requirements

- Windows 10/11, macOS 11+, or a mainstream Linux distribution.
- Node.js 22.19+.
- pnpm pinned by `packageManager`, currently `pnpm@10.33.4`.
- Git for fetching preinstalled skills during packaging.
- Network access for downloading Electron, Node, uv, agent-browser, NSIS, and skill bundles.

Enable Corepack first:

```bash
corepack enable
corepack prepare pnpm@10.33.4 --activate
```

## Install

```bash
corepack pnpm@10.33.4 install
```

Or run the project initializer:

```bash
corepack pnpm@10.33.4 run init
```

## Download

Windows users can download the latest installer from GitHub Releases:

[Download the latest ThingoClaw release](https://github.com/jolanisogilvi-spec/ThingoClaw/releases/latest)

The Windows installer file name follows this pattern:

```text
ThingoClaw-<version>-win-x64.exe
```

Download the `.exe` file and run the installer.

## Development

```bash
corepack pnpm@10.33.4 dev
```

The OpenClaw Gateway listens on `127.0.0.1:18789` by default. Gateway readiness can take 10 to 30 seconds on first startup. The UI remains navigable while the Gateway is connecting.

## Commands

| Task | Command |
| --- | --- |
| Install deps and bundled basics | `corepack pnpm@10.33.4 run init` |
| Start development app | `corepack pnpm@10.33.4 dev` |
| Generate extension bridge | `corepack pnpm@10.33.4 run ext:bridge` |
| Build renderer and Electron bundles | `corepack pnpm@10.33.4 run build:vite` |
| Type check | `corepack pnpm@10.33.4 run typecheck` |
| Unit tests | `corepack pnpm@10.33.4 test` |
| E2E tests | `corepack pnpm@10.33.4 run test:e2e` |
| Prepare current-platform package assets | `corepack pnpm@10.33.4 package` |
| Windows installer | `corepack pnpm@10.33.4 package:win` |
| macOS package | `corepack pnpm@10.33.4 package:mac` |
| Linux package | `corepack pnpm@10.33.4 package:linux` |

## Windows Packaging

Run this from PowerShell:

```powershell
corepack pnpm@10.33.4 package:win
```

The Windows packaging flow:

1. Downloads bundled Windows binaries for `uv`, `agent-browser`, and `node.exe`.
2. Generates the extension bridge.
3. Builds the React renderer and Electron main/preload bundles.
4. Bundles OpenClaw.
5. Bundles OpenClaw plugin mirrors.
6. Fetches and bundles preinstalled skills.
7. Patches NSIS installer templates.
8. Runs electron-builder for Windows.

Primary outputs:

```text
release/ThingoClaw-0.4.12-win-x64.exe
release/win-unpacked/ThingoClaw.exe
```

## Troubleshooting

### Exotic subdependency install errors

If pnpm fails with an exotic subdependency error from Baileys/libsignal, this project already sets:

```ini
block-exotic-subdeps=false
```

and:

```yaml
blockExoticSubdeps: false
```

Re-run:

```bash
corepack pnpm@10.33.4 install
```

### Missing `bsdtar` on Windows

The preinstalled-skill bundler now uses the Node `tar` package and no longer depends on system `bsdtar`.

You can validate that step directly:

```bash
corepack pnpm@10.33.4 exec zx scripts/bundle-preinstalled-skills.mjs
```

### Gateway port conflicts

The Gateway default listener is `127.0.0.1:18789`.

Windows:

```powershell
Get-NetTCPConnection -LocalPort 18789 -State Listen
```

macOS/Linux:

```bash
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

### Electron process count

One Electron app instance normally appears as multiple OS processes. Use the tray menu item `Quit ThingoClaw` for a complete shutdown.

## Project Positioning

ThingoClaw is intended for desktop scenarios that need a graphical OpenClaw experience. It focuses on:

- Desktop packaging around the OpenClaw runtime.
- A unified GUI for providers, skills, channels, scheduled jobs, and diagnostics.
- Windows, macOS, and Linux application distribution.
- A secondary-development base for local or enterprise OpenClaw deployments.
- Local Thingo logo resources for application icons and interface identity.

The following internal engineering identifiers remain stable for compatibility:

- `package.json.name: "clawx"`
- `appId: app.clawx.desktop`
- `.clawx` data directory
- `CLAWX_*` environment variables
- `clawx-openai-image` provider/plugin key
- `OPENCLAW_EMBEDDED_IN: 'ClawX'`
- OpenClaw workspace marker

## Development Rules

- Route user-facing text through i18n with `en`, `zh`, `ja`, and `ru` coverage.
- Renderer backend access must go through `host-api` / `api-client`.
- UI changes should include or update Electron E2E coverage.
- Communication-path changes should run:

```bash
corepack pnpm@10.33.4 run comms:replay
corepack pnpm@10.33.4 run comms:compare
```

## License

MIT License.
