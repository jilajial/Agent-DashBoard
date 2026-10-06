"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { now, safeText, PROTOCOL_VERSION } = require("../../shared/protocol");
const exec = promisify(execFile);

const ROOT = path.resolve(__dirname, "..");
const CONFIG = path.join(ROOT, "config", "node.local.json");
const EXAMPLE = path.join(ROOT, "config", "node.example.json");
const PUBLIC = path.join(ROOT, "public");
function json(file, fallback) { try { return JSON.parse(fs.readFileSync(file,"utf8")); } catch { return fallback; } }
if (!fs.existsSync(CONFIG)) { fs.copyFileSync(EXAMPLE, CONFIG); console.log(`Created ${CONFIG}. Set nodeId, agentName, and Hub details before registration.`); }
const config = json(CONFIG, json(EXAMPLE, {}));
const events = [];
function log(type, message) { events.unshift({ at:now(), type, message:safeText(message,500) }); events.splice(120); }
async function probe(command, args = []) { try { const { stdout } = await exec(command, args, { timeout:6000 }); return { present:true, output:safeText(stdout,400) }; } catch (error) { return { present:false, output:safeText(error.code === "ENOENT" ? "not installed" : error.message,400) }; } }
function commandFor(capability, fallback) {
  const configured = config.commandPaths && config.commandPaths[capability];
  return typeof configured === "string" && configured.trim() ? configured.trim() : fallback;
}
async function collect() {
  const [nodeVersion, openclaw, hermes, ollama, nvidia] = await Promise.all([
    probe(process.execPath,["--version"]), probe(commandFor("openclaw","openclaw"),["--version"]), probe(commandFor("hermes","hermes"),["--version"]), probe(commandFor("ollama","ollama"),["list"]), probe(commandFor("nvidia","nvidia-smi"),["--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu","--format=csv,noheader,nounits"])
  ]);
  const mem = process.memoryUsage();
  return { nodeId:config.nodeId, agentName:config.agentName, role:config.role, hostname:require("node:os").hostname(), status:"online", at:now(), runtime:{ node:nodeVersion.output, uptimeSeconds:Math.round(process.uptime()), memoryMb:Math.round(mem.rss/1024/1024) }, capabilities:{ openclaw, hermes, ollama, nvidia }, events:events.slice(0,20) };
}
async function heartbeat(snapshot) {
  if (!config.hubUrl || !config.hubToken || !config.nodeId || config.nodeId.startsWith("replace-")) return;
  try { const target = new URL("/api/nodes/heartbeat", config.hubUrl); const payload = JSON.stringify(snapshot); const response = await fetch(target, { method:"POST", headers:{ "content-type":"application/json", authorization:`Bearer ${config.hubToken}` }, body:payload, signal:AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(`Hub returned ${response.status}`); log("hub","Heartbeat accepted by Pitt Meeting Hub"); } catch (error) { log("hub-error", `Hub heartbeat failed: ${safeText(error.message,180)}`); }
}
let latest = null;
async function refresh() { latest = await collect(); await heartbeat(latest); return latest; }
function send(res, code, data) { res.writeHead(code,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}); res.end(JSON.stringify(data)); }
function staticFile(res, urlPath) { const file = urlPath === "/" ? "index.html" : urlPath.replace(/^\//,""); const candidate = path.resolve(PUBLIC,file); if (!candidate.startsWith(PUBLIC)||!fs.existsSync(candidate)||fs.statSync(candidate).isDirectory()) return false; const type={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8"}[path.extname(candidate)]||"application/octet-stream"; res.writeHead(200,{"content-type":type,"cache-control":"no-store"}); fs.createReadStream(candidate).pipe(res); return true; }
http.createServer(async (req,res) => { const url = new URL(req.url,`http://${req.headers.host||"localhost"}`); if (req.method === "GET" && url.pathname === "/api/status") return send(res,200,{ ...(latest || await refresh()), protocol:PROTOCOL_VERSION }); if (req.method === "POST" && url.pathname === "/api/refresh") return send(res,200,await refresh()); if (req.method === "GET" && staticFile(res,url.pathname)) return; send(res,404,{error:"not found"}); }).listen(config.localPort || 3100,"127.0.0.1",() => { console.log(`Agent Node dashboard listening on http://127.0.0.1:${config.localPort||3100}`); refresh(); setInterval(refresh, Math.max(10,Number(config.pollSeconds)||20)*1000); });
