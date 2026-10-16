// Leitura (somente leitura) da planilha "Leads Google - Patrícia Toledo
// Corretora" — leads que chegam pelos botões do site (Google).
// Usa a MESMA conta de serviço da planilha do Meta (lib/sheets.js); basta
// compartilhar esta planilha com o e-mail da conta de serviço como Leitor.
// Nada aqui grava ou altera a planilha — só lê.

import { createHash } from "node:crypto";
import { google } from "googleapis";
import { getAuth } from "./sheets.js";
import { normalizePhone } from "./phone.js";

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
 * A planilha não tem coluna de ID, e a mesma pessoa costuma clicar várias
 * vezes nos botões do site. Por isso agrupamos por PESSOA: o ID do card é
 * gerado a partir do telefone normalizado (ex: "19 99887-7665" e
 * "+55 19 99887-7665" viram a mesma pessoa). Sem telefone, usa o nome.
 * Assim o estado do Kanban (coluna, FUP, resumo) fica preso à pessoa, mesmo
 * que ela entre em contato de novo ou linhas sejam reordenadas.
 */
export function googlePersonKey(r) {
  const phone = normalizePhone(r.telefone);
  if (phone.valid) return `tel:${phone.e164}`;
  const digits = String(r.telefone || "").replace(/\D/g, "");
  if (digits) return `tel:${digits}`;
  return `nome:${String(r.nome || "").trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export function googleLeadId(r) {
  return "g_" + createHash("sha1").update(googlePersonKey(r)).digest("hex").slice(0, 16);
}

function uniq(list) {
  const seen = new Set();
  return list.filter((v) => {
    const k = String(v || "").trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Nome mais completo entre os contatos (ex: "Valdecir" x "valdecir"),
// preferindo o que tem mais palavras/letras e com iniciais maiúsculas.
function bestName(names) {
  return (
    [...names]
      .filter(Boolean)
      .sort((a, b) => {
        const wa = a.split(/\s+/).length, wb = b.split(/\s+/).length;
        if (wb !== wa) return wb - wa;
        if (b.length !== a.length) return b.length - a.length;
        return (/^[A-ZÀ-Ý]/.test(b) ? 1 : 0) - (/^[A-ZÀ-Ý]/.test(a) ? 1 : 0);
      })[0] || ""
  );
}

/**
 * Junta as linhas da mesma pessoa num único lead.
 * - createdTime: contato MAIS RECENTE (quem voltou a chamar sobe no painel)
 * - firstContact: primeiro contato
 * - contacts: quantas vezes ela entrou em contato (linhas repetidas idênticas contam 1)
 * - entries: os contatos distintos (imóvel/origem/mensagem), do mais recente ao mais antigo
 */
export function groupGoogleRows(rows) {
  const groups = new Map();

  for (const r of rows) {
    const id = googleLeadId(r);
    if (!groups.has(id)) groups.set(id, { id, rows: [] });
    groups.get(id).rows.push(r);
  }

  const toTime = (v) => {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  };

  return [...groups.values()].map(({ id, rows: rs }) => {
    const sorted = [...rs].sort((a, b) => toTime(b.createdTime) - toTime(a.createdTime));

    // contatos distintos (mesma data/hora + mesmo conteúdo = clique duplo)
    const seenContact = new Set();
    const entries = sorted.filter((r) => {
      const k = [r.dataHora, r.origem, r.imovel, r.valor, r.condominio, r.mensagem]
        .map((v) => String(v || "").trim().toLowerCase())
        .join("|");
      if (seenContact.has(k)) return false;
      seenContact.add(k);
      return true;
    });

    return {
      id,
      nome: bestName(sorted.map((r) => r.nome)),
      telefone: sorted.find((r) => r.telefone)?.telefone || "",
      createdTime: sorted[0].createdTime,
      firstContact: sorted[sorted.length - 1].createdTime,
      contacts: entries.length,
      origens: uniq(entries.map((r) => r.origem)),
      entries,
    };
  });
}

function isTestLead(nome) {
  return /^\s*teste\b/i.test(String(nome || ""));
}

/**
 * Busca todas as linhas da planilha do Google e devolve UM lead por pessoa
 * (agrupado pelo telefone), com todos os contatos dela em `entries`.
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
  const out = [];

  for (const row of rows.slice(1)) {
    const r = {};
    header.forEach((key, idx) => {
      const friendly = HEADER_MAP[key] || key;
      r[friendly] = String(row[idx] ?? "").trim();
    });

    if (!r.nome && !r.telefone) continue; // linha vazia
    if (isTestLead(r.nome)) continue; // ex: "Teste Lovable"

    out.push({ ...r, createdTime: parseBRDateTime(r.dataHora) });
  }

  // um lead por pessoa (telefone)
  return groupGoogleRows(out);
}
