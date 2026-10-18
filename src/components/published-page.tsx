import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageRenderer, type CheckoutTarget } from "@/components/page-renderer";
import { getDb } from "@/db";
import { productsForContent } from "@/server/payments/checks";
import { resolvePublishedPage, type PublicSite } from "@/server/publishing";

/** Messages for the ?paiement=<code> a failed checkout redirects back with. */
const CHECKOUT_MESSAGES: Record<string, string> = {
  invalid: "Vérifiez vos informations puis réessayez.",
  unavailable: "Le paiement en ligne n’est pas disponible pour le moment.",
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
  provider: "Le paiement n’a pas pu démarrer. Aucun montant n’a été débité. Réessayez plus tard.",
};

type Search = Record<string, string | string[] | undefined>;

/** Visitor-facing page: only live publications, no account, no editor code. */
export async function PublishedPage({ site, path, search }: { site: PublicSite; path?: string[]; search: Search }) {
  if (path && path.length > 1) notFound();
  const pagePath = path?.[0] ?? "";
  const page = await resolvePublishedPage(getDb(), site, pagePath);
  if (!page) notFound();
  const products = await productsForContent(getDb(), page.workspaceId, page.content);

  const code = typeof search.paiement === "string" ? search.paiement : undefined;
  const sectionId = typeof search.section === "string" ? search.section : "";
  const fields = typeof search.champs === "string" ? safeFields(search.champs) : undefined;
  const checkout: CheckoutTarget = {
    site: "subdomain" in site ? site.subdomain : site.hostname,
    siteKind: "subdomain" in site ? "subdomain" : "domain",
    path: pagePath,
    error: code && CHECKOUT_MESSAGES[code] ? { sectionId, message: CHECKOUT_MESSAGES[code], fields } : undefined,
  };
  return <PageRenderer content={page.content} products={products} checkout={checkout} />;
}

/** Field errors travel in the URL as JSON; only known keys and short strings are kept. */
function safeFields(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([k, v]) => ["firstName", "lastName", "email", "phone"].includes(k) && typeof v === "string" && v.length < 120),
    ) as Record<string, string>;
  } catch {
    return undefined;
  }
}

export async function publishedMetadata(site: PublicSite, path?: string[]): Promise<Metadata> {
  if (path && path.length > 1) return {};
  const page = await resolvePublishedPage(getDb(), site, path?.[0] ?? "");
  return page ? { title: page.title } : {};
}
