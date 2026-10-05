"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { now, safeText, PROTOCOL_VERSION } = require("../../shared/protocol");

const ROOT = path.resolve(__dirname, "..");
const PROJECT = path.resolve(ROOT, "../../..");
const CONFIG_PATH = path.join(ROOT, "config", "hub.local.json");
const EXAMPLE_PATH = path.join(ROOT, "config", "hub.example.json");
const DATA_DIR = path.join(PROJECT, "data");
const DATA_PATH = path.join(DATA_DIR, "hub-state.json");
const PUBLIC = path.join(ROOT, "public");

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function ensureConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(EXAMPLE_PATH, CONFIG_PATH);
    console.log(`Created ${CONFIG_PATH}. Set unique node tokens before allowing remote nodes.`);
  }
  return readJson(CONFIG_PATH, readJson(EXAMPLE_PATH, {}));
}
const config = ensureConfig();
const state = readJson(DATA_PATH, { nodes: {}, events: [], meetings: [], tasks: [] });
const streams = new Set();
function persist() { writeJson(DATA_PATH, state); }
function event(type, message, data = {}) {
  const entry = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, at: now(), type, message: safeText(message, 500), data };
  state.events.unshift(entry); state.events = state.events.slice(0, 500); persist(); broadcast("event", entry); return entry;
}
function broadcast(kind, payload) {
  const frame = `event: ${kind}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of streams) { try { res.write(frame); } catch { streams.delete(res); } }
}
function sendJson(res, code, value) { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(value)); }
function parseBody(req) { return new Promise((resolve, reject) => { let raw = ""; req.on("data", c => { raw += c; if (raw.length > 1024 * 1024) reject(new Error("body too large")); }); req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("invalid json")); } }); }); }
function serveStatic(res, urlPath) {
  const file = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
  const candidate = path.resolve(PUBLIC, file);
  if (!candidate.startsWith(PUBLIC) || !fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) return false;
  const ext = path.extname(candidate); const type = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8" }[ext] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" }); fs.createReadStream(candidate).pipe(res); return true;
}
function nodeAllowed(req, nodeId) { return Boolean(nodeId && config.nodeTokens && config.nodeTokens[nodeId] && req.headers.authorization === `Bearer ${config.nodeTokens[nodeId]}`); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { ok:true, name:config.name, protocol:PROTOCOL_VERSION, at:now() });
    if (req.method === "GET" && url.pathname === "/api/overview") return sendJson(res, 200, { nodes:Object.values(state.nodes), events:state.events.slice(0,80), meetings:state.meetings, tasks:state.tasks, at:now() });
    if (req.method === "GET" && url.pathname === "/api/stream") {
      res.writeHead(200, { "content-type":"text/event-stream", "cache-control":"no-cache", connection:"keep-alive" }); res.write("retry: 3000\n\n"); streams.add(res); req.on("close", () => streams.delete(res)); return;
    }
    if (req.method === "POST" && url.pathname === "/api/nodes/heartbeat") {
      const body = await parseBody(req); if (!nodeAllowed(req, body.nodeId)) return sendJson(res, 401, { error:"node authentication failed" });
      const old = state.nodes[body.nodeId] || {}; const node = { ...old, ...body, nodeId:body.nodeId, lastSeen:now(), online:true, protocol:PROTOCOL_VERSION };
      delete node.hubToken; state.nodes[node.nodeId] = node; persist(); event("node-heartbeat", `${node.agentName || node.nodeId} reported status`, { nodeId:node.nodeId, status:node.status }); broadcast("overview", { nodes:Object.values(state.nodes) }); return sendJson(res, 200, { ok:true, hubTime:now() });
    }
    if (req.method === "POST" && url.pathname === "/api/meeting/messages") {
      const body = await parseBody(req); const message = { id:`m-${Date.now()}`, at:now(), from:safeText(body.from || "Jian",80), text:safeText(body.text,2000), target:safeText(body.target || "all",80) };
      if (!message.text) return sendJson(res, 400, { error:"message required" }); state.meetings.push(message); state.meetings = state.meetings.slice(-300); persist(); event("meeting-message", `${message.from} sent a meeting message`, { target:message.target }); broadcast("meeting", message); return sendJson(res, 201, message);
    }
    if (req.method === "POST" && url.pathname === "/api/tasks") {
      const body = await parseBody(req); const task = { id:`t-${Date.now()}`, at:now(), title:safeText(body.title,200), owner:safeText(body.owner,80), status:"queued", risk:safeText(body.risk || "safe",30), createdBy:safeText(body.createdBy || "Pitt",80) };
      if (!task.title || !task.owner) return sendJson(res, 400, { error:"title and owner required" }); state.tasks.unshift(task); persist(); event("task-created", `Task assigned to ${task.owner}: ${task.title}`, { taskId:task.id }); broadcast("overview", { tasks:state.tasks }); return sendJson(res, 201, task);
    }
    if (req.method === "GET" && serveStatic(res, url.pathname)) return;
    sendJson(res, 404, { error:"not found" });
  } catch (error) { sendJson(res, 400, { error:error.message }); }
});
server.listen(config.port || 3000, config.bindHost || "127.0.0.1", () => console.log(`${config.name || "Pitt Meeting Hub"} listening on http://${config.bindHost || "127.0.0.1"}:${config.port || 3000}`));
