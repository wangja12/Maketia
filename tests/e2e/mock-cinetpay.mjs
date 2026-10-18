// TEST-ONLY stand-in for the CinetPay API, following the protocol of the official PHP SDK
// (cinetpay/cinetpay-php-sdk 422244a). It is NOT CinetPay: it only lets end-to-end tests run
// the full checkout without network access to the real service.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const port = Number(process.env.MOCK_CINETPAY_PORT ?? 3199);
const base = `http://localhost:${port}`;
const tokens = new Set();
const payments = new Map(); // merchant_transaction_id -> payment

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};
const read = (req) => new Promise((resolve) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => resolve(data));
});
const authed = (req) => tokens.has((req.headers.authorization ?? "").replace(/^Bearer /, ""));

createServer(async (req, res) => {
  const url = new URL(req.url, base);
  const body = await read(req);

  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });

  if (req.method === "POST" && url.pathname === "/v1/oauth/login") {
    const { api_key, api_password } = JSON.parse(body || "{}");
    if (!api_key || !api_password || api_key === "bad-key") return send(res, 401, { code: 1001, status: "INVALID_CREDENTIALS" });
    const token = randomBytes(12).toString("hex");
    tokens.add(token);
    return send(res, 200, { code: 200, status: "OK", access_token: token, token_type: "bearer", expires_in: 300 });
  }

  if (req.method === "POST" && url.pathname === "/v1/payment") {
    if (!authed(req)) return send(res, 401, { code: 1002, status: "INVALID_TOKEN" });
    const p = JSON.parse(body);
    if (payments.has(p.merchant_transaction_id)) return send(res, 422, { code: 1200, status: "TRANSACTION_EXIST", description: "Transaction already exists" });
    const payment = { ...p, transaction_id: `cp-${randomBytes(6).toString("hex")}`, notify_token: randomBytes(16).toString("hex"), status: "INITIATED" };
    payments.set(p.merchant_transaction_id, payment);
    return send(res, 200, {
      code: 200, status: "OK",
      merchant_transaction_id: payment.merchant_transaction_id,
      transaction_id: payment.transaction_id,
      notify_token: payment.notify_token,
      payment_token: payment.transaction_id,
      payment_url: `${base}/pay/${payment.merchant_transaction_id}`,
      details: { code: 2001, status: "INITIATED", message: "Continue payment", must_be_redirected: true },
    });
  }

  const find = url.pathname.match(/^\/v1\/payment\/([^/]+)$/);
  if (req.method === "GET" && find) {
    if (!authed(req)) return send(res, 401, { code: 1002, status: "INVALID_TOKEN" });
    const p = payments.get(decodeURIComponent(find[1]));
    if (!p) return send(res, 404, { code: 404, status: "NOT_FOUND" });
    return send(res, 200, { code: p.status === "SUCCESS" ? 100 : 200, status: p.status, merchant_transaction_id: p.merchant_transaction_id, transaction_id: p.transaction_id });
  }

  const page = url.pathname.match(/^\/pay\/([^/]+)$/);
  if (req.method === "GET" && page) {
    const p = payments.get(page[1]);
    if (!p) return send(res, 404, { error: "unknown" });
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><title>Simulateur CinetPay (tests)</title>
      <h1>Simulateur de paiement — tests uniquement</h1>
      <p>${p.designation} : ${p.amount} ${p.currency}</p>
      <form method="post" action="/pay/${p.merchant_transaction_id}/success"><button>Confirmer le paiement (simulateur)</button></form>
      <form method="post" action="/pay/${p.merchant_transaction_id}/fail"><button>Refuser le paiement (simulateur)</button></form>`);
  }

  const act = url.pathname.match(/^\/pay\/([^/]+)\/(success|fail)$/);
  if (req.method === "POST" && act) {
    const p = payments.get(act[1]);
    p.status = act[2] === "success" ? "SUCCESS" : "FAILED";
    // Like CinetPay: notify the merchant server, then send the buyer back.
    await fetch(p.notify_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notify_token: p.notify_token, merchant_transaction_id: p.merchant_transaction_id, transaction_id: p.transaction_id, status: p.status }),
    }).catch((e) => console.error("webhook failed", e));
    res.writeHead(303, { location: act[2] === "success" ? p.success_url : p.failed_url });
    return res.end();
  }

  send(res, 404, { error: "not found" });
}).listen(port, () => console.log(`mock-cinetpay on ${base}`));
