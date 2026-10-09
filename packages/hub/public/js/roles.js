"use strict";
// Kept separate from the main dashboard script so role controls can evolve
// without coupling them to meeting-room rendering.
(() => {
  const $ = selector => document.querySelector(selector);
  let latest = null;
  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "request failed");
    return data;
  }
  function populate(data) {
    latest = data;
    const select = $("#roleMember");
    if (!select) return;
    const chosen = select.value;
    select.innerHTML = '<option value="">选择 Agent / Staff</option>' + (data.nodes || []).map(node => `<option value="${node.nodeId}">${node.agentName || node.nodeId}</option>`).join("");
    if ([...select.options].some(option => option.value === chosen)) select.value = chosen;
    const online = data.online || {};
    const active = select.value || online.onDuty || "";
    $("#roleValues").value = (online.roles || {})[active]?.join(", ") || "";
    $("#dutySave").textContent = online.onDuty ? `值班：${(data.nodes || []).find(node => node.nodeId === online.onDuty)?.agentName || online.onDuty}` : "设为值班";
  }
  $("#roleMember").onchange = () => populate(latest || { nodes: [], online: {} });
  $("#roleSave").onclick = async () => {
    const nodeId = $("#roleMember").value;
    if (!nodeId) return;
    const roles = $("#roleValues").value.split(",").map(value => value.trim()).filter(Boolean);
    await request("/api/online/roles", { method: "POST", body: JSON.stringify({ nodeId, roles }) });
    await refresh();
  };
  $("#dutySave").onclick = async () => {
    const nodeId = $("#roleMember").value;
    if (!nodeId) return;
    await request("/api/online/on-duty", { method: "POST", body: JSON.stringify({ nodeId }) });
    await refresh();
  };
  async function refresh() { try { populate(await request("/api/overview")); } catch {} }
  setInterval(refresh, 5000);
})();
