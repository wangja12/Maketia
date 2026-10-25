import { randomBytes } from "node:crypto";
import { promises as dnsPromises } from "node:dns";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { domains } from "@/db/schema";
import { assertQuota, lockQuota } from "./billing/plans";
import { isUniqueViolation, NotFoundError, ValidationError } from "./errors";
import { requireFunnel } from "./funnels";
import { siteConfig, type SiteConfig } from "./site-config";
import { isUuid, requireMembership } from "./workspaces";

/*
 * Custom domains. A domain serves a funnel only once DNS proves both:
 *   1. ownership: TXT _tunnels-ia.<domain> = tunnels-ia-verify=<token>
 *   2. routing:   CNAME to PUBLIC_DOMAIN_TARGET (or A records equal to the target's)
 * Checks are real DNS lookups; the status shown is the result of the last one.
 * HTTPS certificates are issued by the hosting provider, which is not configured here.
 */

export const TXT_PREFIX = "_tunnels-ia";
export const txtValue = (token: string) => `tunnels-ia-verify=${token}`;

export type DnsResolver = {
  resolveTxt(name: string): Promise<string[][]>;
  resolveCname(name: string): Promise<string[]>;
  resolve4(name: string): Promise<string[]>;
};

export const systemResolver: DnsResolver = new dnsPromises.Resolver();

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((h) => h.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, ""))
  .refine((h) => h.length <= 253 && /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(h), "Nom de domaine invalide (ex. www.mon-site.com)")
  .refine((h) => !/^\d+(\.\d+){3}$/.test(h), "Utilise un nom de domaine, pas une adresse IP");

export async function addDomain(db: Db, userId: string, funnelId: string, input: unknown, config: SiteConfig = siteConfig()) {
  const funnel = await requireFunnel(db, userId, funnelId, "edit");
  const parsed = hostnameSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message, { hostname: parsed.error.issues[0].message });
  const hostname = parsed.data;
  if (config.rootDomain && (hostname === config.rootDomain || hostname.endsWith(`.${config.rootDomain}`))) {
    const message = "Les adresses de la plateforme ne sont pas des domaines personnalisés.";
    throw new ValidationError(message, { hostname: message });
  }
  const [row] = await db.transaction(async (tx) => {
    await lockQuota(tx, funnel.workspaceId, "customDomains");
    await assertQuota(tx, funnel.workspaceId, "customDomains");
    return tx
      .insert(domains)
      .values({ workspaceId: funnel.workspaceId, funnelId: funnel.id, hostname, verificationToken: randomBytes(16).toString("hex") })
      .onConflictDoNothing({ target: [domains.workspaceId, domains.hostname] })
      .returning();
  });
  if (!row) throw new ValidationError("Ce domaine est déjà ajouté dans cet espace.", { hostname: "Ce domaine est déjà ajouté dans cet espace." });
  return row;
}

export async function listDomains(db: Db, userId: string, funnelId: string) {
  const funnel = await requireFunnel(db, userId, funnelId, "read");
  return db.select().from(domains).where(eq(domains.funnelId, funnel.id)).orderBy(asc(domains.createdAt));
}

async function requireDomain(db: Db, userId: string, domainId: string) {
  if (!isUuid(domainId)) throw new NotFoundError();
  const [domain] = await db.select().from(domains).where(eq(domains.id, domainId));
  if (!domain) throw new NotFoundError();
  await requireMembership(db, userId, domain.workspaceId, "edit");
  return domain;
}

export async function removeDomain(db: Db, userId: string, domainId: string) {
  const domain = await requireDomain(db, userId, domainId);
  await db.delete(domains).where(eq(domains.id, domain.id));
  return domain;
}

function dnsErrorMessage(e: unknown, what: string) {
  const code = (e as { code?: string })?.code;
  if (code === "ENOTFOUND" || code === "ENODATA") return `${what} introuvable.`;
  return `Requête DNS impossible (${code ?? "erreur inconnue"}). Réessaie plus tard.`;
}

type Check = { ok: true } | { ok: false; status: "pending" | "misconfigured"; error: string };

async function checkDns(hostname: string, token: string, resolver: DnsResolver, config: SiteConfig): Promise<Check> {
  const txtName = `${TXT_PREFIX}.${hostname}`;
  try {
    const records = (await resolver.resolveTxt(txtName)).map((chunks) => chunks.join(""));
    if (!records.includes(txtValue(token))) {
      return { ok: false, status: "pending", error: `L’enregistrement TXT ${txtName} ne contient pas la valeur attendue.` };
    }
  } catch (e) {
    return { ok: false, status: "pending", error: `Enregistrement TXT ${txtName} : ${dnsErrorMessage(e, "enregistrement")}` };
  }

  if (!config.domainTarget) {
    return { ok: false, status: "misconfigured", error: "Propriété vérifiée, mais la cible DNS de la plateforme n’est pas configurée (PUBLIC_DOMAIN_TARGET). Le domaine ne peut pas encore être servi." };
  }
  const target = config.domainTarget;
  try {
    const cnames = await resolver.resolveCname(hostname).catch(() => [] as string[]);
    if (cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === target)) return { ok: true };
    const [mine, theirs] = await Promise.all([resolver.resolve4(hostname), resolver.resolve4(target)]);
    if (mine.length > 0 && mine.every((ip) => theirs.includes(ip))) return { ok: true };
    return { ok: false, status: "misconfigured", error: `Le domaine ne pointe pas vers la plateforme : ajoute un CNAME vers ${target}.` };
  } catch (e) {
    return { ok: false, status: "misconfigured", error: `Pointage du domaine : ${dnsErrorMessage(e, "aucun enregistrement CNAME ni A")} Ajoute un CNAME vers ${target}.` };
  }
}

/** Runs the DNS checks now and stores the outcome. A verified domain that stops pointing here is downgraded. */
export async function verifyDomain(db: Db, userId: string, domainId: string, resolver: DnsResolver = systemResolver, config: SiteConfig = siteConfig()) {
  const domain = await requireDomain(db, userId, domainId);
  const result = await checkDns(domain.hostname, domain.verificationToken, resolver, config);
  const values = result.ok
    ? { status: "verified" as const, lastError: null, verifiedAt: domain.verifiedAt ?? sql`now()` }
    : { status: result.status, lastError: result.error };
  try {
    const [updated] = await db
      .update(domains)
      .set({ ...values, lastCheckedAt: sql`now()` })
      .where(and(eq(domains.id, domain.id)))
      .returning();
    return updated;
  } catch (e) {
    if (isUniqueViolation(e)) {
      const [updated] = await db
        .update(domains)
        .set({ status: "misconfigured", lastError: "Ce domaine est déjà vérifié et utilisé par un autre espace.", lastCheckedAt: sql`now()` })
        .where(eq(domains.id, domain.id))
        .returning();
      return updated;
    }
    throw e;
  }
}
