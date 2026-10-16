// Monta a lista de leads do painel a partir das DUAS planilhas.
// Usado pela página (app/api/leads) e pelo aviso de lead novo (app/api/notify),
// para que os dois enxerguem exatamente os mesmos leads.

import { fetchLeadsFromSheet } from "./sheets.js";
import { fetchGoogleLeadsFromSheet } from "./sheetsGoogle.js";
import { extractProperty, extractGoogleProperty } from "./property.js";
import { createHash } from "node:crypto";
import { normalizePhone } from "./phone.js";

// Duas fontes de leads:
//   - Meta Ads  (planilha LEADS_SHEET_ID)        -> origin "meta",   tag "Meta Ads"
//   - Google    (planilha "Leads Google - ...")  -> origin "google", tag "Google Ads"
// O filtro por plataforma do painel usa o campo `origin`.
// As duas são lidas em paralelo; se uma falhar, a outra continua aparecendo
// e o erro volta em `warnings`.

export function mapMetaLead(r) {
  const property = extractProperty(r.adName, r.campaignName);
  return {
    id: r.id,
    origin: "meta",
    tags: ["Meta Ads"],
    name: r.nome,
    phone: normalizePhone(r.telefone),
    property: property.label,
    propertyUncertain: property.uncertain,
    source: r.platform === "ig" ? "Meta Ads (Instagram)" : "Meta Ads (Facebook)",
    formAnswers: {
      porOnde: (r.respostaPorOnde || "").replace(/_/g, " "),
      prazo: (r.respostaPrazo || "").replace(/_/g, " "),
    },
    message: "",
    createdAt: r.createdTime,
  };
}

// Um card por pessoa: junta os imóveis de interesse de todos os contatos.
// Rótulos genéricos ("Interesse geral…") só aparecem se não houver nenhum
// imóvel específico.
export function mapGoogleLead(p) {
  const labels = [];
  for (const e of p.entries) {
    const { label } = extractGoogleProperty(e);
    if (!labels.some((l) => l.toLowerCase() === label.toLowerCase())) labels.push(label);
  }
  const specific = labels.filter((l) => !l.startsWith("Interesse geral"));
  const properties = specific.length ? specific : labels.slice(0, 1);

  return {
    id: p.id,
    origin: "google",
    tags: ["Google Ads"],
    name: p.nome,
    phone: normalizePhone(p.telefone),
    property: properties.join(" | ") || "Interesse geral (site)",
    properties,
    propertyUncertain: false,
    source: p.origens.length ? `Site · ${p.origens.join(" + ")}` : "Site",
    formAnswers: { porOnde: "", prazo: "" },
    message: p.entries[0]?.mensagem || "",
    // cada vez que a pessoa entrou em contato (usado pelo aviso por e-mail:
    // um e-mail por contato, mesmo quando a pessoa se repete)
    contactHistory: p.entries.map((e) => ({
      key: googleContactKey(e),
      at: e.createdTime,
      origem: e.origem || "",
      property: extractGoogleProperty(e).label,
      mensagem: e.mensagem || "",
    })),
    contacts: p.contacts,
    firstContactAt: p.firstContact,
    createdAt: p.createdTime,
  };
}

// Identifica UM contato da planilha do Google (uma linha). Linhas idênticas
// no mesmo minuto (clique duplo no botão) contam como um contato só.
function googleContactKey(e) {
  const key = [e.dataHora, String(e.telefone || "").replace(/\D/g, ""), e.origem, e.imovel, e.valor, e.condominio, e.mensagem]
    .map((v) => String(v || "").trim().toLowerCase())
    .join("|");
  return "g:" + createHash("sha1").update(key).digest("hex").slice(0, 20);
}

export function toTime(v) {
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Lê as duas planilhas em paralelo e devolve { leads, warnings }.
 * Se só uma falhar, devolve os leads da outra + o aviso em `warnings`.
 * Se as duas falharem, lança erro.
 */
export async function buildLeads() {
  const [metaRes, googleRes] = await Promise.allSettled([
    fetchLeadsFromSheet(),
    fetchGoogleLeadsFromSheet(),
  ]);

  const warnings = [];
  if (metaRes.status === "rejected") {
    console.error("Erro ao buscar leads do Meta:", metaRes.reason);
    warnings.push(`Planilha do Meta Ads: ${metaRes.reason?.message || "erro na leitura"}`);
  }
  if (googleRes.status === "rejected") {
    console.error("Erro ao buscar leads do Google:", googleRes.reason);
    warnings.push(`Planilha do Google: ${googleRes.reason?.message || "erro na leitura"}`);
  }
  if (metaRes.status === "rejected" && googleRes.status === "rejected") {
    throw new Error(warnings.join(" | ") || "Erro ao buscar leads das planilhas.");
  }

  const leads = [
    ...(metaRes.status === "fulfilled" ? metaRes.value.map(mapMetaLead) : []),
    ...(googleRes.status === "fulfilled" ? googleRes.value.map(mapGoogleLead) : []),
  ];

  const loaded = {
    meta: metaRes.status === "fulfilled",
    google: googleRes.status === "fulfilled",
  };

  return { leads, warnings, loaded };
}
