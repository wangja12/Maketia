import { getDb } from "@/db";
import { receiveSasPayWebhook } from "@/server/payments/saspay-webhooks";

/*
 * SasPay notifications for one seller (URL configured by the seller in their SasPay dashboard).
 * Stored raw and acknowledged; never trusted to mark an order paid (see saspay-webhooks.ts).
 */
export async function POST(request: Request, { params }: RouteContext<"/api/webhooks/saspay/[token]">) {
  const { token } = await params;
  const rawBody = await request.text();
  const result = await receiveSasPayWebhook(getDb(), token, rawBody, request.headers);
  if (!result.found) return Response.json({ error: "unknown endpoint" }, { status: 404 });
  if (!result.stored && result.reason === "too_large") return Response.json({ error: "payload too large" }, { status: 413 });
  return Response.json({ received: true }, { status: 200 });
}
