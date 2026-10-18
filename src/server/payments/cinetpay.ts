/*
 * CinetPay REST client (API v1 with OAuth bearer tokens).
 *
 * Ported from the official PHP SDK, github.com/cinetpay/cinetpay-php-sdk at commit
 * 422244a83eaf2ec4675201615a3a351a85ac8315 (2026-08-11, MIT): same endpoints, payloads,
 * validation and token refresh rule. It has not been run against CinetPay's servers yet
 * (no merchant account, and the network was closed where it was written); tests replay the
 * SDK's own fixtures.
 */

export const CINETPAY_URLS = { sandbox: "https://api.cinetpay.net", production: "https://api.cinetpay.co" } as const;

export const CINETPAY_COUNTRIES = {
  CI: { name: "Côte d’Ivoire", currency: "XOF", callingCode: "+225" },
  BF: { name: "Burkina Faso", currency: "XOF", callingCode: "+226" },
  ML: { name: "Mali", currency: "XOF", callingCode: "+223" },
  SN: { name: "Sénégal", currency: "XOF", callingCode: "+221" },
  TG: { name: "Togo", currency: "XOF", callingCode: "+228" },
  GN: { name: "Guinée", currency: "GNF", callingCode: "+224" },
  CM: { name: "Cameroun", currency: "XAF", callingCode: "+237" },
  BJ: { name: "Bénin", currency: "XOF", callingCode: "+229" },
  CD: { name: "RD Congo", currency: "CDF", callingCode: "+243" },
  NE: { name: "Niger", currency: "XOF", callingCode: "+227" },
  TD: { name: "Tchad", currency: "XAF", callingCode: "+235" },
  CG: { name: "Congo", currency: "XAF", callingCode: "+242" },
  CF: { name: "République centrafricaine", currency: "XAF", callingCode: "+236" },
  GA: { name: "Gabon", currency: "XAF", callingCode: "+241" },
  GQ: { name: "Guinée équatoriale", currency: "XAF", callingCode: "+240" },
} as const;

export type CinetPayCountry = keyof typeof CINETPAY_COUNTRIES;

