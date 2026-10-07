"use strict";

const crypto = require("node:crypto");
const dgram = require("node:dgram");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { now, safeText, PROTOCOL_VERSION } = require("../../shared/protocol");

const ROOT = path.resolve(__dirname, "..");
const PROJECT = path.resolve(ROOT, "../..");
const CONFIG_PATH = path.join(ROOT, "config", "hub.local.json");
const EXAMPLE_PATH = path.join(ROOT, "config", "hub.example.json");
const DATA_PATH = path.join(PROJECT, "data", "hub-state.json");
const PUBLIC = path.join(ROOT, "public");
const streams = new Set();

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive:true }); fs.writeFileSync(file, JSON.stringify(value, null, 2)); }
function defaults() { return { name:"Agents HQ", bindHost:"0.0.0.0", port:3000, lan:{ enabled:true, discoveryPort:35100, nodeTimeoutSeconds:45 } }; }
function ensureConfig() { if (!fs.existsSync(CONFIG_PATH)) fs.copyFileSync(EXAMPLE_PATH, CONFIG_PATH); const loaded=readJson(CONFIG_PATH,{}), base=defaults(); let changed=false; if (loaded.name === "Pitt Meeting Hub") { loaded.name="Agents HQ"; changed=true; } if (loaded.nodeTokens && loaded.bindHost === "127.0.0.1") { loaded.bindHost = "0.0.0.0"; loaded.lan = base.lan; delete loaded.nodeTokens; changed=true; console.log("Migrated legacy Hub configuration to approved LAN pairing."); } if(changed)writeJson(CONFIG_PATH,loaded); return { ...base, ...loaded, lan:{...base.lan,...(loaded.lan||{})} }; }
const config = ensureConfig();
const state = readJson(DATA_PATH, { nodes:{}, devices:{}, pending:{}, inbox:{}, messages:[], events:[], tasks:[] });
for (const key of ["nodes","devices","pending","inbox"]) state[key] ||= {};
for (const key of ["messages","events","tasks"]) state[key] ||= [];

