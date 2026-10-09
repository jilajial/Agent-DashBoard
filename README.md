# Agents HQ

**Agents HQ** is a self-hosted, LAN-first workspace for monitoring local AI agents and coordinating work between agents and people.

It uses a lightweight **Hub + Agent Node + Staff Portal** architecture:

```text
                        ┌────────────────────────┐
                        │       Agents HQ Hub    │
                        │  roster · meetings ·   │
                        │  approvals · audit log │
                        └───────────┬────────────┘
                                    │ LAN pairing and signed requests
              ┌─────────────────────┼──────────────────────┐
              │                     │                      │
     ┌────────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐
     │   Agent Node    │   │   Agent Node    │   │  Staff Portal   │
     │ local dashboard │   │ local dashboard │   │ human workspace │
     │ local AI bridge │   │ local AI bridge │   │ messaging only  │
     └─────────────────┘   └─────────────────┘   └─────────────────┘
```

The project is designed to run inside a private network. It does not require a cloud database, and it never stores or displays model API keys in the dashboard.

## What it provides

### Agents HQ Hub

Run one Hub on a trusted controller computer to provide:

- A live roster of approved agents and staff members.
- First-time device approval and permanent device removal.
- Topic meetings (`# general`) and one-to-one conversations.
- Agent status, capability summaries, event history, and task dispatch.
- A local-browser administrator password gate for approvals, removal, task dispatch, and Hub messages.
- LAN discovery on UDP `35100` and Hub traffic on TCP `3000`.

### Agent Node

Install the same Agent Node package on any computer that hosts an AI agent.

- Runs an independent local dashboard at `http://127.0.0.1:3100`.
- Detects supported local capabilities such as OpenClaw, Hermes, Ollama, NVIDIA tooling, and Node.js.
- Keeps working as a local status page even when the Hub is unavailable.
- Automatically discovers the Hub or can use a fixed Hub URL.
- Uses a per-device RSA identity for approved reconnection.
- Supports local agent chat through configured OpenClaw, Ollama, or command adapters.

### Staff Portal

The Staff Portal is a human collaboration client, not an agent runtime.

- Runs locally at `http://127.0.0.1:3200`.
- Requires a manual **Check in** action before it asks to join the Hub.
- Requires Hub approval on first registration.
- Lets a staff member set their own display name; the name is synchronized to the Hub roster.
- Shows online agents and online staff, supports `# general`, and supports direct conversations with any online participant.
- Uses **Check out** to remove the staff member from the active roster while leaving the device available for Hub administrators to remove permanently.
- Has no shell execution, task dispatch, local agent adapter, or credential-management capability.

### Online website chat and work queue

The optional `online/` package connects a public website chat widget to one private Hub without exposing the Hub to the internet.

- A resizable, lower-right text-chat widget can be embedded in any website.
- The reference Node.js service stores one private JSON document per visitor conversation and exposes only authenticated APIs; JSON files are never public URLs.
- The browser warns after 10 minutes of visitor inactivity and closes the conversation after 30 more seconds unless the visitor selects **Continue**. The server independently completes sessions inactive for one hour.
- Completed online records remain on the website until an administrator deletes them from the Hub.
- The Hub synchronizes the queue, lets administrators reply, assign or transfer work to an online Agent/Staff member or role, and mark conversations complete.
- Hub administrators can associate roles with participants and select an on-duty participant. Conversation archives can later be summarized into an approved local knowledge base.

See [`online/README.md`](online/README.md) for the deployable Node.js reference service and the widget snippet.

## Requirements

- **Node.js 22.13 or later**
- Git is required only for in-place updates.
- Windows 10/11 or a modern Linux distribution.
- All participating devices must be able to reach the Hub on the same private LAN.

The runtime has no npm package dependencies.

## Quick start

### Windows: Hub, Agent Node, or Staff Portal

1. Clone or download this repository.
2. Double-click `START-DASHBOARD.bat` in the project root.
3. Select one of the launcher options:

   | Option | Starts | Local page |
   | --- | --- | --- |
   | `1` | Agents HQ Hub | `http://127.0.0.1:3000` |
   | `2` | This computer's Agent Node | `http://127.0.0.1:3100` |
   | `3` | This computer's Staff Portal | `http://127.0.0.1:3200` |
   | `8` | Check/download a GitHub update, then start a component | — |

On first use, the launcher creates the relevant `*.local.json` configuration file. When Windows Firewall asks about Node.js for a Hub, allow it on **Private networks only**.

### Linux: Agent Node or Staff Portal

```bash
cd /path/to/Agent-DashBoard
chmod +x start-dashboard.sh scripts/*.sh
./start-dashboard.sh
```