export type CinetPayConfig = {
  apiKey: string;
  apiPassword: string;
  country: CinetPayCountry;
  environment: "sandbox" | "production";
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export class CinetPayError extends Error {
  constructor(
    message: string,
    readonly kind: "authentication" | "validation" | "api" | "transport",
    readonly httpStatus?: number,
    readonly apiCode?: number,
    readonly apiStatus?: string,
  ) {
    super(message);
    this.name = "CinetPayError";
  }
}

type Json = Record<string, unknown>;

export type CreatePaymentInput = {
  currency: string;
  merchantTransactionId: string;
  amount: number;
  successUrl: string;
  failedUrl: string;
  notifyUrl: string;
  language: "fr" | "en";
  designation: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhoneNumber?: string;
  paymentMethod?: string;
};

export type PaymentInitialization = {
  code: number;
  status: string;
  merchantTransactionId: string;
  transactionId: string;
  notifyToken: string | null;
  paymentToken: string | null;
  paymentUrl: string | null;
};

export type PaymentStatus = { code: number; status: string; merchantTransactionId: string; transactionId: string };

/** Statuses after which CinetPay will not change the payment (SDK ApiStatus::isFinal). */
export const FINAL_STATUSES = new Set(["SUCCESS", "TRANSACTION_EXIST", "INSUFFICIENT_BALANCE", "FAILED"]);

const str = (d: Json, k: string, fallback = "") => (typeof d[k] === "string" ? (d[k] as string) : typeof d[k] === "number" ? String(d[k]) : fallback);
const int = (d: Json, k: string, fallback = 0) => (Number.isFinite(Number(d[k])) && d[k] !== null && d[k] !== "" ? Math.trunc(Number(d[k])) : fallback);
const nullableStr = (d: Json, k: string) => (typeof d[k] === "string" && d[k] !== "" ? (d[k] as string) : null);

function assertField(ok: boolean, message: string) {
  if (!ok) throw new CinetPayError(message, "validation");
}

/** Local checks done by the SDK before any network call. */
export function validatePaymentInput(country: CinetPayCountry, p: CreatePaymentInput) {
  const c = CINETPAY_COUNTRIES[country];
  assertField(p.currency === c.currency, `Devise ${p.currency} incompatible avec un compte ${c.name} (attendu : ${c.currency}).`);
  assertField(p.merchantTransactionId.length >= 1 && p.merchantTransactionId.length <= 30, "merchant_transaction_id : 1 à 30 caractères.");
  assertField(Number.isInteger(p.amount) && p.amount > 0, "Le montant doit être un entier positif.");
  for (const [name, url] of [["success_url", p.successUrl], ["failed_url", p.failedUrl], ["notify_url", p.notifyUrl]] as const) {
    assertField(URL.canParse(url) && url.length <= 120, `${name} : URL valide de 120 caractères au plus.`);
  }
  assertField(p.designation.trim() !== "", "La désignation est obligatoire.");
  assertField(p.clientFirstName.length >= 2 && p.clientFirstName.length <= 255, "Prénom : 2 caractères minimum.");
  assertField(p.clientLastName.length >= 2 && p.clientLastName.length <= 255, "Nom : 2 caractères minimum.");
  assertField(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.clientEmail), "Adresse e-mail invalide.");
  if (p.paymentMethod !== undefined) assertField(p.paymentMethod.endsWith(`_${country}`), `Moyen de paiement attendu avec le suffixe _${country}.`);
  if (p.clientPhoneNumber !== undefined) {
    assertField(/^\+[1-9][0-9]{7,14}$/.test(p.clientPhoneNumber), "Téléphone au format international (+225…).");
    assertField(p.clientPhoneNumber.startsWith(c.callingCode), `Le numéro doit commencer par ${c.callingCode}.`);
  }
}