function persist() { writeJson(DATA_PATH, state); }
function id(prefix) { return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`; }
function fingerprint(publicKey) { return crypto.createHash("sha256").update(publicKey).digest("hex"); }
function isLocal(req) { return ["127.0.0.1","::1","::ffff:127.0.0.1"].includes(req.socket.remoteAddress || ""); }
function nodeOnline(node) { return Boolean(node && Date.now()-Date.parse(node.lastSeen||0) < Number(config.lan.nodeTimeoutSeconds||45)*1000); }
function hubParticipant() { return {nodeId:"pitt",agentName:"Pitt",role:"Agents HQ coordinator",hostname:os.hostname(),status:"online",online:true,lastSeen:now(),protocol:PROTOCOL_VERSION,capabilities:{hub:{present:true,output:"Agents HQ running"}}}; }
function participants() { return [hubParticipant(), ...Object.values(state.nodes).map(node => ({...node,online:nodeOnline(node),status:nodeOnline(node)?node.status||"online":"offline"}))]; }
function broadcast(kind,payload) { const frame=`event: ${kind}\ndata: ${JSON.stringify(payload)}\n\n`; for (const res of streams) { try {res.write(frame);} catch {streams.delete(res);} } }
function event(type,message,data={}) { const value={id:id("e"),at:now(),type,message:safeText(message,500),data}; state.events.unshift(value); state.events=state.events.slice(0,500); persist(); broadcast("event",value); return value; }
function overview(includePending=false) { return {nodes:participants(),pending:includePending?Object.values(state.pending).map(pendingPublic):[],messages:state.messages.slice(-400),events:state.events.slice(0,100),tasks:state.tasks,at:now()}; }
function announceOverview() { broadcast("overview",overview()); }
function sendJson(res,code,value) { res.writeHead(code,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(value)); }
function parseBody(req) { return new Promise((resolve,reject)=>{let raw="";req.on("data",chunk=>{raw+=chunk;if(raw.length>1024*1024)reject(new Error("body too large"));});req.on("end",()=>{try{resolve({raw,body:raw?JSON.parse(raw):{}});}catch{reject(new Error("invalid json"));}});}); }
function serveStatic(res,urlPath) { const file=urlPath==="/"?"index.html":urlPath.replace(/^\//,"");const candidate=path.resolve(PUBLIC,file);if(!candidate.startsWith(PUBLIC)||!fs.existsSync(candidate)||fs.statSync(candidate).isDirectory())return false;const type={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript"}[path.extname(candidate)]||"application/octet-stream";res.writeHead(200,{"content-type":type,"cache-control":"no-store"});fs.createReadStream(candidate).pipe(res);return true; }
function signedNode(req,method,pathname,raw) { const nodeId=safeText(req.headers["x-pitt-node"]||"",80), timestamp=Number(req.headers["x-pitt-time"]), signature=String(req.headers["x-pitt-signature"]||""), device=state.devices[nodeId];if(!nodeId||!device||device.revoked||!timestamp||Math.abs(Date.now()-timestamp)>90000||!signature)return null;try { const payload=`${timestamp}\n${method}\n${pathname}\n${raw}`;return crypto.verify("sha256",Buffer.from(payload),device.publicKey,Buffer.from(signature,"base64"))?device:null;}catch{return null;} }
function inbox(nodeId,message) { (state.inbox[nodeId] ||= []).push(message);state.inbox[nodeId]=state.inbox[nodeId].slice(-500); }
function recipients(conversationId,exclude="") { if(conversationId.startsWith("private:")){const nodeId=conversationId.slice(8);return nodeId&&nodeId!==exclude?[nodeId]:[];}return Object.keys(state.devices).filter(nodeId=>!state.devices[nodeId].revoked&&nodeId!==exclude); }
function postMessage({from,text,conversationId="topic:general",origin="hub",requiresReply=false,exclude=""}) { const message={id:id("m"),at:now(),from:safeText(from,80),text:safeText(text,4000),conversationId:safeText(conversationId,120),origin,requiresReply:Boolean(requiresReply)};if(!message.text)throw new Error("message required");state.messages.push(message);state.messages=state.messages.slice(-800);for(const nodeId of recipients(message.conversationId,exclude))inbox(nodeId,message);persist();event("meeting-message",`${message.from} posted to ${message.conversationId}`,{conversationId:message.conversationId});broadcast("message",message);announceOverview();return message; }
function pendingPublic(item) { const {publicKey,...safe}=item;return safe; }
function requestPair(body) { const nodeId=safeText(body.nodeId,80).toLowerCase().replace(/[^a-z0-9_-]/g,""),publicKey=String(body.publicKey||"");if(!nodeId||!publicKey.includes("BEGIN PUBLIC KEY"))throw new Error("invalid pairing request");const fp=fingerprint(publicKey),existing=state.devices[nodeId],pending=state.pending[nodeId];if(existing&&!existing.revoked&&existing.fingerprint===fp)return {status:"approved",nodeId};if(pending&&pending.fingerprint===fp)return {status:"pending",nodeId};const request={nodeId,agentName:safeText(body.agentName||nodeId,80),role:safeText(body.role||"Local Agent",160),hostname:safeText(body.hostname||"",160),capabilities:body.capabilities||{},fingerprint:fp,publicKey,requestedAt:now()};state.pending[nodeId]=request;persist();event("pair-request",`${request.agentName} requests to join`,{nodeId,fingerprint:fp.slice(0,12)});announceOverview();return {status:"pending",nodeId}; }
function approvePair(nodeId) { const pending=state.pending[nodeId];if(!pending)throw new Error("pairing request not found");state.devices[nodeId]={...pending,approvedAt:now(),revoked:false};delete state.pending[nodeId];persist();event("pair-approved",`${pending.agentName} was approved`,{nodeId});announceOverview();return pendingPublic(state.devices[nodeId]); }
function setDiscovery() { if(!config.lan.enabled)return;const socket=dgram.createSocket("udp4");socket.on("message",(msg,peer)=>{if(msg.toString("utf8")!=="PITT_HUB_DISCOVER_V2")return;const adapters=Object.values(os.networkInterfaces()).flat();const host=config.advertisedHost||adapters.find(item=>item&&item.family==="IPv4"&&!item.internal)?.address||"127.0.0.1";socket.send(Buffer.from(JSON.stringify({kind:"PITT_HUB_HERE_V2",name:config.name,url:`http://${host}:${config.port||3000}`,protocol:PROTOCOL_VERSION})),peer.port,peer.address);});socket.on("error",error=>console.warn(`Discovery disabled: ${error.message}`));socket.bind(Number(config.lan.discoveryPort||35100),"0.0.0.0"); }

const server=http.createServer(async(req,res)=>{const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);try{
  if(req.method==="GET"&&url.pathname==="/api/health")return sendJson(res,200,{ok:true,name:config.name,protocol:PROTOCOL_VERSION,at:now(),lan:config.lan.enabled});
  if(req.method==="GET"&&url.pathname==="/api/overview")return sendJson(res,200,overview(isLocal(req)));
  if(req.method==="GET"&&url.pathname==="/api/stream"){res.writeHead(200,{"content-type":"text/event-stream","cache-control":"no-cache",connection:"keep-alive"});res.write("retry: 2000\n\n");streams.add(res);req.on("close",()=>streams.delete(res));return;}
  if(req.method==="POST"&&url.pathname==="/api/pair/request"){const {body}=await parseBody(req);return sendJson(res,202,requestPair(body));}
  if(req.method==="POST"&&url.pathname==="/api/pair/approve"){if(!isLocal(req))return sendJson(res,403,{error:"approval is local-only"});const {body}=await parseBody(req);return sendJson(res,200,approvePair(safeText(body.nodeId,80)));}
  if(req.method==="POST"&&url.pathname==="/api/pair/revoke"){if(!isLocal(req))return sendJson(res,403,{error:"revocation is local-only"});const {body}=await parseBody(req),device=state.devices[safeText(body.nodeId,80)];if(!device)throw new Error("device not found");device.revoked=true;persist();event("pair-revoked",`${device.agentName} authorization revoked`,{nodeId:device.nodeId});announceOverview();return sendJson(res,200,{ok:true});}
  if(req.method==="POST"&&url.pathname==="/api/nodes/heartbeat"){const {raw,body}=await parseBody(req),device=signedNode(req,"POST",url.pathname,raw);if(!device||body.nodeId!==device.nodeId)return sendJson(res,401,{error:"node authentication failed"});const old=state.nodes[device.nodeId]||{};state.nodes[device.nodeId]={...old,...body,nodeId:device.nodeId,agentName:device.agentName||body.agentName,lastSeen:now(),online:true,protocol:PROTOCOL_VERSION};persist();announceOverview();return sendJson(res,200,{ok:true,hubTime:now()});}
  if(req.method==="GET"&&url.pathname==="/api/node/inbox"){const device=signedNode(req,"GET",url.pathname,"");if(!device)return sendJson(res,401,{error:"node authentication failed"});const after=url.searchParams.get("after")||"";return sendJson(res,200,{items:(state.inbox[device.nodeId]||[]).filter(item=>item.id>after).slice(-80)});}
  if(req.method==="POST"&&url.pathname==="/api/node/messages"){const {raw,body}=await parseBody(req),device=signedNode(req,"POST",url.pathname,raw);if(!device)return sendJson(res,401,{error:"node authentication failed"});return sendJson(res,201,postMessage({from:device.agentName,text:body.text,conversationId:body.conversationId,origin:"node",requiresReply:false,exclude:device.nodeId}));}
  if(req.method==="POST"&&(url.pathname==="/api/messages"||url.pathname==="/api/meeting/messages")){if(!isLocal(req))return sendJson(res,403,{error:"Hub message posting is local-only"});const {body}=await parseBody(req);return sendJson(res,201,postMessage({from:body.from||"Jian",text:body.text,conversationId:body.conversationId||body.target||"topic:general",origin:"hub",requiresReply:true}));}
  if(req.method==="POST"&&url.pathname==="/api/tasks"){if(!isLocal(req))return sendJson(res,403,{error:"task creation is local-only"});const {body}=await parseBody(req),requestedOwner=safeText(body.owner,80),node=state.nodes[requestedOwner]||Object.values(state.nodes).find(item=>item.agentName===requestedOwner),task={id:id("t"),at:now(),title:safeText(body.title,200),owner:node?.agentName||requestedOwner,ownerId:node?.nodeId||requestedOwner,status:node?.online?"dispatched":"queued",risk:safeText(body.risk||"safe",30),createdBy:safeText(body.createdBy||"Pitt",80)};if(!task.title||!task.owner)throw new Error("title and owner required");state.tasks.unshift(task);persist();event("task-created",`Task assigned to ${task.owner}: ${task.title}`,{taskId:task.id});if(node?.nodeId&&node.nodeId!=="pitt")postMessage({from:task.createdBy,text:`[Task ${task.id}] ${task.title}`,conversationId:`private:${node.nodeId}`,origin:"hub",requiresReply:true});announceOverview();return sendJson(res,201,task);}
  if(req.method==="GET"&&serveStatic(res,url.pathname))return;sendJson(res,404,{error:"not found"});
}catch(error){sendJson(res,400,{error:error.message});}});
server.listen(config.port||3000,config.bindHost||"0.0.0.0",()=>{console.log(`${config.name||"Agents HQ"} listening on http://${config.bindHost||"0.0.0.0"}:${config.port||3000}`);setDiscovery();});
