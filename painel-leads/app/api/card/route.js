import { NextResponse } from "next/server";
import { setCardState } from "@/lib/store";

const ALLOWED_FIELDS = [
  "status",
  "fup",
  "summary",
  "lostReason",
  "acompanhamentoReason",
];

const ALLOWED_STATUS = [
  "novo",
  "visita",
  "followup",
  "acompanhamento",
  "perdido",
];

// Grava a movimentação/anotação de UM card. Isso NUNCA escreve na planilha —
// só no banco de estado (Upstash Redis) usado só por este painel.
export async function POST(req) {
  const body = await req.json().catch(() => null);

  if (!body || !body.leadId) {
    return NextResponse.json(
      { error: "leadId é obrigatório." },
      { status: 400 }
    );
  }

  const patch = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) patch[field] = body[field];
  }

  if (patch.status && !ALLOWED_STATUS.includes(patch.status)) {
    return NextResponse.json(
      { error: `status inválido: ${patch.status}` },
      { status: 400 }
    );
  }

  if (patch.fup !== undefined) {
    const n = Number(patch.fup);
    if (Number.isNaN(n) || n < 0 || n > 5) {
      return NextResponse.json(
        { error: "fup deve ser um número entre 0 e 5." },
        { status: 400 }
      );
    }
    patch.fup = n;
  }

  const next = await setCardState(body.leadId, patch);
  return NextResponse.json({ ok: true, state: next });
}
