import type { Db } from "@/db";
import { platformSettings } from "@/db/schema";

/*
 * Seller payment links. A seller creates the link in their own SasPay account and pastes its
 * public URL here; the platform never calls SasPay for seller sales. The URL is only accepted on
 * hosts an administrator has listed after checking real SasPay links (no host is hard-coded,
 * because the link domain could not be confirmed from the documentation).
 */

export async function allowedLinkHosts(db: Db): Promise<string[]> {
  const [row] = await db.select({ hosts: platformSettings.saspayLinkHosts }).from(platformSettings);
  return row?.hosts ?? [];
}

export type LinkCheck = { ok: true; url: string } | { ok: false; reason: string };

/** HTTPS only, exact host from the allowlist, no credentials, no fragment tricks. */
export function checkPaymentLink(raw: string, hosts: string[]): LinkCheck {
  const value = raw.trim();
  if (!value) return { ok: false, reason: "Collez l’adresse publique de votre lien SasPay." };
  if (value.length > 500 || !URL.canParse(value)) return { ok: false, reason: "Adresse invalide." };
  const url = new URL(value);
  if (url.protocol !== "https:") return { ok: false, reason: "Le lien doit commencer par https://." };
  if (url.username || url.password) return { ok: false, reason: "Adresse invalide." };
  if (hosts.length === 0) {
    return { ok: false, reason: "Les liens SasPay ne sont pas encore acceptés : l’administrateur de la plateforme doit d’abord renseigner le domaine des liens SasPay." };
  }
  if (!hosts.includes(url.hostname.toLowerCase())) {
    return { ok: false, reason: `Ce n’est pas un lien SasPay reconnu (domaines acceptés : ${hosts.join(", ")}).` };
  }
  url.hash = "";
  return { ok: true, url: url.toString() };
}

export function normalizeHosts(input: string) {
  const hosts = input
    .split(/[\s,]+/)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const bad = hosts.filter((h) => !/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h));
  return { hosts: [...new Set(hosts)], bad };
}

export async function linkHostsConfigured(db: Db) {
  return (await allowedLinkHosts(db)).length > 0;
}


/** "Prêt" only when the link is set, its host still allowed and the price confirmed. */
export function linkStatus(product: { saspayLinkUrl: string | null; priceConfirmedAt: Date | null }, hosts: string[]) {
  if (!product.saspayLinkUrl) return { ready: false, label: "Lien absent" } as const;
  if (!checkPaymentLink(product.saspayLinkUrl, hosts).ok) return { ready: false, label: "Lien non reconnu" } as const;
  if (!product.priceConfirmedAt) return { ready: false, label: "Prix à confirmer" } as const;
  return { ready: true, label: "Lien configuré" } as const;
}
