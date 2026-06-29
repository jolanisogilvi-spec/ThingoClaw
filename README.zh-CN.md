# ThingoClaw

ThingoClaw 是一个基于 OpenClaw 二次开发的跨平台 AI Agent 桌面应用，使用 Electron、React、Vite 和 TypeScript 构建。它把 OpenClaw 的智能体、模型供应商、技能、定时任务、渠道和诊断能力整合到一个桌面客户端中，尽量减少命令行配置成本。

> 说明：ThingoClaw 深度集成 OpenClaw runtime，并在桌面端补充图形界面、系统集成、打包分发和运行时管理能力。部分内部工程标识会保持稳定，用于兼容配置、升级和 OpenClaw 运行时逻辑。

## 核心功能

- 图形化首次设置向导：配置语言、模型供应商、API Key 或 OAuth 登录。
- 多模型供应商管理：支持 OpenAI、Anthropic、Moonshot、Ollama、自定义 OpenAI-compatible 网关等。
- 智能体聊天界面：支持 Markdown、表格、数学公式、技能插入、`@agent` 路由和多会话管理。
- 技能系统：支持本地技能、预置技能、工作区技能和扩展提供的技能源。
- 定时任务：通过 Cron 页面创建周期任务或一次性任务，可配置外部渠道投递。
- 渠道管理：支持多个消息渠道和多账号绑定，包括企业微信、飞书、钉钉、QQ、Discord、WhatsApp、微信等插件能力。
- OpenClaw Gateway 管理：桌面端自动启动、监控、重启 Gateway，并通过主进程统一代理通信。
- 系统集成：托盘、开机启动、主题切换、自动更新提示、系统密钥链安全存储。
- 开发者工具：提供 OpenClaw Doctor、诊断信息、代理设置、图像生成端点配置等高级能力。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 桌面运行时 | Electron 40 |
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite + electron-builder |
| 样式系统 | Tailwind CSS + shadcn/ui 风格组件 |
| 状态管理 | Zustand |
| 国际化 | react-i18next |
| 单元测试 | Vitest |
| 端到端测试 | Playwright Electron |
| Agent 运行时 | OpenClaw |

## 项目结构

```text
ThingoClaw/
+-- electron/                 Electron 主进程、预加载脚本、Gateway 管理和系统 API
|   +-- main/                  应用入口、窗口、菜单、托盘、IPC 注册
|   +-- gateway/               OpenClaw Gateway 生命周期管理
|   +-- services/              设置、供应商、技能、诊断等 Host API 服务
|   +-- preload/               Renderer 与 Main 的安全桥接
|   +-- utils/                 路径、存储、认证、遥测等工具
+-- src/                      React Renderer 前端
|   +-- components/            通用 UI 组件
|   +-- pages/                 Setup、Chat、Cron、Skills、Channels、Settings 等页面
|   +-- stores/                Zustand 状态
|   +-- lib/                   host-api、api-client、错误模型等前端统一入口
|   +-- assets/                前端静态资源
+-- shared/i18n/locales/      多语言文案资源
+-- resources/                图标、二进制资源、打包资源
+-- scripts/                  下载、构建、打包、图标生成和修补脚本
+-- tests/                    单元测试和 Electron E2E 测试
+-- harness/                  规格驱动测试和通信回归验证
+-- build/                    构建中间产物
+-- dist/                     Vite Renderer 构建输出
+-- dist-electron/            Electron Main/Preload 构建输出
+-- release/                  electron-builder 安装包输出
```

## 运行流程

```text
用户启动 ThingoClaw
    ↓
Electron Main 初始化应用名、窗口、托盘、菜单、配置和系统集成
    ↓
Main 启动或连接 OpenClaw Gateway，并维护 Gateway 生命周期
    ↓
React Renderer 加载页面，通过 host-api/api-client 发起请求
    ↓
Renderer 请求进入 Electron IPC
    ↓
Main 统一处理设置、文件、技能、供应商、会话、Gateway 代理等操作
    ↓
OpenClaw Runtime 执行 Agent、技能、渠道投递和模型调用
```

重要边界：

- Renderer 不直接请求 Gateway HTTP 地址。
- Renderer 不直接新增 `window.electron.ipcRenderer.invoke(...)` 调用。
- 前端统一通过 `src/lib/host-api.ts` 和 `src/lib/api-client.ts` 访问后端能力。
- Gateway 通信策略由 Main 负责，避免 CORS、端口和环境差异问题。

## 环境要求

- Windows 10/11、macOS 11+ 或主流 Linux 发行版。
- Node.js 22.19+。
- pnpm 使用 `package.json` 中 `packageManager` 固定的版本，当前为 `pnpm@10.33.4`。
- Git，用于拉取预置 skills。
- Windows 打包时需要网络访问，用于下载 Electron、Node、uv、agent-browser、NSIS 等构建资源。

建议先启用 Corepack：

```powershell
corepack enable
corepack prepare pnpm@10.33.4 --activate
```

## 安装依赖

```powershell
corepack pnpm@10.33.4 install
```

或使用项目初始化脚本：

```powershell
corepack pnpm@10.33.4 run init
```

如果遇到 `@whiskeysockets/baileys` 的 exotic dependency 限制，项目已在 `.npmrc` 和 `pnpm-workspace.yaml` 中关闭 `blockExoticSubdeps`，正常重新安装即可。

## 下载安装包

Windows 用户可以从 GitHub Releases 下载最新安装包：

