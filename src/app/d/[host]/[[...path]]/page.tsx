import { PublishedPage, publishedMetadata } from "@/components/published-page";

export async function generateMetadata({ params }: PageProps<"/d/[host]/[[...path]]">) {
  const { host, path } = await params;
  return publishedMetadata({ hostname: decodeURIComponent(host) }, path);
}

export default async function CustomDomainSite({ params, searchParams }: PageProps<"/d/[host]/[[...path]]">) {
  const { host, path } = await params;
  return <PublishedPage site={{ hostname: decodeURIComponent(host) }} path={path} search={await searchParams} />;
}
