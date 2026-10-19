import { NextResponse, type NextRequest } from "next/server";

/*
 * Two jobs, no database (every page re-checks on its own):
 * 1. Route by host name. <sub>.<PUBLIC_ROOT_DOMAIN> → /s/<sub>/…; any other host that is not
 *    the app (APP_URL) → /d/<host>/…, which serves only domains verified in DNS.
 * 2. On the app host, send visitors without a session cookie to the sign-in page.
 * 3. On published sites, give the visitor first-party measurement ids (unless they sent Do Not
 *    Track or Global Privacy Control) and hand them to the page as request headers.
 */

const IP = /^\d+(\.\d+){3}$|^\[/;
const VISITOR_COOKIE = "tia_v";
const SESSION_COOKIE = "tia_s";
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180;
const SESSION_MAX_AGE = 60 * 30;

/** Rewrite to the site route, with tracking ids for the page (never trusted from the client). */
function siteRewrite(request: NextRequest, target: string) {
  const headers = new Headers(request.headers);
  headers.delete("x-tia-visitor");
  headers.delete("x-tia-session");
  const optedOut = request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1";
  if (optedOut) return NextResponse.rewrite(new URL(target, request.url), { request: { headers } });

  const existing = (name: string) => {
    const v = request.cookies.get(name)?.value;
    return v && ID.test(v) ? v : null;
  };
  const visitor = existing(VISITOR_COOKIE) ?? crypto.randomUUID();
  const session = existing(SESSION_COOKIE) ?? crypto.randomUUID();
  headers.set("x-tia-visitor", visitor);
  headers.set("x-tia-session", session);
  const response = NextResponse.rewrite(new URL(target, request.url), { request: { headers } });
  const secure = request.nextUrl.protocol === "https:";
  const base = { httpOnly: true, sameSite: "lax", secure, path: "/" } as const;
  response.cookies.set(VISITOR_COOKIE, visitor, { ...base, maxAge: VISITOR_MAX_AGE });
  // Sliding session: 30 minutes without a page view starts a new one.
  response.cookies.set(SESSION_COOKIE, session, { ...base, maxAge: SESSION_MAX_AGE });
  return response;
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const root = process.env.PUBLIC_ROOT_DOMAIN?.toLowerCase();
  const appHost = process.env.APP_URL ? new URL(process.env.APP_URL).hostname.toLowerCase() : null;
  const { pathname, search } = request.nextUrl;
  const rest = pathname === "/" ? "" : pathname;

  // Checkout and provider webhooks are API routes on every host; never rewrite them into a site.
  if (host !== appHost && !pathname.startsWith("/api/")) {
    if (root && host.endsWith(`.${root}`)) {
      const label = host.slice(0, -(root.length + 1));
      if (/^[a-z0-9-]+$/.test(label)) return siteRewrite(request, `/s/${label}${rest}${search}`);
    } else if (appHost && host && host !== root && !IP.test(host)) {
      return siteRewrite(request, `/d/${host}${rest}${search}`);
    }
  }

  if ((pathname.startsWith("/app") || pathname.startsWith("/preview") || pathname.startsWith("/admin")) && !request.cookies.has("session")) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  // Tracking ids reach pages only through siteRewrite.
  if (request.headers.has("x-tia-visitor") || request.headers.has("x-tia-session")) {
    const headers = new Headers(request.headers);
    headers.delete("x-tia-visitor");
    headers.delete("x-tia-session");
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
