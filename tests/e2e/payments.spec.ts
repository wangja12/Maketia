import { expect, test, type Page } from "@playwright/test";

/*
 * Full purchase on a published page. The payment provider is the test-only stand-in
 * (tests/e2e/mock-cinetpay.mjs), speaking the CinetPay protocol: login, payment creation,
 * webhook with notify token, canonical status check.
 */

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "One full purchase run is enough; the forms are covered on mobile elsewhere.");
});

async function owner(page: Page) {
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill("Aminata");
  await page.getByLabel("E-mail").fill(`pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.test`);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Tunnels de vente" })).toBeVisible();
  return page.url();
}

test("connect CinetPay, sell a product from a published page, confirm through the webhook", async ({ page, browser }) => {
  const workspaceUrl = await owner(page);

  // 1. Provider account: wrong credentials are reported, right ones verified for real (login call).
  await page.getByRole("link", { name: "Paiements" }).click();
  await page.getByLabel("Pays du compte marchand").selectOption("CI");
  await page.getByLabel("Clé API (api_key)").fill("bad-key");
  await page.getByLabel("Mot de passe API (api_password)").fill("secret");
  await page.getByRole("button", { name: "Enregistrer le compte" }).click();
  await page.getByRole("button", { name: "Vérifier la connexion" }).click();
  await expect(page.getByText("Échec de connexion")).toBeVisible();
  await expect(page.getByText(/INVALID_CREDENTIALS/)).toBeVisible();

  await page.getByText("Ajouter ou remplacer un compte").click();
  await page.getByLabel("Clé API (api_key)").fill("test-key");
  await page.getByLabel("Mot de passe API (api_password)").fill("secret");
  await page.getByRole("button", { name: "Enregistrer le compte" }).click();
  await page.getByRole("button", { name: "Vérifier la connexion" }).click();
  await expect(page.getByText("Connexion vérifiée")).toBeVisible();

  // 2. Product.
  await page.getByLabel("Nom du produit").fill("E-book Excel");
  await page.getByLabel("Prix").fill("5000");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "E-book Excel" })).toBeVisible();

  // 3. Page with an order form, built in the editor.
  await page.goto(workspaceUrl);
  await page.getByLabel("Nouveau tunnel").fill("Excel");
  await page.getByRole("button", { name: "Créer le tunnel" }).click();
  await page.getByRole("link", { name: "Excel", exact: true }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Vente");
  await page.getByLabel("Modèle").selectOption("landing");
  await page.getByRole("button", { name: "Créer la page" }).click();
  await expect(page.getByRole("heading", { name: "Vente", level: 1 })).toBeVisible();
  const pageUrl = page.url();
  await page.getByRole("link", { name: "Modifier la page" }).click();
  await page.getByRole("button", { name: "Ajouter une section" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Commande et paiement/ }).click();
  await expect(page.getByText(/Non enregistré : 1 champ à corriger/)).toBeVisible();
  await page.getByRole("complementary", { name: "Propriétés" }).getByLabel("Produit vendu").selectOption({ label: "E-book Excel · 5000 XOF" });
  await expect(page.getByText("Enregistré · v2")).toBeVisible();

  // 4. Publish.
  await page.goto(pageUrl);
  const panel = page.getByRole("region", { name: "Publication" });
  for (const box of await panel.getByRole("checkbox").all()) await box.check();
  await panel.getByRole("button", { name: /Publier la version 2/ }).click();
  await expect(panel.getByText("Publié.")).toBeVisible();
  const publicUrl = (await panel.getByRole("link", { name: /localhost/ }).getAttribute("href"))!;

  // 5. A visitor buys. Server-side validation first, then the real flow.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(publicUrl);
  const form = visitor.locator("section#checkout");
  await expect(form.getByText("5 000 F CFA")).toBeVisible();
  await form.getByLabel("Prénom").fill("A");
  await form.getByLabel("Nom", { exact: true }).fill("Koné");
  await form.getByLabel("E-mail").fill("awa@exemple.test");
  await form.getByRole("button", { name: "Payer maintenant" }).click();
  await expect(visitor.locator("section#checkout").getByRole("alert")).toHaveText("Vérifiez vos informations puis réessayez.");
  await expect(visitor.getByText("Prénom : 2 caractères minimum")).toBeVisible();

  const retry = visitor.locator("section#checkout");
  await retry.getByLabel("Prénom").fill("Awa");
  await retry.getByLabel("Nom", { exact: true }).fill("Koné");
  await retry.getByLabel("E-mail").fill("awa@exemple.test");
  await retry.getByLabel(/Téléphone/).fill("+225 07 00 00 00 01");
  await retry.getByRole("button", { name: "Payer maintenant" }).click();

  // Provider page (stand-in), then back to the app: confirmed only after the status check.
  await expect(visitor.getByRole("heading", { name: "Simulateur de paiement — tests uniquement" })).toBeVisible();
  await expect(visitor.getByText("E-book Excel : 5000 XOF")).toBeVisible();
  await visitor.getByRole("button", { name: "Confirmer le paiement (simulateur)" }).click();
  await expect(visitor.getByRole("heading", { name: "Paiement confirmé" })).toBeVisible();
  await expect(visitor.getByText(/Référence : TIA[0-9A-F]{24}/)).toBeVisible();

  // 6. The owner sees a confirmed order, with its trail.
  await page.goto(`${workspaceUrl}/paiements`);
  const order = page.getByRole("listitem").filter({ hasText: "Awa Koné" });
  await expect(order.getByText("Payée (confirmée)")).toBeVisible();
  await expect(order.getByText("+2250700000001")).toBeVisible();
  await order.getByText("Historique du paiement").click();
  await expect(order.getByText(/Notification reçue \(authentifiée\)/)).toBeVisible();
  await expect(order.getByText(/Statut confirmé par le prestataire · SUCCESS/)).toBeVisible();
});

