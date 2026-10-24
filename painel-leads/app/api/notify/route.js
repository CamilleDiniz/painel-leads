import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { buildLeads } from "@/lib/leads";
import { runNotifyRound, getLastRun } from "@/lib/notify";

// Chamado pelo "despertador" gratuito (cron-job.org) a cada 5 minutos:
//   https://SEU-PAINEL.vercel.app/api/notify?key=SEU_NOTIFY_SECRET
//
// Responde NA HORA (o cron-job.org desiste depois de 30s) e faz o trabalho
// — ler planilhas e mandar os e-mails — logo depois, em segundo plano.
// A resposta mostra o resumo da rodada ANTERIOR ("lastRun"), com erros.
//
// Pra rodar e esperar o resultado na tela (diagnóstico no navegador):
//   ...&wait=1

export const maxDuration = 60;

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

  const panelUrl = process.env.PANEL_URL || req.nextUrl.origin;
  const round = () => runNotifyRound({ getLeads: buildLeads, panelUrl });

  if (req.nextUrl.searchParams.get("wait") === "1") {
    const result = await round();
    return NextResponse.json({ mode: "wait", ...result });
  }

  after(round);

  let lastRun = null;
  try {
    lastRun = await getLastRun();
  } catch (err) {
    lastRun = { error: `não consegui ler o último resultado: ${err.message}` };
  }
  return NextResponse.json({ ok: true, started: true, lastRun });
}

export const GET = handle;
export const POST = handle;
