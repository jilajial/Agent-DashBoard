# Pitt Meeting Hub architecture

```
Windows 10 controller
  Pitt Meeting Hub
     │  meeting, task and audit API
     │  authenticated heartbeat only
     ├──────── Jane Node / TechTalentsPC
     ├──────── Bowen Node / BOWLENGTH
     └──────── Helen Node / HQPROPERTY
```

## Trust boundary

- Nodes collect only local service and resource metadata. They never send API keys, raw provider configuration, or arbitrary file contents.
- Nodes initiate their own heartbeat to the Hub. The Hub does not expose a general shell API.
- A node accepts only an explicit action allowlist in later versions. High-risk actions always require the controller's confirmation.
- The Hub starts loopback-only by default. LAN use requires a unique token per node, a Windows firewall rule, and a deliberate `bindHost` change.

## Current MVP

- Hub: meeting messages, tasks, live event stream, registered node status.
- Node: detects Node.js, OpenClaw, Hermes, Ollama and NVIDIA locally; opens a local dashboard; optionally posts sanitized snapshots to Hub.
- Avatar, STT/TTS and direct agent-conversation adapters are next-stage plugins, isolated from monitoring.
