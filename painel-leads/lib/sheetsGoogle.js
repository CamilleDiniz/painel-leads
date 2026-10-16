// Leitura (somente leitura) da planilha "Leads Google - Patrícia Toledo
// Corretora" — leads que chegam pelos botões do site (Google).
// Usa a MESMA conta de serviço da planilha do Meta (lib/sheets.js); basta
// compartilhar esta planilha com o e-mail da conta de serviço como Leitor.
// Nada aqui grava ou altera a planilha — só lê.

import { createHash } from "node:crypto";
import { google } from "googleapis";
import { getAuth } from "./sheets.js";

const DEFAULT_SHEET_ID = "1AATyI2Wf85RXSOYNhZfIMNag-u9w3NRxbV9enDgHpNk";

const SHEET_ID = process.env.GOOGLE_LEADS_SHEET_ID || DEFAULT_SHEET_ID;
const SHEET_RANGE = process.env.GOOGLE_LEADS_SHEET_RANGE || "Leads!A:H";

// Cabeçalhos reais da planilha (linha 1), já normalizados.
const HEADER_MAP = {
  "data e hora": "dataHora",
  nome: "nome",
  telefone: "telefone",
  origem: "origem",
  imóvel: "imovel",
  imovel: "imovel",
  valor: "valor",
  condomínio: "condominio",
  condominio: "condominio",
  mensagem: "mensagem",
};

function normalizeHeaderKey(raw) {
  return String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * "25/03/2026, 14:02" (horário de Brasília) -> ISO "2026-03-25T14:02:00-03:00".
 * Se vier num formato inesperado, devolve o texto original.
 */
export function parseBRDateTime(raw) {
  const m = String(raw || "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return raw || "";
  const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
  const pad = (v) => String(v).padStart(2, "0");
  // Brasil não tem horário de verão desde 2019, então -03:00 fixo.
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}-03:00`;
}

/**
 * A planilha não tem coluna de ID, então geramos um ID estável a partir do
 * conteúdo da linha (data/hora + telefone + origem + imóvel). Assim o estado
 * do Kanban (coluna, FUP, resumo) continua preso ao lead certo mesmo se
 * linhas forem inseridas/reordenadas. O nome fica de fora de propósito:
 * corrigir a grafia do nome na planilha não "perde" o card.
 * Linhas 100% repetidas (clique duplo no botão do site) viram um único lead.
 */
export function googleLeadId(r) {
  const key = [
    r.dataHora,
    String(r.telefone || "").replace(/\D/g, ""),
    r.origem,
    r.imovel,
    r.valor,
    r.condominio,
  ]
    .map((v) => String(v || "").trim().toLowerCase())
    .join("|");
  return "g_" + createHash("sha1").update(key).digest("hex").slice(0, 16);
}

function isTestLead(nome) {
  return /^\s*teste\b/i.test(String(nome || ""));
}

/**
 * Busca todas as linhas da planilha do Google e devolve como array de
 * objetos com nomes de campo amigáveis + `id` gerado + `createdTime` em ISO.
 */
export async function fetchGoogleLeadsFromSheet() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const header = rows[0].map(normalizeHeaderKey);
  const seen = new Set();
  const out = [];

  for (const row of rows.slice(1)) {
    const r = {};
    header.forEach((key, idx) => {
      const friendly = HEADER_MAP[key] || key;
      r[friendly] = String(row[idx] ?? "").trim();
    });

    if (!r.nome && !r.telefone) continue; // linha vazia
    if (isTestLead(r.nome)) continue; // ex: "Teste Lovable"

    const id = googleLeadId(r);
    if (seen.has(id)) continue; // linha duplicada
    seen.add(id);

    out.push({ ...r, id, createdTime: parseBRDateTime(r.dataHora) });
  }

  return out;
}
