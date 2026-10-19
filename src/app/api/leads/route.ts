import { getDb } from "@/db";
import { backUrl, clientIp, formTarget } from "@/lib/public-forms";
import { visitorCookieOf } from "@/server/analytics/tracking";
import { LeadError, submitLead } from "@/server/crm/leads";

/*
 * Contact form target (plain HTML form, works without JavaScript, on any published host).
 * Always 303 back to the page, with ?inscription=ok or the reason it was refused.
 */

export async function POST(request: Request) {
  const form = await request.formData();
  const get = (k: string) => String(form.get(k) ?? "");
  const { site, path, section, fallbackPath } = formTarget(form);
  const url = backUrl(request, fallbackPath);
  url.searchParams.set("section", section);
  url.hash = section;
  try {
    await submitLead(getDb(), {
      site,
      path,
      sectionId: section,
      fields: { firstName: get("first_name"), email: get("email"), phone: get("phone"), consent: get("consent") },
      ip: clientIp(request),
      visitorId: visitorCookieOf(request),
    });
    url.searchParams.set("inscription", "ok");
  } catch (e) {
    if (!(e instanceof LeadError)) {
      console.error("[leads]", e);
      url.searchParams.set("inscription", "unavailable");
    } else {
      url.searchParams.set("inscription", e.code);
      if (Object.keys(e.fieldErrors).length > 0) url.searchParams.set("champs", JSON.stringify(e.fieldErrors));
    }
  }
  return Response.redirect(url, 303);
}
