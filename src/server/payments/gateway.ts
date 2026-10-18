import type { PaymentProvider } from "@/db/schema";
import { decryptSecret } from "../secrets";
import { CinetPayClient, FINAL_STATUSES, type CinetPayCountry } from "./cinetpay";

/*
 * Provider-neutral payment interface. The app only talks to this; each provider is an adapter.
 * Adding PayDunya (or another provider) means one more adapter, not changes to checkout code.
 */

export type GatewayPaymentRequest = {
  merchantTransactionId: string;
  amount: number;
  currency: string;
  designation: string;
  customer: { firstName: string; lastName: string; email: string; phone?: string };
  successUrl: string;
  failedUrl: string;
  notifyUrl: string;
};

export type GatewayStatus = {
  /** The provider's raw status code (e.g. SUCCESS, PENDING, FAILED). */
  status: string;
  merchantTransactionId: string;
  providerTransactionId: string;
  outcome: "paid" | "failed" | "expired" | "pending";
};

export interface PaymentGateway {
  /** Proves the credentials work by authenticating against the provider. */
  verifyConnection(): Promise<void>;
  createPayment(req: GatewayPaymentRequest): Promise<{ providerTransactionId: string; notifyToken: string | null; paymentUrl: string | null; status: string }>;
  /** The provider's canonical status: the only thing allowed to mark an order paid. */
  findPayment(merchantTransactionId: string): Promise<GatewayStatus>;
}

export type GatewayFactory = (provider: Pick<PaymentProvider, "provider" | "environment" | "country" | "credentials">) => PaymentGateway;

function outcomeOf(status: string): GatewayStatus["outcome"] {
  if (status === "SUCCESS") return "paid";
  if (status === "EXPIRED") return "expired";
  if (FINAL_STATUSES.has(status) && status !== "TRANSACTION_EXIST") return "failed";
  return "pending";
}

/** Test-only escape hatch to point the adapter at a local stand-in; refused unless explicitly allowed. */
function cinetpayBaseUrl() {
  return process.env.ALLOW_PROVIDER_BASE_URL_OVERRIDE === "1" ? process.env.CINETPAY_BASE_URL : undefined;
}

export const defaultGatewayFactory: GatewayFactory = (provider) => {
  if (provider.provider !== "cinetpay") throw new Error(`Unsupported provider ${provider.provider}`);
  const { apiKey, apiPassword } = JSON.parse(decryptSecret(provider.credentials)) as { apiKey: string; apiPassword: string };
  const client = new CinetPayClient({
    apiKey,
    apiPassword,
    country: provider.country as CinetPayCountry,
    environment: provider.environment,
    baseUrl: cinetpayBaseUrl(),
    // CinetPay expects webhooks answered within 10 s; keep our own calls under that.
    timeoutMs: 8_000,
  });
  return {
    async verifyConnection() {
      await client.authenticate(true);
    },
    async createPayment(req) {
      const r = await client.createPayment({
        currency: req.currency,
        merchantTransactionId: req.merchantTransactionId,
        amount: req.amount,
        successUrl: req.successUrl,
        failedUrl: req.failedUrl,
        notifyUrl: req.notifyUrl,
        language: "fr",
        designation: req.designation,
        clientFirstName: req.customer.firstName,
        clientLastName: req.customer.lastName,
        clientEmail: req.customer.email,
        clientPhoneNumber: req.customer.phone,
      });
      return { providerTransactionId: r.transactionId, notifyToken: r.notifyToken, paymentUrl: r.paymentUrl, status: r.status };
    },
    async findPayment(merchantTransactionId) {
      const r = await client.findPayment(merchantTransactionId);
      return { status: r.status, merchantTransactionId: r.merchantTransactionId, providerTransactionId: r.transactionId, outcome: outcomeOf(r.status) };
    },
  };
};
