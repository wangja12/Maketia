import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { orders, paymentEvents, platformSettings, saspayWebhookEndpoints, saspayWebhookEvents } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import { createFunnel } from "@/server/funnels";
import { addSection, createPage } from "@/server/pages";
import { checkPaymentLink } from "@/server/payments/links";
import {
  getWebhookSetup,
  ignoreWebhookEvent,
  listWebhookEvents,
  receiveSasPayWebhook,
  reconcileWebhookEvent,
  setSigningSecret,
  SIGNATURE_SCHEME_CONFIRMED,
} from "@/server/payments/saspay-webhooks";
import {
  cancelOrder,
  checkoutProblems,
  CHECKOUT_LIMIT_PER_10_MIN,
  CheckoutError,
  confirmOrderPaidManually,
  createProduct,
  publicOrderStatus,
  setProductPaymentLink,
} from "@/server/payments/service";
import { publishPage } from "@/server/publishing";
import { db, makeUser } from "./db";

const LINK_HOST = "pay.saspay-test.example";
const LINK = `https://${LINK_HOST}/l/abc123`;

beforeAll(() => {
  process.env.PAYMENT_SECRETS_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.APP_URL = "https://app.tunnels.test";
});

async function allowHost() {
  await db.update(platformSettings).set({ saspayLinkHosts: [LINK_HOST] });
}

const customer = { firstName: "Awa", lastName: "Diop", email: "awa@exemple.test", phone: "+225 07 00 00 00 01" };

/** A published sales page whose order form sells a product with a confirmed SasPay link. */
async function shop() {
  await allowHost();
  const u = await makeUser();
  const product = await createProduct(db, u.userId, u.workspaceId, { name: "E-book Excel", price: "5000", currency: "XOF", kind: "digital_file" });
  await setProductPaymentLink(db, u.userId, product.id, { url: LINK, price: "5000", currency: "XOF", confirmed: true });
  const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "Excel" });
  const page = await createPage(db, { userId: u.userId }, funnel.id, { name: "Vente", kind: "sales" });
  await addSection(db, { userId: u.userId }, page.id, 1, { id: "commande", type: "checkout", productId: product.id, buttonLabel: "Payer" });
  await publishPage(db, u.userId, page.id, { path: "", reviewConfirmed: true });
  const { startCheckout } = await import("@/server/payments/service");
  const buy = (c: unknown = customer, ip = "10.0.0.1", attribution: Record<string, unknown> = {}) =>
    startCheckout(db, { site: { subdomain: "excel" }, path: "", sectionId: "commande", customer: c, ip, attribution });
  return { ...u, product, funnel, page, buy };
}

