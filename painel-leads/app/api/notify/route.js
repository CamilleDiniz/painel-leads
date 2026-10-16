import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { buildLeads } from "@/lib/leads";
import { notifyNewLeads } from "@/lib/notify";

// Chamado pelo "despertador" gratuito (cron-job.org) a cada 5 minutos:
//   https://SEU-PAINEL.vercel.app/api/notify?key=SEU_NOTIFY_SECRET
// Não precisa de login no painel (o proxy.js libera esta rota), mas só
// funciona com o código secreto certo.

function secretOk(given) {
  const expected = process.env.NOTIFY_SECRET || "";
  if (!expected || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req) {
  const given =
    req.nextUrl.searchParams.get("key") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  if (!secretOk(given)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { leads, warnings, loaded } = await buildLeads();
    const panelUrl = process.env.PANEL_URL || req.nextUrl.origin;
    const result = await notifyNewLeads({ leads, loaded, panelUrl });
    return NextResponse.json({ ok: true, ...result, warnings });
  } catch (err) {
    console.error("Erro no aviso de leads novos:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
