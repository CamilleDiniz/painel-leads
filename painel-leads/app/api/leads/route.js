import { NextResponse } from "next/server";
import { fetchLeadsFromSheet } from "@/lib/sheets";
import { extractProperty } from "@/lib/property";
import { normalizePhone } from "@/lib/phone";
import { getAllCardStates } from "@/lib/store";

// Route Handlers não são cacheados por padrão nesta versão do Next —
// então isso já busca a planilha a cada request, sem precisar de config extra.

export async function GET() {
  try {
    const rawLeads = await fetchLeadsFromSheet();

    const leadIds = rawLeads.map((r) => r.id);
    const states = await getAllCardStates(leadIds);

    const leads = rawLeads.map((r) => {
      const property = extractProperty(r.adName, r.campaignName);
      const phone = normalizePhone(r.telefone);
      const state = states[r.id];

      return {
        id: r.id,
        name: r.nome,
        phone,
        property: property.label,
        propertyUncertain: property.uncertain,
        source: r.platform === "ig" ? "Meta Ads (Instagram)" : "Meta Ads (Facebook)",
        formAnswers: {
          porOnde: (r.respostaPorOnde || "").replace(/_/g, " "),
          prazo: (r.respostaPrazo || "").replace(/_/g, " "),
        },
        createdAt: r.createdTime,
        ...state,
      };
    });

    // mais recentes primeiro
    leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({ leads, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Erro ao buscar leads:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao buscar leads da planilha." },
      { status: 500 }
    );
  }
}
