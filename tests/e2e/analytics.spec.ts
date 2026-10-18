import { expect, test, type Browser, type Page } from "@playwright/test";

async function setup(page: Page) {
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill("Awa");
  await page.getByLabel("E-mail").fill(`ab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.test`);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nouveau tunnel").fill("Savons Awa");
  await page.getByRole("button", { name: "Créer le tunnel" }).click();
  await page.getByRole("link", { name: "Savons Awa" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Accueil");
  await page.getByLabel("Modèle").selectOption("landing");
  await page.getByRole("button", { name: "Créer la page" }).click();
  await expect(page.getByRole("heading", { name: "Accueil", level: 1 })).toBeVisible();
}

async function tickAll(scope: ReturnType<Page["getByRole"]>) {
  for (const box of await scope.getByRole("checkbox", { name: /./ }).all()) await box.check();
}

/** A fresh browser (own cookies), optionally refusing tracking. */
async function visit(browser: Browser, url: string, opts: { dnt?: boolean; click?: boolean } = {}) {
  const ctx = await browser.newContext(opts.dnt ? { extraHTTPHeaders: { DNT: "1" } } : {});
  const v = await ctx.newPage();
  // sendBeacon bodies are not exposed to Playwright: wait for the beacon's answer instead.
  const beacon = opts.dnt ? null : v.waitForResponse((r) => r.url().endsWith("/api/events"));
  await v.goto(url);
  await expect(v.getByRole("heading", { level: 1 })).toBeVisible();
  await beacon;
  if (opts.click) {
    const click = v.waitForResponse((r) => r.url().endsWith("/api/events"));
    await v.getByRole("link", { name: "Je commence" }).first().click();
    await click;
  }
  const cookies = (await ctx.cookies()).map((c) => c.name);
  await ctx.close();
  return cookies;
}

test("A/B test: draft, human start, random split, measured events, cautious results, human winner", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await setup(page);
  const pageA = page.url();
  await page.getByRole("button", { name: "Créer une variante" }).click();
  await expect(page.getByRole("link", { name: "Variante B" })).toHaveAttribute("aria-current", "page");

  // The test runs where the page is live: publish A first.
  await page.goto(pageA);
  const publication = page.getByRole("region", { name: "Publication" });
  await tickAll(publication);
  await publication.getByRole("button", { name: /Publier la version 1/ }).click();
  await expect(publication.getByText("Publié.")).toBeVisible();
  const publicUrl = (await publication.getByRole("link", { name: /\.localhost:3100\/$/ }).getAttribute("href"))!;

  // Draft: nothing changes for visitors until a person starts it.
  await page.getByRole("link", { name: "Tester ces variantes (A/B)" }).click();
  await expect(page.getByRole("heading", { name: "Tests A/B", level: 1 })).toBeVisible();
  await page.getByLabel("Nom de l’expérience").fill("Accroche");
  await page.getByLabel("Objectif mesuré").selectOption("cta_click");
  await page.getByRole("button", { name: "Créer le brouillon" }).click();
  await expect(page.getByRole("heading", { name: "Accroche", level: 1 })).toBeVisible();
  await expect(page.getByText(/^Brouillon · objectif : Clic/)).toBeVisible();

  const start = page.getByRole("button", { name: "Démarrer l’expérience" });
  await expect(start).toBeDisabled();
  await tickAll(page.getByRole("region", { name: "Démarrer" }));
  await start.click();
  await expect(page.getByText(/^En cours · objectif : Clic/)).toBeVisible();

  // Six visitors who accept measurement (three click), one who sends Do Not Track.
  for (let i = 0; i < 6; i++) expect(await visit(browser, publicUrl, { click: i % 2 === 0 })).toEqual(expect.arrayContaining(["tia_v", "tia_s"]));
  expect(await visit(browser, publicUrl, { dnt: true })).toEqual([]);

  // Results: everyone counted once, small sample flagged, no winner suggested.
  const results = page.getByRole("region", { name: "Résultats" });
  await expect(async () => {
    await page.reload();
    const visitors = await results.getByRole("row").evaluateAll((rows) =>
      rows.slice(1).reduce((s, r) => s + Number(r.children[1].textContent!.replace(/\s/g, "")), 0),
    );
    expect(visitors).toBe(6);
  }).toPass({ timeout: 15_000 });
  const conversions = await results.getByRole("row").evaluateAll((rows) =>
    rows.slice(1).reduce((s, r) => s + Number(r.children[2].textContent!.replace(/\s/g, "")), 0),
  );
  expect(conversions).toBe(3);
  await expect(results.getByText(/Données insuffisantes/)).toBeVisible();

  // Funnel statistics agree.
  await page.goto(page.url().split("/experiences/")[0] + "/statistiques");
  const totals = page.getByRole("region", { name: "Totaux" });
  await expect(totals.getByText("Visiteurs", { exact: true }).locator("..")).toContainText("6");
  await expect(totals.getByText("Clics sur un appel à l’action").locator("..")).toContainText("3");
  await expect(page.getByText(/refusé le suivi/)).toBeVisible();

  // A person picks the winner (warned the data is thin); it is published at the test address.
  await page.goBack();
  const winner = page.getByRole("region", { name: "Choisir le gagnant" });
  await expect(winner.getByText(/un choix maintenant repose sur le hasard/)).toBeVisible();
  const b = await winner.locator("option", { hasText: /^B · / }).getAttribute("value");
  await winner.getByLabel("Variante à publier").selectOption(b!);
  await tickAll(winner);
  await winner.getByRole("button", { name: "Publier cette variante et terminer" }).click();
  await expect(page.getByText(/^Terminée · objectif/)).toBeVisible();
  await expect(page.getByText("Gagnant publié :")).toBeVisible();
});
