# Agents HQ / Agent Dashboard

一个可跨 Windows 与 Linux 部署的 **Hub + Node** 项目：

- **Agents HQ 总包**：运行在 Jian 的 Windows 10 主控电脑；自动批准节点、主持私聊/主题会议、任务与审计事件。Pitt 是其中的协调 Agent，不是系统名称。
- **Node 通用分包**：放入任何部署了 OpenClaw 或 Hermes 的电脑，自动检测本机能力、提供独立 Dashboard 与本机 Agent 对话。
- 初始节点：Jane（Hermes/Ollama）、Bowen（Gemini/OpenClaw）、Helen（DeepSeek/OpenClaw）。

## Requirements

Node.js **22.13+**. The project intentionally has no npm runtime dependencies.

## Start the Hub (Windows controller)

1. Download or clone this repository on Windows 10.
2. Double-click **`START-DASHBOARD.bat`** in the project root.
3. Choose **1 — Start Agents HQ**. The launcher checks Node.js, creates the initial config and opens the browser automatically.
4. The first start creates `packages/hub/config/hub.local.json`.

## Updates

From the root launcher choose **6 — Check / download GitHub update, then start**. It checks the `main` branch, shows whether updates exist, asks for confirmation, applies a fast-forward update, and then starts either Hub or Node.

- A Git clone updates directly.
- A ZIP download can be enrolled on the first update; the launcher clearly asks before replacing program files. `*.local.json` settings remain untouched.
- Git must be installed once. On Windows, the launcher opens the official Git for Windows download page if Git is missing.

Hub v2 uses approved LAN pairing: it listens for Node discovery on UDP `35100` and receives Node traffic on TCP `3000`. On first Windows start, allow Node.js through the **Private networks** Windows Firewall prompt. Do not allow it on Public networks.

## LAN pairing and meeting

1. Start the Hub on the Windows controller.
2. Start an Agent Node on any PC in the same LAN. It discovers the Hub and creates a pending request.
3. On the Hub page, review its name/host/fingerprint and click **批准加入** once.
4. The node stores an RSA private identity locally (`node.identity.json`, owner-only); the Hub stores only its public key/fingerprint. Later restarts authenticate automatically.
5. Choose a node card for private chat, or use `# general` for a topic message to all approved nodes.

The Hub's approve/revoke actions are accepted only from the Hub computer's local browser. Revoke a device from the Hub if a computer is retired or reinstalled.

## Start a Node (any agent PC)

1. Copy the repository (or the Node package release) to that computer.
2. Run `./start-dashboard.sh` on Linux or double-click `START-DASHBOARD.bat` on Windows.
3. Choose **2 — Start this computer's Agent Node dashboard**. The launcher opens the local Dashboard automatically.
4. The first start creates `packages/node/config/node.local.json`.

If a local service has a non-standard executable location, set it in `commandPaths` in that file. This only improves status detection and never reads credentials:

```json
"commandPaths": { "openclaw": "/home/agent/.openclaw/tmp/agent-cli/openclaw" }
```
5. Set a unique `nodeId` and human-friendly `agentName`. `hubUrl` is optional; leave it blank for LAN auto-discovery.

The node works locally even before a Hub is configured. Its **Local Agent Chat** tries the local OpenClaw adapter first; when unavailable it uses local Ollama if present. The optional `agentAdapter` section can choose `openclaw`, `ollama`, `command`, or `disabled`.

## Start a Staff Portal (any human worker PC)

Choose **3 — Start this computer's Staff Portal** from either launcher. On first use, edit `packages/staff/config/staff.local.json` to set a unique `nodeId` and staff display name.

The Staff Portal does not register automatically. Click **报到** in its upper-left corner to submit a signed request; the button changes to **等待 Hub 批准** until a Hub administrator approves it. Once approved, it becomes **退出**. Exiting immediately removes the staff member from the online roster while keeping the approved device visible to the Hub administrator, who can remove it permanently if needed.

Click the name button in the Portal's upper-right corner to update the local display name and the Hub roster. Checked-in staff can see all online agents and staff, participate in `# general`, and select any online participant for a direct conversation. The Staff package intentionally has no local Agent Chat, command adapter, shell execution, or task-dispatch API.

## Environment guide

The root launchers check prerequisites before starting. On Windows, a missing or outdated Node.js LTS installation is offered through Windows Package Manager (`winget`), with the official Node.js page as a fallback. Choosing the one-click update option similarly offers Git for Windows through `winget`, then falls back to its official download page. Every installation requires an explicit local confirmation; restart the launcher after an installer asks for it.

## Hub local password

On first Hub use, open the Hub from its own computer at `http://127.0.0.1:3000` and set a local password in the browser. The Hub stores only a salted scrypt hash in `hub.local.json`; pairing approvals, revocations, Hub messages, and task dispatch require that local authenticated browser session. The password is never requested through chat or sent to worker portals.

## Systemd (Linux Node, optional)

Copy `scripts/agent-node.service`, replace `REPLACE_WITH_PROJECT_PATH`, then install it as the intended non-root user with `systemctl --user`. Enable lingering if the node must run without an interactive login.

## Safety

- Never put API keys, passwords, SSH private keys, or provider configuration in this repository or in the dashboard forms.
- The Node package reports capability presence, not credential values.
- The initial Hub supports meeting messages and task registration. Direct agent chat, command execution, 3D avatars and local voice are deliberately separate next-stage adapters.

See [architecture](docs/ARCHITECTURE.md).
