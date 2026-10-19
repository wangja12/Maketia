import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { PageRenderer } from "@/components/page-renderer";
import { backUrl } from "@/lib/public-forms";
import { checkProductionConfig } from "@/server/config-check";
import { pageContentSchema } from "@/server/page-schema";
import { templateFor } from "@/server/page-templates";

const withHero = (changes: Record<string, unknown>) => {
  const page = structuredClone(templateFor("landing"));
  Object.assign(page.sections[0], changes);
  return page;
};

describe("page content cannot carry script", () => {
  it("rejects javascript:, data: and protocol-relative links and images", () => {
    for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>", "//evil.test", "/\\evil.test", "vbscript:x"]) {
      expect(pageContentSchema.safeParse(withHero({ cta: { label: "Go", href } })).success, href).toBe(false);
    }
    for (const href of ["https://exemple.com", "/merci", "#offre"]) {
      expect(pageContentSchema.safeParse(withHero({ cta: { label: "Go", href } })).success, href).toBe(true);
    }
    expect(pageContentSchema.safeParse(withHero({ image: { url: "http://exemple.com/a.png", alt: "a" } })).success).toBe(false);
  });

  it("renders text fields as text, never as HTML", () => {
    const parsed = pageContentSchema.parse(withHero({ headline: `<img src=x onerror="alert(1)"><script>alert(1)</script>` }));
    const html = renderToStaticMarkup(createElement(PageRenderer, { content: parsed }));
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("public form redirects", () => {
  const req = (referer?: string) => new Request("https://boutique.tunnels.test/api/leads", { method: "POST", headers: referer ? { referer } : {} });
  it("go back only to the same host (no open redirect)", () => {
    expect(backUrl(req("https://boutique.tunnels.test/offre?x=1"), "/").href).toBe("https://boutique.tunnels.test/offre");
    expect(backUrl(req("https://evil.test/phish"), "/s/boutique/").href).toBe("https://boutique.tunnels.test/s/boutique/");
    expect(backUrl(req("javascript:alert(1)"), "/").href).toBe("https://boutique.tunnels.test/");
    expect(backUrl(req(), "/").host).toBe("boutique.tunnels.test");
  });
});

describe("production configuration check", () => {
  const good = {
    DATABASE_URL: "postgresql://db/prod",
    APP_URL: "https://app.tunnels.exemple",
    PAYMENT_SECRETS_KEY: Buffer.alloc(32, 1).toString("base64"),
    ANALYTICS_SECRET: "s".repeat(48),
    PUBLIC_ROOT_DOMAIN: "pages.exemple",
    PUBLIC_DOMAIN_TARGET: "cname.pages.exemple",
  };
  it("accepts a complete configuration", () => {
    expect(checkProductionConfig(good)).toEqual({ errors: [], warnings: [] });
  });
  it("blocks test switches, plain HTTP, bad keys and a shared test database", () => {
    const r = checkProductionConfig({
      ...good,
      APP_URL: "http://app.tunnels.exemple",
      ALLOW_PROVIDER_BASE_URL_OVERRIDE: "1",
      CINETPAY_BASE_URL: "http://localhost:3199",
      PAYMENT_SECRETS_KEY: "court",
      ANALYTICS_SECRET: "court",
      TEST_DATABASE_URL: good.DATABASE_URL,
    });
    expect(r.errors).toHaveLength(6);
  });
  it("warns about optional integrations that are off", () => {
    const { errors, warnings } = checkProductionConfig({ DATABASE_URL: "x", APP_URL: "https://a.exemple" });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(4);
  });
});
