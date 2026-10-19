/** Helpers shared by the public form targets (order form, contact form). */

/**
 * Client IP as reported by the reverse proxy. Trustworthy only if the host overwrites
 * X-Forwarded-For (see docs/DEPLOIEMENT.md); used for abuse limits, never stored in clear.
 */
export function clientIp(request: { headers: Headers }) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

/** Back to the page the form was on: same-host Referer only (no open redirect). */
export function backUrl(request: Request, fallbackPath: string) {
  const here = new URL(request.url);
  const referer = request.headers.get("referer");
  if (referer && URL.canParse(referer)) {
    const r = new URL(referer);
    if (r.host === here.host) return new URL(r.pathname, here);
  }
  return new URL(fallbackPath, here);
}

/** The site and page the form says it was on (re-checked by the service against live publications). */
export function formTarget(form: FormData) {
  const get = (k: string) => String(form.get(k) ?? "");
  const siteKind = get("site_kind");
  const site = siteKind === "domain" ? { hostname: get("site") } : { subdomain: get("site") };
  const path = get("path");
  return { site, path, section: get("section"), fallbackPath: siteKind === "domain" ? `/${path}` : `/s/${get("site")}/${path}` };
}
