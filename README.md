# Pitt Meeting Hub / Agent Dashboard

一个可跨 Windows 与 Linux 部署的 **Hub + Node** 项目：

- **Hub 总包**：运行在 Jian 的 Windows 10 主控电脑；查看会议、任务、节点状态与审计事件。
- **Node 通用分包**：放入任何部署了 OpenClaw 或 Hermes 的电脑，自动检测本机能力并提供独立 Dashboard。
- 初始节点：Jane（Hermes/Ollama）、Bowen（Gemini/OpenClaw）、Helen（DeepSeek/OpenClaw）。

## Requirements

Node.js **22.13+**. The project intentionally has no npm runtime dependencies.

## Start the Hub (Windows controller)

1. Download or clone this repository on Windows 10.
2. Run `scripts\start-hub.bat`.
3. The first start creates `packages/hub/config/hub.local.json`.
4. Open `http://127.0.0.1:3000`.

The Hub is loopback-only by default. Do not change `bindHost` to `0.0.0.0` until unique node tokens and a firewall rule are configured.

## Start a Node (any agent PC)

1. Copy the repository (or the Node package release) to that computer.
2. Run `scripts/start-node.sh` on Linux or `scripts\start-node.bat` on Windows.
3. The first start creates `packages/node/config/node.local.json`.
4. Set a unique `nodeId`, human-friendly `agentName`, optional Hub URL and that node's unique Hub token.
5. Open the local dashboard at `http://127.0.0.1:3100`.

The node works locally even before a Hub is configured.

## Systemd (Linux Node, optional)

Copy `scripts/agent-node.service`, replace `REPLACE_WITH_PROJECT_PATH`, then install it as the intended non-root user with `systemctl --user`. Enable lingering if the node must run without an interactive login.

## Safety

- Never put API keys, passwords, SSH private keys, or provider configuration in this repository or in the dashboard forms.
- The Node package reports capability presence, not credential values.
- The initial Hub supports meeting messages and task registration. Direct agent chat, command execution, 3D avatars and local voice are deliberately separate next-stage adapters.

See [architecture](docs/ARCHITECTURE.md).
