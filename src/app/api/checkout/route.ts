import { getDb } from "@/db";
import { backUrl, clientIp, formTarget } from "@/lib/public-forms";
import { visitorCookieOf } from "@/server/analytics/tracking";
import { CheckoutError, startCheckout } from "@/server/payments/service";

/*
 * Order form target (plain HTML form, works without JavaScript, on any published host).
 * Success: 303 to the seller’s SasPay link stored on the product. Failure: 303 back to the page.
 */

export async function POST(request: Request) {
  const form = await request.formData();
  const get = (k: string) => String(form.get(k) ?? "");
  const { site, path, section, fallbackPath } = formTarget(form);

  try {
    const { paymentUrl } = await startCheckout(getDb(), {
      site,
      path,
      sectionId: section,
      customer: { firstName: get("first_name"), lastName: get("last_name"), email: get("email"), phone: get("phone") },
      ip: clientIp(request),
      visitorId: visitorCookieOf(request),
      attribution: Object.fromEntries([...form.entries()].filter(([k]) => k.startsWith("utm_"))),
    });
    return Response.redirect(paymentUrl, 303);
  } catch (e) {
    const code = e instanceof CheckoutError ? e.code : "unavailable";
    if (!(e instanceof CheckoutError)) console.error("[checkout]", e);
    const url = backUrl(request, fallbackPath);
    url.searchParams.set("paiement", code);
    url.searchParams.set("section", section);
    if (e instanceof CheckoutError && Object.keys(e.fieldErrors).length > 0) url.searchParams.set("champs", JSON.stringify(e.fieldErrors));
    url.hash = section;
    return Response.redirect(url, 303);
  }
}
