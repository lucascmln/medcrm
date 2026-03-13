import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");
  const isApiWebhook = req.nextUrl.pathname.startsWith("/api/webhooks");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");

  // Webhooks e auth são públicos
  if (isApiWebhook || isApiAuth) {
    return NextResponse.next();
  }

  // Se não está logado e não é página de auth, redireciona para login
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Se está logado e tenta acessar página de auth, redireciona para dashboard
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
