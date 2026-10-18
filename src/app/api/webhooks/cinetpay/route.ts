import { getDb } from "@/db";
import { handleCinetPayWebhook, WebhookRejected } from "@/server/payments/service";

/*
 * CinetPay payment notification. The body only tells us which order to re-check:
 * we authenticate it with the notify token, then ask CinetPay for the real status.
 */
export async function POST(request: Request) {
  let body: unknown;
  const type = request.headers.get("content-type") ?? "";
  try {
    body = type.includes("application/json") ? await request.json() : Object.fromEntries((await request.formData()).entries());
  } catch {
    return Response.json({ ok: false, error: "Corps illisible" }, { status: 400 });
  }
  try {
    const order = await handleCinetPayWebhook(getDb(), body);
    return Response.json({ ok: true, status: order.status });
  } catch (e) {
    if (e instanceof WebhookRejected) return Response.json({ ok: false, error: e.message }, { status: e.httpStatus });
    console.error("[webhook cinetpay]", e);
    return Response.json({ ok: false, error: "Erreur interne" }, { status: 500 });
  }
}
