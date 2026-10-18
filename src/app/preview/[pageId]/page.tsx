import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageRenderer } from "@/components/page-renderer";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { NotFoundError } from "@/server/errors";
import { getPage } from "@/server/pages";
import { productsForContent } from "@/server/payments/checks";

// Private preview: only members of the page's workspace, never indexed.
export const metadata: Metadata = { title: "Aperçu privé", robots: { index: false, follow: false } };

export default async function PreviewPage({ params, searchParams }: PageProps<"/preview/[pageId]">) {
  const { pageId } = await params;
  const { v } = await searchParams;
  const user = await requireUser();
  const version = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined;
  const data = await getPage(getDb(), { userId: user.id }, pageId, version).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const products = await productsForContent(getDb(), data.funnel.workspaceId, data.version.content);
  return <PageRenderer content={data.version.content} products={products} />;
}
