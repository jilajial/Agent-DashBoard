# Agents HQ Online Chat

This folder is a standalone, deployable reference implementation for website chat.
It deliberately uses a small Node.js service and one JSON file per conversation so it
can be understood and hosted without a database.  Browser clients never receive a
filesystem path: all access goes through the HTTP API.

## Run

```bash
cp config.example.json config.local.json
# set hubToken to a long, random value and use the same value in Hub settings
node server/index.js
```

Serve `widget/chat.js` and `widget/chat.css` from the same host (the reference
server does this at `/widget/*`).  Embed the following before `</body>`:

```html
<link rel="stylesheet" href="https://chat.example.com/widget/chat.css">
<script>window.AgentsHQChat={apiBase:"https://chat.example.com"};</script>
<script src="https://chat.example.com/widget/chat.js" defer></script>
```

The Hub polls the protected `/api/hub/conversations` endpoint and writes replies
through `/api/hub/conversations/:id/messages`.  Configure the same `baseUrl` and
`hubToken` under `online` in `packages/hub/config/hub.local.json`.

## Storage and retention

`data/conversations/<id>.json` is private server data.  It contains a generated
visitor session key, messages, assignment history and lifecycle fields.  Conversations
are never deleted automatically.  Client inactivity shows a 30-second warning after
10 minutes; a server-side hourly sweep marks abandoned conversations done.  Completed
files can be removed only through the authenticated Hub cleanup action.
