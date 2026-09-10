import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";

const COOKIE_NAME = "painel_auth";

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.PANEL_PASSWORD_HASH;

  if (!expected) {
    return NextResponse.json(
      { error: "PANEL_PASSWORD_HASH não configurada no servidor." },
      { status: 500 }
    );
  }

  if (!password || hashPassword(password) !== expected) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, expected, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
  return res;
}
