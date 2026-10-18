import { NextResponse, type NextRequest } from "next/server";

/*
 * Two jobs, no database (every page re-checks on its own):
 * 1. Route by host name. <sub>.<PUBLIC_ROOT_DOMAIN> → /s/<sub>/…; any other host that is not
 *    the app (APP_URL) → /d/<host>/…, which serves only domains verified in DNS.
 * 2. On the app host, send visitors without a session cookie to the sign-in page.
 */

const IP = /^\d+(\.\d+){3}$|^\[/;

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const root = process.env.PUBLIC_ROOT_DOMAIN?.toLowerCase();
  const appHost = process.env.APP_URL ? new URL(process.env.APP_URL).hostname.toLowerCase() : null;
  const { pathname, search } = request.nextUrl;
  const rest = pathname === "/" ? "" : pathname;

  if (host !== appHost) {
    if (root && host.endsWith(`.${root}`)) {
      const label = host.slice(0, -(root.length + 1));
      if (/^[a-z0-9-]+$/.test(label)) return NextResponse.rewrite(new URL(`/s/${label}${rest}${search}`, request.url));
    } else if (appHost && host && host !== root && !IP.test(host)) {
      return NextResponse.rewrite(new URL(`/d/${host}${rest}${search}`, request.url));
    }
  }

  if ((pathname.startsWith("/app") || pathname.startsWith("/preview")) && !request.cookies.has("session")) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
