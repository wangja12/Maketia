import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { orders, paymentEvents, paymentProviders } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import { createFunnel } from "@/server/funnels";
import { addSection, createPage } from "@/server/pages";
import type { GatewayFactory, GatewayStatus } from "@/server/payments/gateway";
import {
  checkoutProblems,
  createProduct,
  handleCinetPayWebhook,
  listOrders,
  listProviders,
  publicOrderStatus,
  refreshOrderForUser,
  saveProvider,
  setProductActive,
  startCheckout,
  verifyProvider,
  WebhookRejected,
  CheckoutError,
  CHECKOUT_LIMIT_PER_10_MIN,
} from "@/server/payments/service";
import { publishPage } from "@/server/publishing";
import { db, makeUser } from "./db";

beforeAll(() => {
  process.env.PAYMENT_SECRETS_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.APP_URL = "https://app.tunnels.test";
});

/** In-memory stand-in for the provider, following the adapter contract. */
function fakeGateway(opts: { authFails?: boolean; initFails?: boolean } = {}) {
  const state = new Map<string, { status: string; tx: string }>();
  const calls: string[] = [];
  const factory: GatewayFactory = () => ({
    async verifyConnection() {
      calls.push("verify");
      if (opts.authFails) throw new Error("INVALID_CREDENTIALS");
    },
    async createPayment(req) {
      calls.push(`create:${req.amount}:${req.currency}`);
      if (opts.initFails) throw new Error("timeout");
      const tx = `cp-${req.merchantTransactionId}`;
      state.set(req.merchantTransactionId, { status: "INITIATED", tx });
      return { providerTransactionId: tx, notifyToken: `notify-${req.merchantTransactionId}`, paymentUrl: `https://pay.test/${tx}`, status: "INITIATED" };
    },
    async findPayment(id): Promise<GatewayStatus> {
      calls.push(`find:${id}`);
      const s = state.get(id)!;
      const outcome = s.status === "SUCCESS" ? "paid" : s.status === "FAILED" ? "failed" : s.status === "EXPIRED" ? "expired" : "pending";
      return { status: s.status, merchantTransactionId: id, providerTransactionId: s.tx, outcome };
    },
  });
  return { factory, state, calls };
}

const customer = { firstName: "Awa", lastName: "Diop", email: "awa@exemple.test", phone: "+225 07 00 00 00 01" };

async function shop(gateway = fakeGateway()) {
  const u = await makeUser();
  const provider = await saveProvider(db, u.userId, u.workspaceId, { country: "CI", environment: "sandbox", apiKey: "k", apiPassword: "secret-password" });
  await verifyProvider(db, u.userId, provider.id, gateway.factory);
  const product = await createProduct(db, u.userId, u.workspaceId, { name: "E-book Excel", price: "5000", currency: "XOF" });
  const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "Excel" });
  const page = await createPage(db, { userId: u.userId }, funnel.id, { name: "Vente", kind: "sales" });
  await addSection(db, { userId: u.userId }, page.id, 1, { id: "commande", type: "checkout", productId: product.id, buttonLabel: "Payer" });
  await publishPage(db, u.userId, page.id, { path: "", reviewConfirmed: true });
  const site = { subdomain: "excel" };
  const buy = (c: unknown = customer, ip = "10.0.0.1") => startCheckout(db, { site, path: "", sectionId: "commande", customer: c, ip }, gateway.factory);
  return { ...u, provider, product, funnel, page, gateway, buy };
}

