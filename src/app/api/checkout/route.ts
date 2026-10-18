import { getDb } from "@/db";
import { CheckoutError, startCheckout } from "@/server/payments/service";

/*
 * Order form target (plain HTML form, works without JavaScript, on any published host).
 * Success: 303 to the provider's payment page. Failure: 303 back to the page with a reason.
 */

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

/** Back to the page the form was on: same-host Referer only (no open redirect). */
function backUrl(request: Request, fallbackPath: string) {
  const here = new URL(request.url);
  const referer = request.headers.get("referer");
  if (referer && URL.canParse(referer)) {
    const r = new URL(referer);
    if (r.host === here.host) return new URL(r.pathname, here);
  }
  return new URL(fallbackPath, here);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const get = (k: string) => String(form.get(k) ?? "");
  const siteKind = get("site_kind");
  const site = siteKind === "domain" ? { hostname: get("site") } : { subdomain: get("site") };
  const path = get("path");
  const section = get("section");

  try {
    const { paymentUrl } = await startCheckout(getDb(), {
      site,
      path,
      sectionId: section,
      customer: { firstName: get("first_name"), lastName: get("last_name"), email: get("email"), phone: get("phone") },
      ip: clientIp(request),
    });
    return Response.redirect(paymentUrl, 303);
  } catch (e) {
    const code = e instanceof CheckoutError ? e.code : "provider";
    if (!(e instanceof CheckoutError)) console.error("[checkout]", e);
    const url = backUrl(request, siteKind === "domain" ? `/${path}` : `/s/${get("site")}/${path}`);
    url.searchParams.set("paiement", code);
    url.searchParams.set("section", section);
    if (e instanceof CheckoutError && Object.keys(e.fieldErrors).length > 0) url.searchParams.set("champs", JSON.stringify(e.fieldErrors));
    url.hash = section;
    return Response.redirect(url, 303);
  }
}