export class CinetPayClient {
  private token: { value: string; expiresAt: number } | null = null;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: CinetPayConfig) {
    if (!config.apiKey.trim() || !config.apiPassword.trim()) throw new CinetPayError("Identifiants CinetPay manquants.", "validation");
    this.baseUrl = (config.baseUrl ?? CINETPAY_URLS[config.environment]).replace(/\/$/, "");
    this.fetchImpl = config.fetch ?? fetch;
  }

  private async request(method: "GET" | "POST", path: string, payload?: Json, bearer?: string): Promise<Json> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/${path.replace(/^\//, "")}`, {
        method,
        headers: {
          Accept: "application/json",
          "User-Agent": "tunnels-ia (cinetpay-php-sdk/2.0 port)",
          ...(payload ? { "Content-Type": "application/json" } : {}),
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
      });
    } catch (e) {
      throw new CinetPayError(`CinetPay injoignable : ${(e as Error).message}`, "transport");
    }
    const body = await response.text();
    let data: Json = {};
    if (body !== "") {
      try {
        const decoded = JSON.parse(body);
        if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) throw new Error("not an object");
        data = decoded as Json;
      } catch {
        throw new CinetPayError("Réponse CinetPay invalide (JSON attendu).", "api", response.status);
      }
    }
    const apiCode = Number.isFinite(Number(data.code)) && data.code !== undefined ? Number(data.code) : undefined;
    const apiStatus = typeof data.status === "string" ? data.status : undefined;
    const message = ["description", "message", "status"].map((k) => data[k]).find((v) => typeof v === "string" && v !== "") as string | undefined;
    const text = message ?? (response.statusText || "Échec de la requête CinetPay.");
    if (response.status === 401 || ["INVALID_CREDENTIALS", "INVALID_TOKEN", "EXPIRED_TOKEN"].includes(apiStatus ?? "")) {
      throw new CinetPayError(text, "authentication", response.status, apiCode, apiStatus);
    }
    if (response.status === 422) throw new CinetPayError(text, "validation", 422, apiCode, apiStatus);
    if (response.status < 200 || response.status >= 300) throw new CinetPayError(text, "api", response.status, apiCode, apiStatus);
    return data;
  }

  /** POST /v1/oauth/login; tokens are reused until 30 s before expiry. */
  async authenticate(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.token && Date.now() < this.token.expiresAt) return this.token.value;
    this.token = null;
    let data: Json;
    try {
      data = await this.request("POST", "/v1/oauth/login", { api_key: this.config.apiKey, api_password: this.config.apiPassword });
    } catch (e) {
      if (e instanceof CinetPayError && e.kind !== "transport") throw new CinetPayError(e.message, "authentication", e.httpStatus, e.apiCode, e.apiStatus);
      throw e;
    }
    const nested = typeof data.data === "object" && data.data !== null ? (data.data as Json) : {};
    const value = str(data, "access_token", str(nested, "token"));
    if (!value) throw new CinetPayError("La réponse d’authentification ne contient pas de jeton.", "authentication", 200);
    const expiresIn = Math.max(0, int(data, "expires_in", int(nested, "expires_in", 300)));
    this.token = { value, expiresAt: Date.now() + Math.max(0, expiresIn - 30) * 1000 };
    return value;
  }

  /** Authenticated call; a rejected token is refreshed exactly once. */
  private async authed(method: "GET" | "POST", path: string, payload?: Json) {
    const token = await this.authenticate();
    try {
      return await this.request(method, path, payload, token);
    } catch (e) {
      if (!(e instanceof CinetPayError) || e.kind !== "authentication") throw e;
      return this.request(method, path, payload, await this.authenticate(true));
    }
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentInitialization> {
    validatePaymentInput(this.config.country, input);
    const payload: Json = {
      currency: input.currency,
      payment_method: input.paymentMethod,
      merchant_transaction_id: input.merchantTransactionId,
      amount: input.amount,
      success_url: input.successUrl,
      failed_url: input.failedUrl,
      notify_url: input.notifyUrl,
      lang: input.language,
      designation: input.designation,
      client_first_name: input.clientFirstName,
      client_last_name: input.clientLastName,
      client_phone_number: input.clientPhoneNumber,
      client_email: input.clientEmail,
      direct_pay: false,
    };
    for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
    const d = await this.authed("POST", "/v1/payment", payload);
    return {
      code: int(d, "code"),
      status: str(d, "status"),
      merchantTransactionId: str(d, "merchant_transaction_id"),
      transactionId: str(d, "transaction_id"),
      notifyToken: nullableStr(d, "notify_token"),
      paymentToken: nullableStr(d, "payment_token"),
      paymentUrl: nullableStr(d, "payment_url"),
    };
  }

  /** GET /v1/payment/{id}: the canonical status, the only source of truth for "paid". */
  async findPayment(transactionId: string): Promise<PaymentStatus> {
    if (!transactionId.trim()) throw new CinetPayError("Identifiant de transaction vide.", "validation");
    const d = await this.authed("GET", `/v1/payment/${encodeURIComponent(transactionId)}`);
    return { code: int(d, "code"), status: str(d, "status"), merchantTransactionId: str(d, "merchant_transaction_id"), transactionId: str(d, "transaction_id") };
  }
}

/** Webhook body: only identifiers and the notify token are used; any status in it is ignored. */
export function parseWebhook(raw: unknown): { notifyToken: string; merchantTransactionId: string; transactionId: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new CinetPayError("Corps de webhook invalide.", "validation");
  const d = raw as Json;
  const out = { notifyToken: str(d, "notify_token"), merchantTransactionId: str(d, "merchant_transaction_id"), transactionId: str(d, "transaction_id") };
  if (!out.notifyToken) throw new CinetPayError('Webhook sans "notify_token".', "validation");
  if (!out.merchantTransactionId) throw new CinetPayError('Webhook sans "merchant_transaction_id".', "validation");
  if (!out.transactionId) throw new CinetPayError('Webhook sans "transaction_id".', "validation");
  return out;
}
