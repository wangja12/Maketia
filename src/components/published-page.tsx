import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageRenderer } from "@/components/page-renderer";
import { getDb } from "@/db";
import { resolvePublishedPage, type PublicSite } from "@/server/publishing";

/** Visitor-facing page: only live publications, no account, no editor code. */
export async function PublishedPage({ site, path }: { site: PublicSite; path?: string[] }) {
  if (path && path.length > 1) notFound();
  const page = await resolvePublishedPage(getDb(), site, path?.[0] ?? "");
  if (!page) notFound();
  return <PageRenderer content={page.content} />;
}

export async function publishedMetadata(site: PublicSite, path?: string[]): Promise<Metadata> {
  if (path && path.length > 1) return {};
  const page = await resolvePublishedPage(getDb(), site, path?.[0] ?? "");
  return page ? { title: page.title } : {};
}
