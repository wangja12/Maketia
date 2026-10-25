import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill("Fatou");
  await page.getByLabel("E-mail").fill(`pub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.test`);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nouvelle offre").fill("Boutique Fatou");
  await page.getByRole("button", { name: "Créer l’offre" }).click();
  await page.getByRole("link", { name: "Boutique Fatou" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Accueil");
  await page.getByLabel("Modèle").selectOption("landing");
  await page.getByRole("button", { name: "Créer la page" }).click();
  await expect(page.getByRole("heading", { name: "Accueil", level: 1 })).toBeVisible();
}

const panel = (page: Page) => page.getByRole("region", { name: "Publication" });

async function publish(page: Page, label: RegExp) {
  const p = panel(page);
  const button = p.getByRole("button", { name: label });
  await expect(button).toBeDisabled();
  for (const box of await p.getByRole("checkbox").all()) await box.check();
  await button.click();
  await expect(p.getByText("Publié.")).toBeVisible();
}

test("publish on a subdomain, keep the snapshot, republish, unpublish", async ({ page, context }) => {
  await setup(page);
  const pageUrl = page.url();
  await expect(panel(page).getByText("Pas en ligne.")).toBeVisible();

  await publish(page, /Publier la version 1/);
  const link = panel(page).getByRole("link", { name: /\.localhost:3100\/$/ });
  await expect(link).toBeVisible();
  const publicUrl = (await link.getAttribute("href"))!;
  expect(publicUrl).toMatch(/^http:\/\/boutique-fatou(-\d+)?\.localhost:3100\/$/);

  // A visitor (no session) sees the page on the subdomain.
  const visitor = await context.browser()!.newContext();
  const v = await visitor.newPage();
  await v.goto(publicUrl);
  await expect(v.getByRole("heading", { name: "Votre promesse principale, en une phrase" })).toBeVisible();
  await expect(v).toHaveTitle("Votre promesse principale, en une phrase");
  await expect(v.getByRole("textbox")).toHaveCount(0);
  // Free (unpriced) plan: the page carries the discreet Maketia credit.
  await expect(v.getByRole("link", { name: "Page créée avec maketia." })).toHaveAttribute("href", /utm_source=badge/);

  // Edit in the editor: what is live does not change until republished.
  await page.getByRole("link", { name: "Modifier la page" }).click();
  const headline = page.getByRole("main", { name: "Page en cours d’édition" }).getByRole("textbox", { name: "Titre principal" });
  await headline.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Les pagnes de Fatou");
  await expect(page.getByText("Enregistré · v2")).toBeVisible();
  await v.reload();
  await expect(v.getByRole("heading", { name: "Votre promesse principale, en une phrase" })).toBeVisible();

  await page.goto(pageUrl);
  await expect(panel(page).getByText("La version actuelle (v2) n’est pas encore en ligne.")).toBeVisible();
  await publish(page, /Publier la version 2/);
  await v.reload();
  await expect(v.getByRole("heading", { name: "Les pagnes de Fatou" })).toBeVisible();

  // Unpublish (with confirmation): the visitor gets a 404.
  await panel(page).getByRole("button", { name: "Dépublier" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Dépublier" }).click();
  await expect(panel(page).getByText("Pas en ligne.")).toBeVisible();
  const response = await v.goto(publicUrl);
  expect(response?.status()).toBe(404);
  await expect(v.getByText("Page introuvable")).toBeVisible();
  await visitor.close();

  // The funnel keeps the full history.
  await page.goto(pageUrl.split("/pages/")[0]);
  await page.getByText(/Historique des publications \(2\)/).click();
  await expect(page.getByText(/Accueil A v2 sur \/ par Fatou · retirée/)).toBeVisible();
});

test("custom domain: DNS instructions, real check, not active until verified", async ({ page }) => {
  await setup(page);
  await page.goto(page.url().split("/pages/")[0]);
  await page.getByLabel("Ajouter un domaine").fill("https://WWW.Pagnes-Fatou.test/");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  const item = page.getByRole("listitem").filter({ hasText: "www.pagnes-fatou.test" });
  await expect(item.getByText("En attente de vérification")).toBeVisible();
  await expect(item.getByRole("cell", { name: "_tunnels-ia.www.pagnes-fatou.test" })).toBeVisible();
  await expect(item.getByRole("cell", { name: /^tunnels-ia-verify=[0-9a-f]{32}$/ })).toBeVisible();
  await expect(item.getByRole("cell", { name: "cname.tunnels-ia.test" })).toBeVisible();

  // The .test TLD never resolves: the real lookup fails and the domain stays inactive.
  await item.getByRole("button", { name: "Vérifier maintenant" }).click();
  await expect(item.getByRole("alert")).toContainText("TXT _tunnels-ia.www.pagnes-fatou.test");
  await expect(item.getByText("En attente de vérification")).toBeVisible();

  await page.getByLabel("Ajouter un domaine").fill("shop.localhost");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Les adresses de la plateforme ne sont pas des domaines personnalisés.")).toBeVisible();
});
