import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { paymentProviders, products } from "@/db/schema";
import type { PageContent } from "../page-schema";
import { isUuid } from "../workspaces";
import { CINETPAY_COUNTRIES, type CinetPayCountry } from "./cinetpay";

/** Display data for products referenced by a page (preview, editor, published page). */
export async function productsForContent(db: Db, workspaceId: string, content: PageContent) {
  const ids = content.sections.flatMap((s) => (s.type === "checkout" && isUuid(s.productId) ? [s.productId] : []));
  if (ids.length === 0) return {};
  const rows = await db
    .select({ id: products.id, name: products.name, price: products.price, currency: products.currency, active: products.active })
    .from(products)
    .where(and(eq(products.workspaceId, workspaceId), inArray(products.id, ids)));
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

/**
 * Blocking problems with the order forms of a page, checked before publication:
 * a buyer must never meet a form that cannot take a real payment.
 */
export async function checkoutProblems(db: Db, workspaceId: string, content: PageContent): Promise<string[]> {
  const forms = content.sections.filter((s) => s.type === "checkout");
  if (forms.length === 0) return [];
  const problems: string[] = [];
  const known = await productsForContent(db, workspaceId, content);
  const providers = await db
    .select({ country: paymentProviders.country })
    .from(paymentProviders)
    .where(and(eq(paymentProviders.workspaceId, workspaceId), eq(paymentProviders.status, "verified")));
  const payable = new Set<string>(providers.map((p) => CINETPAY_COUNTRIES[p.country as CinetPayCountry]?.currency));
  for (const s of forms) {
    const product = known[s.productId];
    if (!product) problems.push(`Formulaire « ${s.id} » : produit introuvable dans cet espace.`);
    else if (!product.active) problems.push(`Formulaire « ${s.id} » : le produit « ${product.name} » est désactivé.`);
    else if (!payable.has(product.currency)) {
      problems.push(`Formulaire « ${s.id} » : aucun prestataire de paiement vérifié n’encaisse en ${product.currency}.`);
    }
  }
  return problems;
}

