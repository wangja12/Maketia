import { NextResponse, type NextRequest } from "next/server";

/*
 * Two jobs, no database (every page re-checks on its own):
 * 1. Route by host name. <sub>.<PUBLIC_ROOT_DOMAIN> → /s/<sub>/…; any other host that is not
 *    the app (APP_URL) → /d/<host>/…, which serves only domains verified in DNS.
 * 2. On the app host, send visitors without a session cookie to the sign-in page.
 * 3. On published sites, give the visitor first-party measurement ids (unless they sent Do Not
 *    Track or Global Privacy Control) and hand them to the page as request headers.
 * 4. In production, a Content-Security-Policy with a fresh nonce on every page: only scripts
 *    Next.js rendered for this request run (no inline or injected script).
 */

const IP = /^\d+(\.\d+){3}$|^\[/;
const VISITOR_COOKIE = "tia_v";
const SESSION_COOKIE = "tia_s";
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180;
const SESSION_MAX_AGE = 60 * 30;

/** Per-request CSP. Inline style attributes are allowed (page themes); scripts need the nonce. */
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    // Page images are user-provided https:// URLs on any host.
    "img-src 'self' https: data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // The app embeds its own previews; nobody else may frame any page (clickjacking).
    "frame-ancestors 'self'",
    // Only when the platform is served over HTTPS (local and test runs use plain HTTP).
    ...(process.env.APP_URL?.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** Request headers for the page: client-sent tracking ids removed, CSP nonce added. */
function forwardedHeaders(request: NextRequest, csp: string | null) {
  const headers = new Headers(request.headers);
  headers.delete("x-tia-visitor");
  headers.delete("x-tia-session");
  if (csp) headers.set("content-security-policy", csp);
  return headers;
}

/** Rewrite to the site route, with tracking ids for the page (never trusted from the client). */
function siteRewrite(request: NextRequest, target: string, headers: Headers) {
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
  // Development keeps hot reload and React's eval-based error overlay working.
  const csp = process.env.NODE_ENV === "production" ? contentSecurityPolicy(btoa(crypto.randomUUID())) : null;
  const headers = forwardedHeaders(request, csp);
  const response = route(request, headers);
  if (csp) response.headers.set("content-security-policy", csp);
  return response;
}

function route(request: NextRequest, headers: Headers) {
  const host = (request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const root = process.env.PUBLIC_ROOT_DOMAIN?.toLowerCase();
  const appHost = process.env.APP_URL ? new URL(process.env.APP_URL).hostname.toLowerCase() : null;
  const { pathname, search } = request.nextUrl;
  const rest = pathname === "/" ? "" : pathname;

  // Checkout and provider webhooks are API routes on every host; never rewrite them into a site.
  if (host !== appHost && !pathname.startsWith("/api/")) {
    if (root && host.endsWith(`.${root}`)) {
      const label = host.slice(0, -(root.length + 1));
      if (/^[a-z0-9-]+$/.test(label)) return siteRewrite(request, `/s/${label}${rest}${search}`, headers);
    } else if (appHost && host && host !== root && !IP.test(host)) {
      return siteRewrite(request, `/d/${host}${rest}${search}`, headers);
    }
  }

  if ((pathname.startsWith("/app") || pathname.startsWith("/preview") || pathname.startsWith("/admin")) && !request.cookies.has("session")) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  // Tracking ids reach pages only through siteRewrite.
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/files/upload).*)"] };
