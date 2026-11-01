import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((cookieName) =>
    Boolean(request.cookies.get(cookieName)?.value)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = hasSessionCookie(request);

  if (pathname.startsWith("/vault")) {
    if (!isAuthenticated) {
      const signInUrl = new URL("/sign-in", request.url);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  if (pathname === "/sign-in" || pathname === "/sign-up") {
    if (isAuthenticated) {
      const vaultUrl = new URL("/vault", request.url);
      return NextResponse.redirect(vaultUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/vault/:path*", "/sign-in", "/sign-up"],
};
