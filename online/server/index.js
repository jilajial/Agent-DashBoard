"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG = path.join(ROOT, "config.local.json");
const EXAMPLE = path.join(ROOT, "config.example.json");
const STORE = path.join(ROOT, "data", "conversations");
const WIDGET = path.join(ROOT, "widget");
const text = (value, max = 4000) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const now = () => new Date().toISOString();
const read = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } };
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString("hex")}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2)); fs.renameSync(tmp, file); };
if (!fs.existsSync(CONFIG)) fs.copyFileSync(EXAMPLE, CONFIG);
const config = { bindHost: "127.0.0.1", port: 3400, allowedOrigins: [], serverIdleMinutes: 60, ...read(CONFIG, {}) };
fs.mkdirSync(STORE, { recursive: true });

function file(id) { return path.join(STORE, `${id}.json`); }
function conversation(id) { return /^[a-z0-9_-]{10,100}$/i.test(id) ? read(file(id), null) : null; }
function save(item) { write(file(item.id), item); }
function list() { return fs.readdirSync(STORE).filter(name => name.endsWith(".json")).map(name => read(path.join(STORE, name), null)).filter(Boolean); }
function same(a, b) { try { return crypto.timingSafeEqual(Buffer.from(String(a)), Buffer.from(String(b))); } catch { return false; } }
function hub(req) { return Boolean(config.hubToken) && same(req.headers["x-agents-hq-token"], config.hubToken); }
function visitor(req, item) { return same(req.headers["x-chat-session"], item.sessionKey); }
function cors(req, res) { const origin = String(req.headers.origin || ""); if (origin && (config.allowedOrigins.includes(origin) || config.allowedOrigins.includes("*"))) res.setHeader("access-control-allow-origin", origin); res.setHeader("vary", "origin"); res.setHeader("access-control-allow-headers", "content-type,x-chat-session,x-agents-hq-token"); res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS"); }
function json(res, code, value) { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(value)); }
function body(req) { return new Promise((resolve, reject) => { let raw = ""; req.on("data", chunk => { raw += chunk; if (raw.length > 1024 * 1024) reject(new Error("body too large")); }); req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("invalid JSON")); } }); }); }
function publicView(item) { const { sessionKey, ...safe } = item; return safe; }
function append(item, sender, content, actor = "") { const value = text(content); if (!value) throw new Error("message required"); item.messages.push({ id: crypto.randomUUID(), at: now(), sender, actor: text(actor, 100), text: value }); item.lastActivityAt = now(); if (item.status === "done") item.status = "active"; save(item); return item; }
function createConversation(origin) { const id = `web-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`; const item = { id, sessionKey: crypto.randomBytes(32).toString("base64url"), createdAt: now(), lastActivityAt: now(), status: "new", doneAt: null, doneReason: null, sourcePage: text(origin, 500), assignedTo: null, assignedRole: null, assignmentHistory: [], messages: [] }; save(item); return item; }
function idleSweep() { const cut = Date.now() - Number(config.serverIdleMinutes || 60) * 60000; for (const item of list()) if (item.status !== "done" && Date.parse(item.lastActivityAt || item.createdAt) < cut) { item.status = "done"; item.doneAt = now(); item.doneReason = "server-timeout"; save(item); } }
setInterval(idleSweep, 60_000).unref();

const server = http.createServer(async (req, res) => { cors(req, res); if (req.method === "OPTIONS") return res.writeHead(204).end(); const url = new URL(req.url, `http://${req.headers.host || "localhost"}`); const parts = url.pathname.split("/").filter(Boolean);
  try {
    if (req.method === "GET" && url.pathname === "/api/health") return json(res, 200, { ok: true, at: now() });
    if (req.method === "POST" && url.pathname === "/api/widget/conversations") { const b = await body(req); const item = createConversation(b.sourcePage || req.headers.referer || ""); return json(res, 201, { id: item.id, sessionKey: item.sessionKey, conversation: publicView(item) }); }
    if (parts[0] === "api" && parts[1] === "widget" && parts[2] === "conversations" && parts[3]) { const item = conversation(parts[3]); if (!item || !visitor(req, item)) return json(res, 401, { error: "invalid visitor session" });
      if (req.method === "GET") return json(res, 200, { conversation: publicView(item) });
      const b = await body(req);
      if (req.method === "POST" && parts[4] === "messages") return json(res, 201, { conversation: publicView(append(item, "visitor", b.text)) });
      if (req.method === "POST" && parts[4] === "activity") { item.lastActivityAt = now(); save(item); return json(res, 200, { ok: true }); }
      if (req.method === "POST" && parts[4] === "done") { item.status = "done"; item.doneAt = now(); item.doneReason = text(b.reason || "client-inactive", 80); save(item); return json(res, 200, { conversation: publicView(item) }); }
    }
    if (parts[0] === "api" && parts[1] === "hub") { if (!hub(req)) return json(res, 401, { error: "Hub authentication failed" });
      if (req.method === "GET" && url.pathname === "/api/hub/conversations") return json(res, 200, { items: list().sort((a,b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)).map(publicView), at: now() });
      const item = conversation(parts[3]); if (!item) return json(res, 404, { error: "conversation not found" }); const b = await body(req);
      if (req.method === "POST" && parts[4] === "messages") return json(res, 201, { conversation: publicView(append(item, "team", b.text, b.actor || "Hub")) });
      if (req.method === "POST" && parts[4] === "assign") { item.assignedTo = text(b.assignedTo, 100) || null; item.assignedRole = text(b.assignedRole, 100) || null; item.status = b.status === "done" ? "done" : "active"; item.assignmentHistory.push({ at: now(), assignedTo: item.assignedTo, assignedRole: item.assignedRole, by: text(b.by || "Hub", 100) }); save(item); return json(res, 200, { conversation: publicView(item) }); }
      if (req.method === "POST" && parts[4] === "done") { item.status = "done"; item.doneAt = now(); item.doneReason = text(b.reason || "team-closed", 80); save(item); return json(res, 200, { conversation: publicView(item) }); }
      if (req.method === "DELETE" && parts.length === 4) { fs.unlinkSync(file(item.id)); return json(res, 200, { ok: true }); }
    }
    if (req.method === "GET" && url.pathname.startsWith("/widget/")) { const candidate = path.resolve(WIDGET, path.basename(url.pathname)); if (!candidate.startsWith(WIDGET) || !fs.existsSync(candidate)) return json(res, 404, { error: "not found" }); res.writeHead(200, { "content-type": candidate.endsWith(".css") ? "text/css" : "application/javascript", "cache-control": "public,max-age=300" }); return fs.createReadStream(candidate).pipe(res); }
    json(res, 404, { error: "not found" });
  } catch (error) { json(res, 400, { error: error.message }); }
});
server.listen(config.port, config.bindHost, () => console.log(`Agents HQ online chat listening on http://${config.bindHost}:${config.port}`));
