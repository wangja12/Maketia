import type { GatewayFactory, GatewayStatus } from "@/server/payments/gateway";

/** In-memory stand-in for the provider, following the adapter contract. */
export function fakeGateway(opts: { authFails?: boolean; initFails?: boolean } = {}) {
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
