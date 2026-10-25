import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageRenderer, type FormTarget } from "@/components/page-renderer";
import { ViewTracker } from "@/components/view-tracker";
import { getDb } from "@/db";
import { signViewToken } from "@/server/analytics/tracking";
import { planOf } from "@/server/billing/plans";
import { productsForContent } from "@/server/payments/checks";
import { resolvePublishedPage, type PublicSite } from "@/server/publishing";

/** Messages for the ?paiement=<code> a failed checkout redirects back with. */
const CHECKOUT_MESSAGES: Record<string, string> = {
  invalid: "Vérifiez vos informations puis réessayez.",
  unavailable: "Le paiement en ligne n’est pas disponible pour le moment.",
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
};

/** Messages for the ?inscription=<code> a contact form redirects back with. */
const LEAD_MESSAGES: Record<string, string> = {
  invalid: "Vérifiez vos informations puis réessayez.",
  unavailable: "Ce formulaire n’est plus disponible.",
  rate_limited: "Trop d’envois depuis cette connexion. Réessayez dans quelques minutes.",
};

type Search = Record<string, string | string[] | undefined>;

/** Ids the proxy set for this visitor; absent when they opted out of tracking. */
async function trackingIds() {
  const h = await headers();
  return { visitorId: h.get("x-tia-visitor"), sessionId: h.get("x-tia-session") };
}

/** One resolution per request, so metadata and page always agree on the variant served. */
const resolve = cache(async (siteKey: string, path: string) => {
  const site: PublicSite = JSON.parse(siteKey);
  const { visitorId } = await trackingIds();
  return resolvePublishedPage(getDb(), site, path, visitorId);
});

/** Visitor-facing page: only live publications, no account, no editor code. */
export async function PublishedPage({ site, path, search }: { site: PublicSite; path?: string[]; search: Search }) {
  if (path && path.length > 1) notFound();
  const pagePath = path?.[0] ?? "";
  const page = await resolve(JSON.stringify(site), pagePath);
  if (!page) notFound();
  const [products, plan] = await Promise.all([productsForContent(getDb(), page.workspaceId, page.content), planOf(getDb(), page.workspaceId)]);

  const sectionId = typeof search.section === "string" ? search.section : "";
  const fields = typeof search.champs === "string" ? safeFields(search.champs) : undefined;
  const payment = typeof search.paiement === "string" ? CHECKOUT_MESSAGES[search.paiement] : undefined;
  const lead = typeof search.inscription === "string" ? search.inscription : undefined;
  const message = payment ?? (lead ? LEAD_MESSAGES[lead] : undefined);
  const forms: FormTarget = {
    site: "subdomain" in site ? site.subdomain : site.hostname,
    siteKind: "subdomain" in site ? "subdomain" : "domain",
    path: pagePath,
    error: message ? { sectionId, message, fields } : undefined,
    success: lead === "ok" ? { sectionId } : undefined,
    attribution: Object.fromEntries(
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
        .map((k) => [k, typeof search[k] === "string" ? (search[k] as string).slice(0, 100) : ""])
        .filter(([, v]) => v),
    ),
  };
  const { visitorId, sessionId } = await trackingIds();
  const token =
    visitorId && sessionId
      ? signViewToken({
          workspaceId: page.workspaceId,
          funnelId: page.funnelId,
          pageId: page.pageId,
          variantLabel: page.variantLabel,
          experimentId: page.experimentId,
          visitorId,
          sessionId,
        })
      : null;
  return (
    <>
      <PageRenderer content={page.content} products={products} forms={forms} />
      {/* Free (or not yet priced) plans carry a small credit; paid plans do not. */}
      {!plan.priceMonthly && <MadeWithMaketia />}
      {token && <ViewTracker token={token} />}
    </>
  );
}

/** Discreet credit under the page, in fixed colours so it reads on any page theme. */
function MadeWithMaketia() {
  const origin = process.env.APP_URL?.replace(/\/$/, "") ?? "";
  return (
    <p className="flex justify-center bg-[#f7f6f3] py-4">
      <a
        href={`${origin}/?utm_source=badge&utm_medium=page`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#e3e0d9] bg-white px-4 text-[13px] text-[#55524c] no-underline"
      >
        Page créée avec <span className="font-semibold text-[#1c1b19]">maketia<span className="text-[#1d5bd8]">.</span></span>
      </a>
    </p>
  );
}

/** Field errors travel in the URL as JSON; only known keys and short strings are kept. */
function safeFields(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([k, v]) => ["firstName", "lastName", "email", "phone", "consent"].includes(k) && typeof v === "string" && v.length < 120),
    ) as Record<string, string>;
  } catch {
    return undefined;
  }
}

export async function publishedMetadata(site: PublicSite, path?: string[]): Promise<Metadata> {
  if (path && path.length > 1) return {};
  const page = await resolve(JSON.stringify(site), path?.[0] ?? "");
  return page ? { title: page.title } : {};
}
