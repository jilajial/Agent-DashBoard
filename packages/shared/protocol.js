"use strict";

const PROTOCOL_VERSION = "2";
const SAFE_ACTIONS = ["status", "report", "draft", "meeting-message", "agent-chat"];
const CONFIRMED_ACTIONS = ["restart", "update", "model-change", "external-send", "delete"];

function now() {
  return new Date().toISOString();
}

function safeText(value, max = 2000) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

module.exports = { PROTOCOL_VERSION, SAFE_ACTIONS, CONFIRMED_ACTIONS, now, safeText };
