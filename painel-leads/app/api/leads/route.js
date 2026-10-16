import { NextResponse } from "next/server";
import { fetchLeadsFromSheet } from "@/lib/sheets";
import { fetchGoogleLeadsFromSheet } from "@/lib/sheetsGoogle";
import { extractProperty, extractGoogleProperty } from "@/lib/property";
import { normalizePhone } from "@/lib/phone";
import { getAllCardStates } from "@/lib/store";

// Route Handlers não são cacheados por padrão nesta versão do Next —
// então isso já busca as planilhas a cada request, sem precisar de config extra.

// Duas fontes de leads:
//   - Meta Ads  (planilha LEADS_SHEET_ID)        -> origin "meta"
//   - Google    (planilha "Leads Google - ...")  -> origin "google", tag "Google"
// As duas são lidas em paralelo; se uma falhar, a outra continua aparecendo
// e o erro volta em `warnings`.

function mapMetaLead(r) {
  const property = extractProperty(r.adName, r.campaignName);
  return {
    id: r.id,
    origin: "meta",
    tags: [],
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
function mapGoogleLead(p) {
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
    tags: ["Google"],
    name: p.nome,
    phone: normalizePhone(p.telefone),
    property: properties.join(" | ") || "Interesse geral (site)",
    properties,
    propertyUncertain: false,
    source: p.origens.length ? `Site · ${p.origens.join(" + ")}` : "Site",
    formAnswers: { porOnde: "", prazo: "" },
    message: p.entries[0]?.mensagem || "",
    contacts: p.contacts,
    firstContactAt: p.firstContact,
    createdAt: p.createdTime,
  };
}

function toTime(v) {
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

export async function GET() {
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
    return NextResponse.json(
      { error: warnings.join(" | ") || "Erro ao buscar leads das planilhas." },
      { status: 500 }
    );
  }

  try {
    const base = [
      ...(metaRes.status === "fulfilled" ? metaRes.value.map(mapMetaLead) : []),
      ...(googleRes.status === "fulfilled" ? googleRes.value.map(mapGoogleLead) : []),
    ];

    const states = await getAllCardStates(base.map((l) => l.id));
    const leads = base.map((l) => ({ ...l, ...states[l.id] }));

    // mais recentes primeiro
    leads.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

    return NextResponse.json({
      leads,
      warnings,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Erro ao montar leads:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao buscar leads da planilha." },
      { status: 500 }
    );
  }
}