Choose **2** for an Agent Node or **3** for a Staff Portal. The launcher opens the local page when a desktop browser is available.

## Initial configuration

### Hub

Start the Hub on a trusted controller computer. On the first local browser visit, create the Hub administrator password. Only a salted password hash is stored locally.

The Hub must be accessed locally at `http://127.0.0.1:3000` for administration. Remote devices communicate through the signed device protocol; they do not receive Hub administrator access.

### Agent Node

Edit `packages/node/config/node.local.json` after its first start:

```json
{
  "nodeId": "unique-agent-node-id",
  "agentName": "Operations Agent",
  "role": "Local AI Agent",
  "hubUrl": ""
}
```

- `nodeId` must be unique across the network.
- `agentName` and `role` are displayed in the Hub roster.
- Leave `hubUrl` blank to use LAN discovery, or set it to a fixed address such as `http://192.168.1.50:3000`.
- `commandPaths` can be used when a local CLI lives outside the normal `PATH`. This affects capability detection only.

### Staff Portal

Edit `packages/staff/config/staff.local.json` after its first start:

```json
{
  "nodeId": "unique-staff-device-id",
  "agentName": "Staff Member",
  "role": "Staff",
  "hubUrl": ""
}
```

Use a unique `nodeId` for each staff device. A user can change their display name later from the Portal header.

## Pairing and participation lifecycle

1. Start the Hub.
2. Start an Agent Node or Staff Portal on a computer in the same LAN.
3. For an Agent Node, the first pairing request is sent automatically. For a Staff Portal, the user clicks **Check in** to send it.
4. An administrator reviews the pending request on the Hub and approves or rejects it.
5. The device stores its private identity locally; the Hub stores its public key and fingerprint.
6. Future restarts reconnect automatically while the device identity remains valid.
7. A Hub administrator can remove a device at any time. A removed or reinstalled device must request approval again.

Staff members can check out without deleting their approved device. This makes them offline immediately while keeping removal under Hub administrator control.

## Messaging and tasks

### Meetings and direct conversations

- **`# general`** is the shared topic channel for approved participants.
- Select a participant to open a direct conversation.
- Agent Nodes can forward supported incoming messages to their configured local agent adapter and return replies to the conversation.
- Staff Portals are messaging-only clients; they do not execute agent tasks or commands.

### Task dispatch

The Hub can register and dispatch tasks to online Agent Nodes. Tasks are intended for ordinary operational work such as status checks, reports, drafts, and meeting follow-ups. High-impact actions should remain behind the relevant local operational approval process.

## Updating

Use launcher option **8** to check for updates and start a component after updating.

- In a Git clone, the launcher performs a fast-forward update.
- In a ZIP download, the launcher can enroll the folder as a Git working copy after confirmation.
- `*.local.json` files contain local configuration and are not replaced by normal updates.
- The Windows launcher checks for Node.js and Git. If a prerequisite is missing, it offers an explicit installation path through Windows Package Manager or the official download page.

For a clean manual update, download the latest repository ZIP into a new folder, copy only the required `*.local.json` files from the previous installation, then restart the relevant component.

## Linux service mode (optional)

For an always-on Agent Node, use `scripts/agent-node.service` as a user-level systemd template:

1. Replace `REPLACE_WITH_PROJECT_PATH` with the absolute project path.
2. Install it under the intended user account with `systemctl --user`.
3. Enable user lingering if the dashboard must remain available without an interactive desktop login.

## Security model

- Keep the Hub on a private network. Do not expose TCP `3000` directly to the public internet.
- Use the Hub only from its own local browser for administrative actions.
- Device pairing uses locally generated RSA identities and signed requests.
- Hub approval is required before a device joins the roster or participates in conversations.
- API keys, passwords, session cookies, SSH private keys, and model-provider credentials must not be placed in repository files or dashboard forms.
- Capability reporting identifies whether a tool appears available; it does not reveal secret values.

## Repository layout

```text
packages/
  hub/       Hub server, meeting interface, and local admin gate
  node/      Generic Agent Node dashboard and local agent adapter bridge
  staff/     Human Staff Portal with messaging-only permissions
  shared/    Shared protocol definitions
online/      Website chat widget, JSON-backed Node.js reference service, and protocol notes
scripts/     Windows/Linux component launchers and systemd template
docs/        Architecture notes
```

## Scope and roadmap

Agents HQ focuses on private-network coordination and local observability. Visual avatars, voice input/output, richer permissions, organization accounts, and additional agent adapters can be added without changing the basic Hub/Node/Staff separation.

See [Architecture notes](docs/ARCHITECTURE.md) for the protocol and component overview.
