import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { products } from "@/db/schema";
import type { PageContent } from "../page-schema";
import { isUuid } from "../workspaces";
import { allowedLinkHosts, linkStatus } from "./links";

/** Display data for products referenced by a page (preview, editor, published page). */
export async function productsForContent(db: Db, workspaceId: string, content: PageContent) {
  const ids = content.sections.flatMap((s) => (s.type === "checkout" && isUuid(s.productId) ? [s.productId] : []));
  if (ids.length === 0) return {};
  const rows = await db
    .select({ id: products.id, name: products.name, price: products.price, currency: products.currency, active: products.active, phoneRequired: products.phoneRequired })
    .from(products)
    .where(and(eq(products.workspaceId, workspaceId), inArray(products.id, ids)));
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

/**
 * Blocking problems with the order forms of a page, checked before publication:
 * a buyer must never meet a form that cannot send them to a real payment link.
 */
export async function checkoutProblems(db: Db, workspaceId: string, content: PageContent): Promise<string[]> {
  const forms = content.sections.filter((s) => s.type === "checkout");
  if (forms.length === 0) return [];
  const ids = forms.map((s) => s.productId).filter(isUuid);
  const rows = ids.length ? await db.select().from(products).where(and(eq(products.workspaceId, workspaceId), inArray(products.id, ids))) : [];
  const hosts = await allowedLinkHosts(db);
  const problems: string[] = [];
  for (const s of forms) {
    const product = rows.find((r) => r.id === s.productId);
    if (!product) problems.push(`Formulaire « ${s.id} » : produit introuvable dans cet espace.`);
    else if (!product.active) problems.push(`Formulaire « ${s.id} » : le produit « ${product.name} » est désactivé.`);
    else {
      const status = linkStatus(product, hosts);
      if (!status.ready) problems.push(`Formulaire « ${s.id} » : « ${product.name} » — ${status.label.toLowerCase()} (Paiements).`);
    }
  }
  return problems;
}
