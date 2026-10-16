import { NextResponse } from "next/server";
import { buildLeads, toTime } from "@/lib/leads";
import { getAllCardStates } from "@/lib/store";

// Route Handlers não são cacheados por padrão nesta versão do Next —
// então isso já busca as planilhas a cada request, sem precisar de config extra.
// A montagem dos leads (Meta + Google) fica em lib/leads.js.

export async function GET() {
  try {
    const { leads: base, warnings } = await buildLeads();

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
    console.error("Erro ao buscar leads:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao buscar leads da planilha." },
      { status: 500 }
    );
  }
}
