import { getDb } from "@/db";
import { normalizeSource, recordBrowserEvent, trackingEnabled, visitorCookieOf } from "@/server/analytics/tracking";

/*
 * Measurement beacon from published pages. Always answers 204: a visitor's page never
 * depends on it, and a rejected event (bad token, duplicate) tells the caller nothing.
 */

export async function POST(request: Request) {
  const done = new Response(null, { status: 204 });
  if (!trackingEnabled()) return done;
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return done;
  const text = await request.text();
  if (text.length > 4000) return done;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return done;
  }
  const visitorCookie = visitorCookieOf(request);
  // Without the visitor cookie the token cannot be tied to this browser.
  if (!visitorCookie) return done;
  const ownHost = new URL(request.url).hostname.replace(/^www\./, "");
  await recordBrowserEvent(getDb(), {
    token: body.token,
    type: body.type,
    target: body.target,
    source: body.type === "page_view" ? normalizeSource({ referrer: body.referrer, utmSource: body.utmSource }, ownHost) : null,
    visitorCookie,
  });
  return done;
}
