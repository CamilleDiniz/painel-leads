// Guarda o "estado do Kanban" (coluna atual, tentativas FUP, resumo da
// conversa, motivo de perda/acompanhamento) num banco à parte — Upstash
// Redis — em vez de escrever de volta na planilha. A planilha continua
// sendo só a fonte dos leads; tudo que você faz no painel fica aqui.

import { Redis } from "@upstash/redis";

let redis = null;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return redis;
}

const KEY_PREFIX = "lead:";

const DEFAULT_STATE = {
  status: "novo", // novo | visita | followup | acompanhamento | perdido
  fup: 0, // 0 a 5
  summary: "",
  lostReason: "",
  acompanhamentoReason: "",
  updatedAt: null,
};

export async function getCardState(leadId) {
  const raw = await getRedis().get(`${KEY_PREFIX}${leadId}`);
  return raw ? { ...DEFAULT_STATE, ...raw } : { ...DEFAULT_STATE };
}

export async function getAllCardStates(leadIds) {
  if (leadIds.length === 0) return {};
  const keys = leadIds.map((id) => `${KEY_PREFIX}${id}`);
  const results = await getRedis().mget(...keys);
  const map = {};
  leadIds.forEach((id, idx) => {
    map[id] = results[idx]
      ? { ...DEFAULT_STATE, ...results[idx] }
      : { ...DEFAULT_STATE };
  });
  return map;
}

export async function setCardState(leadId, partialState) {
  const current = await getCardState(leadId);
  const next = {
    ...current,
    ...partialState,
    updatedAt: new Date().toISOString(),
  };
  await getRedis().set(`${KEY_PREFIX}${leadId}`, next);
  return next;
}