[下载 ThingoClaw 最新版](https://github.com/jolanisogilvi-spec/ThingoClaw/releases/latest)

当前 Windows 安装包文件名格式为：

```text
ThingoClaw-<version>-win-x64.exe
```

下载后双击 `.exe` 文件，根据安装向导完成安装即可。

## 本地开发

```powershell
corepack pnpm@10.33.4 dev
```

开发模式会启动 Vite 和 Electron。OpenClaw Gateway 默认监听 `127.0.0.1:18789`，首次启动可能需要 10 到 30 秒。Gateway 未就绪时界面仍可导航，只会显示连接状态。

## 常用命令

| 任务 | 命令 |
| --- | --- |
| 安装依赖并下载基础资源 | `corepack pnpm@10.33.4 run init` |
| 启动开发环境 | `corepack pnpm@10.33.4 dev` |
| 生成扩展桥接文件 | `corepack pnpm@10.33.4 run ext:bridge` |
| 前端和 Electron 构建 | `corepack pnpm@10.33.4 run build:vite` |
| 类型检查 | `corepack pnpm@10.33.4 run typecheck` |
| 单元测试 | `corepack pnpm@10.33.4 test` |
| E2E 测试 | `corepack pnpm@10.33.4 run test:e2e` |
| 当前平台预打包资源 | `corepack pnpm@10.33.4 package` |
| Windows 安装包 | `corepack pnpm@10.33.4 package:win` |
| macOS 安装包 | `corepack pnpm@10.33.4 package:mac` |
| Linux 安装包 | `corepack pnpm@10.33.4 package:linux` |

## Windows 打包

在 Windows PowerShell 中运行：

```powershell
corepack pnpm@10.33.4 package:win
```

该命令会执行：

1. 下载 Windows 版 `uv`、`agent-browser`、内置 `node.exe`。
2. 生成扩展桥接文件。
3. 构建 React Renderer 和 Electron Main/Preload。
4. 打包 OpenClaw runtime。
5. 打包 OpenClaw 插件镜像。
6. 拉取并打包预置 skills。
7. 修补 NSIS 安装脚本。
8. 使用 electron-builder 生成 Windows 安装包。

成功后主要产物位于：

```text
release/ThingoClaw-0.4.12-win-x64.exe
release/win-unpacked/ThingoClaw.exe
```

当前已验证生成的安装包：

```text
release/ThingoClaw-0.4.12-win-x64.exe
```

## 打包问题排查

### 1. `blockExoticSubdeps` 导致安装依赖失败

错误示例：

```text
ERR_PNPM_EXOTIC_SUBDEP Exotic dependency "libsignal" ... not allowed
```

处理方式：项目已配置：

```ini
block-exotic-subdeps=false
```

以及：

```yaml
blockExoticSubdeps: false
```

重新执行：

```powershell
corepack pnpm@10.33.4 install
```

### 2. Windows 没有 `bsdtar`

早期脚本在打包预置 skills 时会调用 `bsdtar`，Windows 环境可能不存在该命令。当前脚本已改为使用 Node `tar` 包解压，不再依赖系统 `bsdtar`。

可单独验证：

```powershell
corepack pnpm@10.33.4 exec zx scripts/bundle-preinstalled-skills.mjs
```

### 3. Gateway 端口被占用

OpenClaw Gateway 默认监听 `127.0.0.1:18789`。Windows 可用以下命令查看：

```powershell
Get-NetTCPConnection -LocalPort 18789 -State Listen
```

### 4. Electron 多进程属于正常现象

一个 Electron 应用会出现多个系统进程，包括 main、renderer、utility、zygote 等。这不是重复启动。完整退出请使用托盘菜单中的 Quit ThingoClaw。

## 配置与数据

- 应用配置：使用 `electron-store` 和系统用户目录。
- 密钥：使用操作系统原生安全存储或密钥链。
- OpenClaw 配置：默认使用本地 OpenClaw 配置目录。
- 会话历史：读取 OpenClaw session transcript `.jsonl` 文件。
- 技能目录：默认托管在 OpenClaw skills 目录，也支持 workspace 和额外 skill dirs。

## 项目定位

ThingoClaw 面向需要图形化使用 OpenClaw 的桌面场景，重点提供：

- OpenClaw runtime 的桌面化封装。
- 模型供应商、技能、渠道、定时任务的统一 GUI。
- Windows、macOS、Linux 的桌面应用打包能力。
- 面向企业或本地部署场景的二次开发基础。
- 使用本地化 Thingo logo 资源作为应用图标和界面标识。

为保证二次开发后的稳定性和兼容性，以下内部工程标识保持不变：

- `package.json.name: "clawx"`
- `appId: app.clawx.desktop`
- `.clawx` 数据目录
- `CLAWX_*` 环境变量
- `clawx-openai-image` provider/plugin key
- `OPENCLAW_EMBEDDED_IN: 'ClawX'`
- OpenClaw workspace marker

## 开发规范

- 用户可见文案必须走 i18n，覆盖 `en`、`zh`、`ja`、`ru`。
- UI 变更应同步或新增 Electron E2E 测试。
- Renderer 侧后端访问必须通过 `host-api` / `api-client`。
- 通信链路变更需要运行：

```powershell
corepack pnpm@10.33.4 run comms:replay
corepack pnpm@10.33.4 run comms:compare
```

- 功能或架构变化后，应检查并同步 README 文档。

## 许可证

本项目基于 MIT License 发布。
