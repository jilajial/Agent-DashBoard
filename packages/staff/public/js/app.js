const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
let current="topic:general",latest={};
async function api(url,o){const r=await fetch(url,o),d=await r.json();if(!r.ok)throw new Error(d.error||"request failed");return d;}
function render(d){
  latest=d;const active=d.pairing==="approved",pending=d.pairing==="pending",people=(d.participants||[]).filter(p=>p.nodeId!==d.nodeId);
  $("#state").textContent=(d.pairing||"not registered").replace("-"," ").toUpperCase();
  $("#identity").textContent=d.agentName||"设置名称";
  $("#checkin").textContent=active?"退出":pending?"等待 Hub 批准":"报到";$("#checkin").disabled=pending;
  $("#note").textContent=d.lastError||(active?"已报到：可参与全员聊天，或选择任意在线成员私聊。":pending?"报到申请已发送，请等待 Hub 通过。":"点击“报到”后才会向 Hub 提交注册申请。");
  $("#people").innerHTML=people.map(p=>`<div class="person"><b>${esc(p.agentName||p.nodeId)}</b><br><small>${esc(p.role||"")} · ${esc(p.clientType==="staff"?"staff":"agent")}</small><br><button data-id="${esc(p.nodeId)}">私聊</button></div>`).join("")||(active?"<span class=\"muted\">暂时没有其他在线成员。</span>":"<span class=\"muted\">报到后显示在线成员。</span>");
  $("#conversation").innerHTML=`<option value="topic:general"># general · all online participants</option>`+people.map(p=>`<option value="private:${esc(p.nodeId)}">私聊 · ${esc(p.agentName||p.nodeId)}</option>`).join("");
  if(![...$("#conversation").options].some(o=>o.value===current))current="topic:general";$("#conversation").value=current;
  const messages=(d.messages||[]).filter(m=>m.conversationId===current);$("#messages").innerHTML=messages.map(m=>`<div class="message ${m.fromNodeId===d.nodeId?"mine":""}"><b>${esc(m.from)}</b><time>${esc(new Date(m.at).toLocaleTimeString())}</time><p>${esc(m.text)}</p></div>`).join("")||"暂无消息。";$("#messages").scrollTop=$("#messages").scrollHeight;
  $("#text").disabled=!active;$("#send").disabled=!active;$("#text").placeholder=active?"发送主题或私聊消息…":"先报到并等待 Hub 通过…";
}
async function load(refresh=false){try{render(await api(refresh?"/api/refresh":"/api/status",refresh?{method:"POST"}:undefined));}catch(e){$("#note").textContent=e.message;}}
$("#conversation").onchange=e=>{current=e.target.value;render(latest);};
$("#checkin").onclick=async()=>{try{const route=latest.pairing==="approved"?"/api/logout":"/api/register";render(await api(route,{method:"POST"}));}catch(e){$("#note").textContent=e.message;}};
$("#identity").onclick=async()=>{const name=prompt("设置显示名称：",latest.agentName||"");if(!name?.trim())return;try{render(await api("/api/profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({agentName:name})}));}catch(e){$("#note").textContent=e.message;}};
$("#form").onsubmit=async e=>{e.preventDefault();const input=$("#text"),text=input.value.trim();if(!text)return;input.value="";try{await api("/api/messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text,conversationId:current})});load(true);}catch(err){$("#note").textContent=err.message;}};
document.body.onclick=e=>{if(e.target.dataset.id){current=`private:${e.target.dataset.id}`;render(latest);}};load();setInterval(()=>load(true),10000);
