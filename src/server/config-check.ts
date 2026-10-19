/*
 * Production configuration check. Pure (reads only the env object it is given), so the same
 * rules run at server start (logged) and in `pnpm check:prod` (blocking, before a deploy).
 */

export type ConfigReport = { errors: string[]; warnings: string[] };

type Env = Record<string, string | undefined>;

function base64Bytes(value: string) {
  try {
    return Buffer.from(value, "base64").length;
  } catch {
    return 0;
  }
}

export function checkProductionConfig(env: Env): ConfigReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!env.DATABASE_URL) errors.push("DATABASE_URL absent.");
  if (env.TEST_DATABASE_URL && env.TEST_DATABASE_URL === env.DATABASE_URL) {
    errors.push("TEST_DATABASE_URL est la base de production : les tests la videraient.");
  }

  if (!env.APP_URL) errors.push("APP_URL absent (adresse publique de l'application, utilisée pour les retours de paiement).");
  else if (!URL.canParse(env.APP_URL) || new URL(env.APP_URL).protocol !== "https:") errors.push("APP_URL doit être une adresse https://.");

  // Test-only switches that redirect payment calls: never in production.
  if (env.ALLOW_PROVIDER_BASE_URL_OVERRIDE) errors.push("ALLOW_PROVIDER_BASE_URL_OVERRIDE est défini : réservé aux tests, à retirer.");
  if (env.CINETPAY_BASE_URL) errors.push("CINETPAY_BASE_URL est défini : réservé aux tests, à retirer.");

  if (!env.PAYMENT_SECRETS_KEY) warnings.push("PAYMENT_SECRETS_KEY absent : aucun compte de paiement ne pourra être enregistré.");
  else if (base64Bytes(env.PAYMENT_SECRETS_KEY) !== 32) errors.push("PAYMENT_SECRETS_KEY doit faire 32 octets en base64 (openssl rand -base64 32).");

  if (!env.ANALYTICS_SECRET) warnings.push("ANALYTICS_SECRET absent : visites et clics ne seront pas mesurés.");
  else if (env.ANALYTICS_SECRET.length < 32) errors.push("ANALYTICS_SECRET doit faire au moins 32 caractères.");

  if (!env.PUBLIC_ROOT_DOMAIN) warnings.push("PUBLIC_ROOT_DOMAIN absent : les pages seront servies sous /s/<sous-domaine> au lieu de sous-domaines.");
  if (!env.PUBLIC_DOMAIN_TARGET) warnings.push("PUBLIC_DOMAIN_TARGET absent : les domaines personnalisés ne pourront pas être vérifiés.");
  if (env.APP_URL && env.PUBLIC_ROOT_DOMAIN && URL.canParse(env.APP_URL)) {
    const appHost = new URL(env.APP_URL).hostname;
    if (appHost === env.PUBLIC_ROOT_DOMAIN) warnings.push("APP_URL et PUBLIC_ROOT_DOMAIN identiques : l'application et les pages publiées partagent le même domaine (cookies). Préférez app.exemple.com et exemple-pages.com, ou un sous-domaine dédié.");
  }
  return { errors, warnings };
}
