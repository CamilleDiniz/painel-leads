import { NextResponse } from "next/server";

const COOKIE_NAME = "painel_auth";

export function proxy(req) {
  const { pathname } = req.nextUrl;

  // libera a própria página de login e a rota que valida a senha
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const expected = process.env.PANEL_PASSWORD_HASH;

  if (!expected || cookie !== expected) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // protege tudo, exceto assets estáticos do Next
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