describe("provider accounts", () => {
  it("stores credentials encrypted and records a real verification outcome", async () => {
    const u = await makeUser();
    const p = await saveProvider(db, u.userId, u.workspaceId, { country: "SN", environment: "sandbox", apiKey: "key-123", apiPassword: "super-secret" });
    expect(p.credentials).not.toContain("super-secret");
    expect(p.status).toBe("unverified");
    const failed = await verifyProvider(db, u.userId, p.id, fakeGateway({ authFails: true }).factory);
    expect(failed).toMatchObject({ status: "failed", lastError: "INVALID_CREDENTIALS" });
    const ok = await verifyProvider(db, u.userId, p.id, fakeGateway().factory);
    expect(ok.status).toBe("verified");
    const listed = await listProviders(db, u.userId, u.workspaceId);
    expect(listed[0]).not.toHaveProperty("credentials");
  });

  it("is restricted to owners and admins of the workspace", async () => {
    const u = await makeUser();
    const other = await makeUser("Autre");
    await expect(saveProvider(db, other.userId, u.workspaceId, { country: "CI", environment: "sandbox", apiKey: "k", apiPassword: "p" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(saveProvider(db, u.userId, u.workspaceId, { country: "FR", environment: "sandbox", apiKey: "k", apiPassword: "p" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("checkout and confirmation", () => {
  it("charges the product price, then marks paid only after the provider confirms", async () => {
    const s = await shop();
    const { orderId, paymentUrl } = await s.buy();
    expect(paymentUrl).toMatch(/^https:\/\/pay\.test\//);
    expect(s.gateway.calls).toContain("create:5000:XOF");
    let [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order).toMatchObject({ status: "pending", amount: 5000, customerPhone: "+2250700000001", variantLabel: "A", pageId: s.page.id });

    // Browser comes back before payment: still pending (the redirect proves nothing).
    expect((await publicOrderStatus(db, orderId, s.gateway.factory))?.status).toBe("pending");

    // Provider marks it paid; the webhook carries a forged status, which is ignored anyway.
    s.gateway.state.get(order.merchantTransactionId)!.status = "SUCCESS";
    await handleCinetPayWebhook(db, { notify_token: `notify-${order.merchantTransactionId}`, merchant_transaction_id: order.merchantTransactionId, transaction_id: order.providerTransactionId, status: "FAILED" }, s.gateway.factory);
    [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order.status).toBe("paid");
    expect(order.paidAt).not.toBeNull();

    // Replayed notification: no change, no second transition.
    await handleCinetPayWebhook(db, { notify_token: `notify-${order.merchantTransactionId}`, merchant_transaction_id: order.merchantTransactionId, transaction_id: order.providerTransactionId }, s.gateway.factory);
    const events = await db.select().from(paymentEvents).where(eq(paymentEvents.orderId, orderId));
    expect(events.filter((e) => e.kind === "status_changed")).toHaveLength(1);

    // Paid is final: a later FAILED from the provider does not downgrade it.
    s.gateway.state.get(order.merchantTransactionId)!.status = "FAILED";
    expect((await refreshOrderForUser(db, s.userId, orderId, s.gateway.factory)).status).toBe("paid");
  });

  it("rejects forged and malformed webhooks", async () => {
    const s = await shop();
    const { orderId } = await s.buy();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    s.gateway.state.get(order.merchantTransactionId)!.status = "SUCCESS";
    const forged = await handleCinetPayWebhook(db, { notify_token: "guess", merchant_transaction_id: order.merchantTransactionId, transaction_id: "x" }, s.gateway.factory).catch((e) => e);
    expect(forged).toBeInstanceOf(WebhookRejected);
    expect(forged.httpStatus).toBe(401);
    expect((await handleCinetPayWebhook(db, { foo: 1 }, s.gateway.factory).catch((e) => e)).httpStatus).toBe(400);
    expect((await handleCinetPayWebhook(db, { notify_token: "a", merchant_transaction_id: "NOPE", transaction_id: "b" }, s.gateway.factory).catch((e) => e)).httpStatus).toBe(404);
    const [after] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(after.status).toBe("pending");
  });

  it("records failed payments and provider outages without pretending success", async () => {
    const s = await shop();
    const { orderId } = await s.buy();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    s.gateway.state.get(order.merchantTransactionId)!.status = "FAILED";
    expect((await refreshOrderForUser(db, s.userId, orderId, s.gateway.factory)).status).toBe("failed");

    const down = await shop(fakeGateway());
    const broken = fakeGateway({ initFails: true });
    const err = await startCheckout(db, { site: { subdomain: "excel-2" }, path: "", sectionId: "commande", customer, ip: null }, broken.factory).catch((e) => e);
    expect(err).toBeInstanceOf(CheckoutError);
    expect(err.code).toBe("provider");
    const list = await listOrders(db, down.userId, down.workspaceId);
    expect(list[0].order).toMatchObject({ status: "failed", providerStatus: "INIT_ERROR" });
  });

  it("validates buyer data and limits repeated attempts", async () => {
    const s = await shop();
    const bad = await s.buy({ firstName: "A", lastName: "", email: "nope", phone: "0700" }).catch((e) => e);
    expect(bad).toBeInstanceOf(CheckoutError);
    expect(Object.keys(bad.fieldErrors).sort()).toEqual(["email", "firstName", "lastName", "phone"]);
    for (let i = 0; i < CHECKOUT_LIMIT_PER_10_MIN; i++) await s.buy(customer, "10.9.9.9");
    expect((await s.buy(customer, "10.9.9.9").catch((e) => e)).code).toBe("rate_limited");
  });

  it("refuses unknown forms, inactive products and other workspaces' data", async () => {
    const s = await shop();
    const missing = await startCheckout(db, { site: { subdomain: "excel" }, path: "", sectionId: "hero", customer, ip: null }, s.gateway.factory).catch((e) => e);
    expect(missing.code).toBe("unavailable");
    await setProductActive(db, s.userId, s.product.id, false);
    expect((await s.buy().catch((e) => e)).code).toBe("unavailable");

    const intruder = await makeUser("Intrus");
    expect(await listOrders(db, intruder.userId, intruder.workspaceId)).toEqual([]);
    await expect(listOrders(db, intruder.userId, s.workspaceId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(verifyProvider(db, intruder.userId, s.provider.id, s.gateway.factory)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("publication gate", () => {
  it("blocks a page whose order form cannot take a real payment", async () => {
    const u = await makeUser();
    const product = await createProduct(db, u.userId, u.workspaceId, { name: "Coaching", price: 25000, currency: "XAF" });
    const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "Coaching" });
    const page = await createPage(db, { userId: u.userId }, funnel.id, { name: "Vente", kind: "sales" });
    await addSection(db, { userId: u.userId }, page.id, 1, { id: "commande", type: "checkout", productId: product.id, buttonLabel: "Payer" });
    // No provider at all.
    await expect(publishPage(db, u.userId, page.id, { path: "", reviewConfirmed: true })).rejects.toThrow("XAF");
    // A verified provider in another currency does not help.
    const p = await saveProvider(db, u.userId, u.workspaceId, { country: "CI", environment: "sandbox", apiKey: "k", apiPassword: "p" });
    await verifyProvider(db, u.userId, p.id, fakeGateway().factory);
    await expect(publishPage(db, u.userId, page.id, { path: "", reviewConfirmed: true })).rejects.toThrow("XAF");
    const cm = await saveProvider(db, u.userId, u.workspaceId, { country: "CM", environment: "sandbox", apiKey: "k", apiPassword: "p" });
    await verifyProvider(db, u.userId, cm.id, fakeGateway().factory);
    await publishPage(db, u.userId, page.id, { path: "", reviewConfirmed: true });

    // A product from another workspace is never usable.
    const other = await makeUser("Autre");
    const foreign = await createProduct(db, other.userId, other.workspaceId, { name: "X", price: 100, currency: "XAF" });
    const problems = await checkoutProblems(db, u.workspaceId, {
      schemaVersion: 1,
      theme: { accent: "#1f5f4a", background: "light", font: "sans" },
      sections: [{ id: "c", type: "checkout", productId: foreign.id, buttonLabel: "Payer" }],
    });
    expect(problems[0]).toContain("introuvable");
    expect(await db.select().from(paymentProviders).where(eq(paymentProviders.workspaceId, other.workspaceId))).toEqual([]);
  });
});
