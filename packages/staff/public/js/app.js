const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
let current="topic:general",latest={};
async function api(url,o){const r=await fetch(url,o),d=await r.json();if(!r.ok)throw new Error(d.error||"request failed");return d;}
function render(d){
  latest=d;const approved=d.pairing==="approved",people=d.participants||[];
  $("#state").textContent=(d.pairing||"not discovered").toUpperCase();
  $("#note").textContent=d.lastError||(approved?"已获 Hub 批准；正在同步会议成员与消息。":"此门户仅提供 Hub 消息交流，不运行本地 Agent 或命令。");
  $("#people").innerHTML=people.map(p=>`<div class="person"><b>${esc(p.agentName||p.nodeId)}</b><br><small>${esc(p.role||"")} · ${p.online?"online":"offline"}</small><br><button data-id="${esc(p.nodeId)}">私聊</button></div>`).join("")||(approved?"已获批准，正在同步参与者…":"等待 Hub 批准…");
  $("#conversation").innerHTML=`<option value="topic:general"># general · all participants</option>`+people.map(p=>`<option value="private:${esc(p.nodeId)}">私聊 · ${esc(p.agentName||p.nodeId)}</option>`).join("");
  if(![...$("#conversation").options].some(o=>o.value===current))current="topic:general";$("#conversation").value=current;
  const messages=(d.messages||[]).filter(m=>m.conversationId===current);$("#messages").innerHTML=messages.map(m=>`<div class="message ${m.origin==="staff"?"mine":""}"><b>${esc(m.from)}</b><time>${esc(new Date(m.at).toLocaleTimeString())}</time><p>${esc(m.text)}</p></div>`).join("")||"暂无消息。";$("#messages").scrollTop=$("#messages").scrollHeight;
}
async function load(refresh=false){try{render(await api(refresh?"/api/refresh":"/api/status",refresh?{method:"POST"}:undefined));}catch(e){$("#note").textContent=e.message;}}
$("#conversation").onchange=e=>{current=e.target.value;render(latest);};$("#form").onsubmit=async e=>{e.preventDefault();const input=$("#text"),text=input.value.trim();if(!text)return;input.value="";try{await api("/api/messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text,conversationId:current})});load(true);}catch(err){$("#note").textContent=err.message;}};document.body.onclick=e=>{if(e.target.dataset.id){current=`private:${e.target.dataset.id}`;render(latest);}};load(true);setInterval(()=>load(true),10000);
