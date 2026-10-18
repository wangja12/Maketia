import { describe, expect, it } from "vitest";
import { CinetPayClient, CinetPayError, parseWebhook, type CreatePaymentInput } from "@/server/payments/cinetpay";

/* Same scenarios and fixtures as the official SDK's tests (ClientWorkflowTest, CountryTest, WebhookServiceTest). */

type Call = { method: string; url: string; headers: Record<string, string>; body: unknown };

function fakeFetch(responses: [number, unknown][]) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ method: init.method!, url, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : undefined });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return new Response(JSON.stringify(next[1]), { status: next[0] });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const request: CreatePaymentInput = {
  currency: "XOF",
  merchantTransactionId: "ORDER-42",
  amount: 500,
  successUrl: "https://shop.example.com/payment/success",
  failedUrl: "https://shop.example.com/payment/failed",
  notifyUrl: "https://shop.example.com/webhooks/cinetpay",
  language: "fr",
  designation: "Commande #42",
  clientFirstName: "Jane",
  clientLastName: "Doe",
  clientEmail: "jane@example.com",
};

const client = (f: typeof fetch) => new CinetPayClient({ apiKey: "account-key", apiPassword: "account-password", country: "CI", environment: "sandbox", fetch: f });

describe("CinetPay client (official SDK contract)", () => {
  it("authenticates, then creates a payment with the bearer token", async () => {
    const { impl, calls } = fakeFetch([
      [200, { code: 200, status: "OK", access_token: "access-token", token_type: "bearer", expires_in: 300 }],
      [200, { code: 200, status: "OK", merchant_transaction_id: "ORDER-42", transaction_id: "cp-transaction", notify_token: "notify-secret", payment_token: "payment-token", payment_url: "https://secure.cinetpay.net/payment/payment-token", details: { code: 2001, status: "INITIATED", message: "Continue payment", must_be_redirected: true } }],
    ]);
    const payment = await client(impl).createPayment(request);
    expect(payment).toMatchObject({ merchantTransactionId: "ORDER-42", transactionId: "cp-transaction", notifyToken: "notify-secret", paymentUrl: "https://secure.cinetpay.net/payment/payment-token" });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["POST", "https://api.cinetpay.net/v1/oauth/login"],
      ["POST", "https://api.cinetpay.net/v1/payment"],
    ]);
    expect(calls[0].body).toEqual({ api_key: "account-key", api_password: "account-password" });
    expect(calls[1].headers.Authorization).toBe("Bearer access-token");
    expect(calls[1].body).toMatchObject({ currency: "XOF", merchant_transaction_id: "ORDER-42", amount: 500, lang: "fr", direct_pay: false });
    expect(calls[1].body).not.toHaveProperty("payment_method");
  });

  it("reuses the token and reads a nested token shape", async () => {
    const { impl, calls } = fakeFetch([
      [200, { code: 200, status: "OK", data: { token: "nested-token", expires_in: 300 } }],
      [200, { code: 100, status: "SUCCESS", merchant_transaction_id: "ORDER-42", transaction_id: "cp-transaction" }],
      [200, { code: 100, status: "SUCCESS", merchant_transaction_id: "ORDER-42", transaction_id: "cp-transaction" }],
    ]);
    const c = client(impl);
    expect((await c.findPayment("ORDER-42")).status).toBe("SUCCESS");
    await c.findPayment("ORDER-42");
    expect(calls).toHaveLength(3);
    expect(calls[1].url).toBe("https://api.cinetpay.net/v1/payment/ORDER-42");
    expect(calls[2].headers.Authorization).toBe("Bearer nested-token");
  });

  it("refreshes an expired token exactly once", async () => {
    const { impl, calls } = fakeFetch([
      [200, { code: 200, status: "OK", access_token: "old-token", expires_in: 300 }],
      [401, { code: 1003, status: "EXPIRED_TOKEN" }],
      [200, { code: 200, status: "OK", access_token: "new-token", expires_in: 300 }],
      [200, { code: 100, status: "PENDING", merchant_transaction_id: "A", transaction_id: "B" }],
    ]);
    expect((await client(impl).findPayment("A")).status).toBe("PENDING");
    expect(calls[3].headers.Authorization).toBe("Bearer new-token");

    const second = fakeFetch([
      [200, { code: 200, status: "OK", access_token: "old-token", expires_in: 300 }],
      [401, { code: 1003, status: "EXPIRED_TOKEN" }],
      [200, { code: 200, status: "OK", access_token: "new-token", expires_in: 300 }],
      [401, { code: 1002, status: "INVALID_TOKEN" }],
    ]);
    await expect(client(second.impl).findPayment("A")).rejects.toMatchObject({ kind: "authentication", apiStatus: "INVALID_TOKEN" });
    expect(second.calls).toHaveLength(4);
  });

  it("exposes 422 validation errors and bad credentials", async () => {
    const { impl } = fakeFetch([
      [200, { code: 200, status: "OK", access_token: "token", expires_in: 300 }],
      [422, { code: 1200, status: "TRANSACTION_EXIST", description: "Transaction already exists" }],
    ]);
    await expect(client(impl).createPayment(request)).rejects.toMatchObject({ kind: "validation", httpStatus: 422, apiCode: 1200, apiStatus: "TRANSACTION_EXIST", message: "Transaction already exists" });
    const bad = fakeFetch([[401, { code: 1001, status: "INVALID_CREDENTIALS" }]]);
    await expect(client(bad.impl).authenticate()).rejects.toMatchObject({ kind: "authentication", apiStatus: "INVALID_CREDENTIALS" });
  });

  it("validates country rules locally, before any network call", async () => {
    const { impl, calls } = fakeFetch([]);
    const c = client(impl);
    await expect(c.createPayment({ ...request, currency: "XAF" })).rejects.toThrow("XOF");
    await expect(c.createPayment({ ...request, paymentMethod: "OM_SN" })).rejects.toThrow("_CI");
    await expect(c.createPayment({ ...request, clientPhoneNumber: "+221770000000" })).rejects.toThrow("+225");
    await expect(c.createPayment({ ...request, merchantTransactionId: "x".repeat(31) })).rejects.toBeInstanceOf(CinetPayError);
    await expect(c.createPayment({ ...request, amount: 0 })).rejects.toBeInstanceOf(CinetPayError);
    expect(calls).toHaveLength(0);
  });

  it("reports network failures as transport errors", async () => {
    const failing = (async () => { throw new Error("getaddrinfo ENOTFOUND api.cinetpay.net"); }) as unknown as typeof fetch;
    await expect(client(failing).authenticate()).rejects.toMatchObject({ kind: "transport" });
  });

  it("parses webhooks by identifiers only", () => {
    expect(parseWebhook({ notify_token: "t", merchant_transaction_id: "M", transaction_id: "T", status: "FORGED" })).toEqual({ notifyToken: "t", merchantTransactionId: "M", transactionId: "T" });
    expect(() => parseWebhook({ merchant_transaction_id: "M", transaction_id: "T" })).toThrow("notify_token");
    expect(() => parseWebhook([])).toThrow();
  });
});