test("a refused payment never shows as paid", async ({ page, browser }) => {
  const workspaceUrl = await owner(page);
  await page.goto(`${workspaceUrl}/paiements`);
  await page.getByLabel("Clé API (api_key)").fill("test-key");
  await page.getByLabel("Mot de passe API (api_password)").fill("secret");
  await page.getByRole("button", { name: "Enregistrer le compte" }).click();
  await page.getByRole("button", { name: "Vérifier la connexion" }).click();
  await expect(page.getByText("Connexion vérifiée")).toBeVisible();
  await page.getByLabel("Nom du produit").fill("Coaching");
  await page.getByLabel("Prix").fill("15000");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Coaching" })).toBeVisible();

  await page.goto(workspaceUrl);
  await page.getByLabel("Nouveau tunnel").fill("Coaching");
  await page.getByRole("button", { name: "Créer le tunnel" }).click();
  await page.getByRole("link", { name: "Coaching", exact: true }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Vente");
  await page.getByRole("button", { name: "Créer la page" }).click();
  await expect(page.getByRole("heading", { name: "Vente", level: 1 })).toBeVisible();
  const pageUrl = page.url();
  await page.getByRole("link", { name: "Modifier la page" }).click();
  await page.getByRole("button", { name: "Ajouter une section" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Commande et paiement/ }).click();
  await page.getByRole("complementary", { name: "Propriétés" }).getByLabel("Produit vendu").selectOption({ label: "Coaching · 15000 XOF" });
  await expect(page.getByText("Enregistré · v2")).toBeVisible();
  await page.goto(pageUrl);
  const panel = page.getByRole("region", { name: "Publication" });
  for (const box of await panel.getByRole("checkbox").all()) await box.check();
  await panel.getByRole("button", { name: /Publier la version 2/ }).click();
  const publicUrl = (await panel.getByRole("link", { name: /localhost/ }).getAttribute("href"))!;

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(publicUrl);
  const form = visitor.locator("section#checkout");
  await form.getByLabel("Prénom").fill("Moussa");
  await form.getByLabel("Nom", { exact: true }).fill("Traoré");
  await form.getByLabel("E-mail").fill("moussa@exemple.test");
  await form.getByRole("button", { name: "Payer maintenant" }).click();
  await visitor.getByRole("button", { name: "Refuser le paiement (simulateur)" }).click();
  await expect(visitor.getByRole("heading", { name: "Paiement non abouti" })).toBeVisible();

  await page.goto(`${workspaceUrl}/paiements`);
  await expect(page.getByRole("listitem").filter({ hasText: "Moussa Traoré" }).getByText("Échouée")).toBeVisible();
});
