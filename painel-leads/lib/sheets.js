// Leitura (somente leitura) da planilha de leads no Google Sheets.
// Usa uma conta de serviço do Google com acesso de VISUALIZAÇÃO à planilha.
// Nada aqui grava ou altera a planilha — só lê.

import { google } from "googleapis";

const SHEET_ID = process.env.LEADS_SHEET_ID;
const SHEET_RANGE = process.env.LEADS_SHEET_RANGE || "A:R"; // colunas id..enviado

function getAuth() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  // Opção mais simples e menos sujeita a erro de copiar/colar: colar o
  // arquivo .json da conta de serviço INTEIRO numa única variável.
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      email = parsed.client_email;
      key = parsed.private_key;
    } catch {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido — confira se colou o arquivo inteiro."
      );
    }
  } else if (key) {
    // Quando a chave vem separada, os \n normalmente chegam escapados.
    key = key.replace(/\\n/g, "\n");
  }

  if (!email || !key) {
    throw new Error(
      "Faltam as credenciais do Google: configure GOOGLE_SERVICE_ACCOUNT_JSON (recomendado) ou GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY."
    );
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

// Cabeçalhos reais da planilha (linha 1), na ordem em que aparecem hoje.
const HEADER_MAP = {
  id: "id",
  created_time: "createdTime",
  ad_id: "adId",
  ad_name: "adName",
  adset_id: "adsetId",
  adset_name: "adsetName",
  campaign_id: "campaignId",
  campaign_name: "campaignName",
  form_id: "formId",
  form_name: "formName",
  is_organic: "isOrganic",
  platform: "platform",
  "para_eu_te_enviar_as_opções_certas,_por_onde_você_prefere_começar?":
    "respostaPorOnde",
  qual_é_o_prazo_para_encontrar_o_imóvel_ideal: "respostaPrazo",
  nome: "nome",
  número_do_whatsapp: "telefone",
  lead_status: "leadStatusOrigem",
  enviado: "enviado",
};

function normalizeHeaderKey(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\?/g, "")
    .replace(/\s+/g, "_");
}

/**
 * Busca todas as linhas da planilha e devolve como array de objetos,
 * já usando nomes de campo amigáveis (em vez do cabeçalho cru da planilha).
 */
export async function fetchLeadsFromSheet() {
  if (!SHEET_ID) {
    throw new Error("Falta a variável LEADS_SHEET_ID.");
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const header = rows[0].map(normalizeHeaderKey);
  const dataRows = rows.slice(1);

  return dataRows
    .map((row) => {
      const raw = {};
      header.forEach((key, idx) => {
        const friendly = HEADER_MAP[key] || key;
        raw[friendly] = row[idx] ?? "";
      });
      return raw;
    })
    // ignora linhas de lead de teste do próprio Meta ("<test lead: ...>")
    .filter((r) => r.nome && !String(r.nome).includes("<test lead"));
}
