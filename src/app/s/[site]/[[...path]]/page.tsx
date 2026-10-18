import { PublishedPage, publishedMetadata } from "@/components/published-page";

export async function generateMetadata({ params }: PageProps<"/s/[site]/[[...path]]">) {
  const { site, path } = await params;
  return publishedMetadata({ subdomain: site }, path);
}

export default async function SubdomainSite({ params, searchParams }: PageProps<"/s/[site]/[[...path]]">) {
  const { site, path } = await params;
  return <PublishedPage site={{ subdomain: site }} path={path} search={await searchParams} />;
}
