import "server-only";
import { headers } from "next/headers";
import { subdomainUrl } from "@/server/site-config";

/**
 * Public base URL of a funnel's site. Without PUBLIC_ROOT_DOMAIN (no wildcard DNS yet),
 * sites stay reachable on the app host under /s/<subdomain>.
 */
export async function siteBaseUrl(subdomain: string) {
  const url = subdomainUrl(subdomain);
  if (url) return url;
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return `${origin.replace(/\/$/, "")}/s/${subdomain}`;
}