describe("seller payment links (no SasPay API, no seller key)", () => {
  it("accepts only https links on hosts an admin allowed, and needs the price confirmation", async () => {
    expect(checkPaymentLink(LINK, []).ok).toBe(false);
    expect(checkPaymentLink(LINK, [LINK_HOST]).ok).toBe(true);
    for (const bad of ["http://pay.saspay-test.example/l/1", "javascript:alert(1)", "https://evil.example/l/1", "https://user:pw@pay.saspay-test.example/x", `https://${LINK_HOST}.evil.example/x`]) {
      expect(checkPaymentLink(bad, [LINK_HOST]).ok, bad).toBe(false);
    }
    await allowHost();
    const u = await makeUser();
    const p = await createProduct(db, u.userId, u.workspaceId, { name: "Coaching", price: "15000", currency: "xof" });
    expect(p).toMatchObject({ currency: "XOF", kind: "no_delivery", saspayLinkUrl: null });
    await expect(setProductPaymentLink(db, u.userId, p.id, { url: LINK, price: "15000", currency: "XOF", confirmed: false })).rejects.toThrow("Confirmez");
    await expect(setProductPaymentLink(db, u.userId, p.id, { url: "https://evil.example/pay", price: "15000", currency: "XOF", confirmed: true })).rejects.toBeInstanceOf(ValidationError);
    const saved = await setProductPaymentLink(db, u.userId, p.id, { url: `${LINK}#frag`, price: "15000", currency: "XOF", confirmed: true });
    expect(saved.saspayLinkUrl).toBe(LINK);
    expect(saved.priceConfirmedAt).not.toBeNull();
    const other = await makeUser("Autre");
    await expect(setProductPaymentLink(db, other.userId, p.id, { url: LINK, price: "1", currency: "XOF", confirmed: true })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("blocks publication of an order form whose product has no ready link", async () => {
    await allowHost();
    const u = await makeUser();
    const p = await createProduct(db, u.userId, u.workspaceId, { name: "Sans lien", price: "1000", currency: "XOF" });
    const content = { schemaVersion: 1 as const, theme: { accent: "#1f5f4a", background: "light" as const, font: "sans" as const }, sections: [{ id: "c", type: "checkout" as const, productId: p.id, buttonLabel: "Payer" }] };
    expect(await checkoutProblems(db, u.workspaceId, content)).toEqual([expect.stringContaining("lien absent")]);
  });
});

describe("checkout through the seller's link", () => {
  it("records a pending order with attribution and sends the buyer to the stored link", async () => {
    const s = await shop();
    const { orderId, paymentUrl } = await s.buy(customer, "10.0.0.1", { utm_source: "facebook", utm_campaign: "lancement", email: "x@y.z", fbclid: "zzz" });
    expect(paymentUrl).toBe(LINK);
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order).toMatchObject({
      status: "pending", paymentMethod: "saspay_link", amount: 5000, currency: "XOF", customerEmail: "awa@exemple.test",
      customerPhone: "+2250700000001", attribution: { utm_source: "facebook", utm_campaign: "lancement" }, paidVia: null,
    });
    // The return page only shows the stored state: visiting it changes nothing.
    expect((await publicOrderStatus(db, orderId))?.status).toBe("pending");
    expect((await publicOrderStatus(db, orderId))?.status).toBe("pending");
  });

  it("validates the buyer server-side, limits abuse, and refuses when the link is gone", async () => {
    const s = await shop();
    await expect(s.buy({ ...customer, email: "pas-un-email" })).rejects.toMatchObject({ code: "invalid" });
    for (let i = 0; i < CHECKOUT_LIMIT_PER_10_MIN; i++) await s.buy(customer, "10.9.9.9");
    await expect(s.buy(customer, "10.9.9.9")).rejects.toMatchObject({ code: "rate_limited" });
    await db.update(platformSettings).set({ saspayLinkHosts: [] });
    await expect(s.buy(customer, "10.1.1.1")).rejects.toBeInstanceOf(CheckoutError);
  });
});

describe("SasPay notifications (reception only until the signature scheme is confirmed)", () => {
  it("routes by opaque URL, stores raw, deduplicates retries and never marks anything paid", async () => {
    expect(SIGNATURE_SCHEME_CONFIRMED).toBe(false);
    const s = await shop();
    const { orderId } = await s.buy();
    const setup = await getWebhookSetup(db, s.userId, s.workspaceId);
    expect(setup).toMatchObject({ hasSecret: false, state: "secret_missing", automaticProcessing: false });
    const token = setup.url!.split("/").pop()!;
    expect(token.length).toBeGreaterThanOrEqual(30);

    await expect(setSigningSecret(db, s.userId, s.workspaceId, "sk_live_abcdefghijklmnop")).rejects.toThrow("clé API");
    await setSigningSecret(db, s.userId, s.workspaceId, "whsec_0123456789abcdef0123");
    const [endpoint] = await db.select().from(saspayWebhookEndpoints).where(eq(saspayWebhookEndpoints.workspaceId, s.workspaceId));
    expect(endpoint.signingSecret).not.toContain("whsec_0123456789abcdef0123");

    const body = JSON.stringify({ type: "transaction.success", data: { id: "tx_1", status: "SUCCESS", amount: 5000, currency: "XOF" } });
    const headers = new Headers({ "x-saspay-signature": "t=1,v1=abc", "content-type": "application/json", authorization: "secret" });
    expect(await receiveSasPayWebhook(db, "inconnu-inconnu-inconnu-1234", body, headers)).toEqual({ found: false });
    expect(await receiveSasPayWebhook(db, token, body, headers)).toMatchObject({ found: true, stored: true });
    expect(await receiveSasPayWebhook(db, token, body, headers)).toMatchObject({ found: true, duplicate: true });

    const events = await listWebhookEvents(db, s.userId, s.workspaceId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ verification: "scheme_unconfirmed", status: "to_reconcile", eventType: "transaction.success", transactionRef: "tx_1" });
    expect(events[0].signatureHeaders).toEqual({ "x-saspay-signature": "t=1,v1=abc" });
    // A signed-looking SUCCESS notification still does not pay the order.
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order.status).toBe("pending");
    expect((await getWebhookSetup(db, s.userId, s.workspaceId)).state).toBe("received_unverified");
  });

  it("lets the owner reconcile by hand (audited), never an editor or another workspace", async () => {
    const s = await shop();
    const { orderId } = await s.buy();
    const token = (await getWebhookSetup(db, s.userId, s.workspaceId)).url!.split("/").pop()!;
    await receiveSasPayWebhook(db, token, '{"type":"transaction.success"}', new Headers());
    await receiveSasPayWebhook(db, token, '{"type":"transaction.success","n":2}', new Headers());
    const [first, second] = await db.select().from(saspayWebhookEvents).orderBy(saspayWebhookEvents.id);

    const other = await makeUser("Autre");
    await expect(reconcileWebhookEvent(db, other.userId, first.id, { orderId, attested: true })).rejects.toBeInstanceOf(NotFoundError);
    await expect(reconcileWebhookEvent(db, s.userId, first.id, { orderId, attested: false })).rejects.toThrow("Cochez");

    const paid = await reconcileWebhookEvent(db, s.userId, first.id, { orderId, attested: true, note: "Vu dans SasPay, réf. tx_1" });
    expect(paid).toMatchObject({ status: "paid", paidVia: "manual" });
    const audit = await db.select().from(paymentEvents).where(eq(paymentEvents.orderId, orderId));
    expect(audit.map((e) => e.kind)).toEqual(["order_created", "manual_confirmation"]);
    // Settled orders cannot be confirmed again or cancelled.
    await expect(reconcileWebhookEvent(db, s.userId, second.id, { orderId, attested: true })).rejects.toThrow("plus en attente");
    await expect(cancelOrder(db, s.userId, orderId)).rejects.toBeInstanceOf(ValidationError);
    await ignoreWebhookEvent(db, s.userId, second.id, "vente hors tunnel");
    expect((await listWebhookEvents(db, s.userId, s.workspaceId)).map((e) => e.status).sort()).toEqual(["ignored", "matched"]);
  });

  it("reserves manual confirmation to owners and admins", async () => {
    const s = await shop();
    const { orderId } = await s.buy();
    const editor = await makeUser("Editeur");
    const { workspaceMembers } = await import("@/db/schema");
    await db.insert(workspaceMembers).values({ workspaceId: s.workspaceId, userId: editor.userId, role: "editor" });
    await expect(confirmOrderPaidManually(db, editor.userId, orderId, { attested: true })).rejects.toThrow();
    await expect(getWebhookSetup(db, editor.userId, s.workspaceId)).rejects.toThrow();
  });
});
