/*
 * Public hosting settings, from the environment:
 * - APP_URL: where the application itself is served (https://app.example.com).
 * - PUBLIC_ROOT_DOMAIN: published funnels live at <subdomain>.<PUBLIC_ROOT_DOMAIN>.
 * - PUBLIC_DOMAIN_TARGET: host name customers point their CNAME to.
 * Anything missing is reported as not configured, never guessed.
 */

export type SiteConfig = { appUrl: URL | null; rootDomain: string | null; domainTarget: string | null };

export function siteConfig(): SiteConfig {
  const appUrl = process.env.APP_URL ? new URL(process.env.APP_URL) : null;
  return {
    appUrl,
    rootDomain: process.env.PUBLIC_ROOT_DOMAIN?.toLowerCase() || null,
    domainTarget: process.env.PUBLIC_DOMAIN_TARGET?.toLowerCase().replace(/\.$/, "") || null,
  };
}

/** Public address of a funnel's site, or null when no root domain is configured. */
export function subdomainUrl(subdomain: string, config = siteConfig()) {
  if (!config.rootDomain) return null;
  const protocol = config.appUrl?.protocol ?? "https:";
  const port = config.appUrl?.port ? `:${config.appUrl.port}` : "";
  return `${protocol}//${subdomain}.${config.rootDomain}${port}`;
}

export function pathUrl(base: string, path: string) {
  return path ? `${base}/${path}` : `${base}/`;
}
