import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/*
 * Launch checks across the main screens: accessibility (axe, WCAG 2.1 AA), layout at 360 px,
 * security headers and CSP, reduced motion. One account with real data is set up once.
 */

test.describe.configure({ mode: "serial" });

let screens: { name: string; url: string }[] = [];
let publicUrl = "";
let adminEmail = "";
let session: BrowserContext;

async function setup(page: Page) {
  adminEmail = `qualite-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.test`;
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill("Qualité");
  await page.getByLabel("E-mail").fill(adminEmail);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByLabel("Nouveau tunnel")).toBeVisible();
  const workspace = page.url();
  execFileSync("pnpm", ["-s", "admin:grant", adminEmail], { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } });

  await page.getByLabel("Nouveau tunnel").fill("Boutique qualité");
  await page.getByRole("button", { name: "Créer le tunnel" }).click();
  await page.getByRole("link", { name: "Boutique qualité", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Boutique qualité", level: 1 })).toBeVisible();
  const funnel = page.url();
  await page.getByLabel("Nom", { exact: true }).fill("Accueil");
  await page.getByLabel("Modèle").selectOption("sales");
  await page.getByRole("button", { name: "Créer la page" }).click();
  await expect(page.getByRole("heading", { name: "Accueil", level: 1 })).toBeVisible();
  const pageUrl = page.url();
  const panel = page.getByRole("region", { name: "Publication" });
  for (const box of await panel.getByRole("checkbox").all()) await box.check();
  await panel.getByRole("button", { name: /Publier la version 1/ }).click();
  await expect(panel.getByText("Publié.")).toBeVisible();
  publicUrl = (await panel.getByRole("link", { name: /localhost/ }).getAttribute("href"))!;

  screens = [
    { name: "tableau de bord", url: workspace },
    { name: "tunnel", url: funnel },
    { name: "page", url: pageUrl },
    { name: "éditeur", url: `${pageUrl}/editer` },
    { name: "statistiques", url: `${funnel}/statistiques` },
    { name: "tests A/B", url: `${funnel}/experiences` },
    { name: "contacts", url: `${workspace}/contacts` },
    { name: "paiements", url: `${workspace}/paiements` },
    { name: "agents IA", url: `${workspace}/agents` },
    { name: "abonnement", url: `${workspace}/abonnement` },
    { name: "admin", url: "/admin" },
    { name: "admin utilisateurs", url: "/admin/utilisateurs" },
    { name: "admin plans", url: "/admin/plans" },
    { name: "admin MCP", url: "/admin/mcp" },
    { name: "page publiée", url: publicUrl },
  ];
}

// One signed-in browser context (with the project's device settings) shared by the tests below.
test.beforeAll(async ({ browser }, testInfo) => {
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
  session = await browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  await setup(await session.newPage());
});

test.afterAll(async () => {
  await session?.close();
});

const publicScreens = [
  { name: "connexion", url: "/connexion" },
  { name: "inscription", url: "/inscription" },
];

test("no WCAG 2.1 AA violation on the main screens", async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await session.newPage();
  const anonymousContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const anonymous = await anonymousContext.newPage();
  for (const s of [...publicScreens.map((p) => ({ ...p, page: anonymous })), ...screens.map((p) => ({ ...p, page }))]) {
    await s.page.goto(s.url);
    await s.page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const summary = violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
    expect(summary, s.name).toEqual([]);
  }
  await anonymousContext.close();
});

test("no horizontal scrolling at 360 px wide", async () => {
  const page = await session.newPage();
  await page.setViewportSize({ width: 360, height: 780 });
  for (const s of [...publicScreens, ...screens]) {
    await page.goto(s.url);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, s.name).toBeLessThanOrEqual(0);
  }
});

test("security headers, nonce-based CSP, and no CSP violation in use", async () => {
  const page = await session.newPage();
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(m.text());
  });
  for (const url of [screens[0].url, `${screens[2].url}/editer`, publicUrl]) {
    const response = (await page.goto(url))!;
    await page.waitForLoadState("networkidle");
    const h = response.headers();
    expect(h["content-security-policy"], url).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
    // Every script Next.js rendered carries this request's nonce; a second load gets a new one.
    const nonce = h["content-security-policy"].match(/'nonce-([^']+)'/)![1];
    const scripts = await page.locator("script").evaluateAll((els) => els.map((e) => (e as HTMLScriptElement).nonce));
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.every((n) => n === nonce)).toBe(true);
  }
  // The app still works under the policy: the editor hydrates and autosaves.
  await page.goto(`${screens[2].url}/editer`);
  await expect(page.getByText(/Enregistré · v\d/)).toBeVisible();
  expect(violations).toEqual([]);

  const health = await page.request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
});

test("press feedback moves controls, except with reduced motion", async ({ browser }) => {
  const pressedTransform = async (p: Page) => {
    await p.goto("/connexion");
    const button = p.getByRole("button", { name: "Se connecter" });
    await button.hover();
    await p.mouse.down();
    await p.waitForTimeout(200);
    const t = await button.evaluate((el) => getComputedStyle(el).transform);
    await p.mouse.up();
    return t;
  };
  const baseURL = test.info().project.use.baseURL;
  const normal = await browser.newContext({ baseURL });
  expect(await pressedTransform(await normal.newPage())).toMatch(/^matrix\(0\.97/);
  const calm = await browser.newContext({ baseURL, reducedMotion: "reduce" });
  expect(await pressedTransform(await calm.newPage())).toBe("none");
  await normal.close();
  await calm.close();
});

test("performance budgets: fast server response, bounded JavaScript", async () => {
  // Measured on the production build: the published page is mostly the Next.js runtime
  // (~460 KB decoded, ~175 KB gzip). The budgets stop it from growing unnoticed.
  const budgets = [
    { name: "page publiée", url: publicUrl, maxJs: 520_000, maxHtml: 40_000 },
    { name: "tableau de bord", url: screens[0].url, maxJs: 560_000, maxHtml: 60_000 },
    { name: "éditeur", url: screens[3].url, maxJs: 720_000, maxHtml: 80_000 },
  ];
  const page = await session.newPage();
  for (const b of budgets) {
    await page.goto(b.url);
    await page.waitForLoadState("networkidle");
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const js = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((r) => r.name.endsWith(".js"));
      return { ttfb: nav.responseStart - nav.requestStart, html: nav.decodedBodySize, js: js.reduce((sum, r) => sum + r.decodedBodySize, 0) };
    });
    expect(m.ttfb, `${b.name} : temps de réponse`).toBeLessThan(500);
    expect(m.html, `${b.name} : HTML`).toBeLessThan(b.maxHtml);
    expect(m.js, `${b.name} : JavaScript`).toBeLessThan(b.maxJs);
  }
});
