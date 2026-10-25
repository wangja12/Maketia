import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/*
 * Sale through a seller's own SasPay payment link. The platform never calls SasPay: the buyer
 * is sent to the link the seller pasted (a test domain here, so the SasPay page itself is not shown).
 */

const LINK_HOST = "pay.saspay-test.example";
const LINK = `https://${LINK_HOST}/l/ebook-excel`;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "One full purchase run is enough; the forms are covered on mobile elsewhere.");
});

async function owner(page: Page) {
  const email = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.test`;
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill("Aminata");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Tunnels de vente" })).toBeVisible();
  return { workspaceUrl: page.url(), email };
}

test("paste a SasPay link, sell from a published page, reconcile the notification by hand", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const { workspaceUrl, email } = await owner(page);

  // 0. A platform admin declares the SasPay link domain (here a test domain).
  execFileSync("pnpm", ["-s", "admin:grant", email], { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } });
  await page.goto("/admin/parametres");
  await page.getByLabel("Domaines des liens de paiement SasPay").fill(LINK_HOST);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();

  // 1. Product, then the link pasted from SasPay with the price confirmation. No API key anywhere.
  await page.goto(`${workspaceUrl}/paiements`);
  await expect(page.getByText(/aucune clé API/).first()).toBeVisible();
  await expect(page.getByLabel(/Clé API/)).toHaveCount(0);
  await page.getByLabel("Nom du produit").fill("E-book Excel");
  await page.getByLabel("Prix", { exact: true }).fill("5000");
  await page.getByLabel("Type").selectOption("digital_file");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  const product = page.getByRole("listitem").filter({ hasText: "E-book Excel" });
  await expect(product.getByText("Lien absent")).toBeVisible();
  await product.getByLabel("Lien public SasPay du produit").fill("https://evil.example/pay");
  await product.getByLabel(/Je confirme/).check();
  await product.getByRole("button", { name: "Enregistrer le lien" }).click();
  await expect(product.getByText(/pas un lien SasPay reconnu/)).toBeVisible();
  await product.getByLabel("Lien public SasPay du produit").fill(LINK);
  await product.getByLabel(/Je confirme/).check();
  await product.getByRole("button", { name: "Enregistrer le lien" }).click();
  await expect(product.getByText("Lien configuré")).toBeVisible();

  // 2. Webhook: unique URL to paste in SasPay, signing secret stored encrypted.
  const webhookUrl = await page.getByLabel("Adresse de notification (propre à votre espace)").inputValue();
  expect(webhookUrl).toMatch(/\/api\/webhooks\/saspay\/[A-Za-z0-9_-]{30,}$/);
  await page.getByLabel("Secret de signature du webhook").fill("whsec_test_0123456789abcdef");
  await page.getByRole("button", { name: "Enregistrer le secret" }).click();
  await expect(page.getByText("Secret enregistré, chiffré. Il ne sera plus affiché.")).toBeVisible();
  await expect(page.getByText("Webhook en attente de test")).toBeVisible();

  // 3. Order form on a page, published.
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
  await page.getByRole("complementary", { name: "Propriétés" }).getByLabel("Produit vendu").selectOption({ label: "E-book Excel · 5000 XOF" });
  await expect(page.getByText("Enregistré · v2")).toBeVisible();
  await page.goto(pageUrl);
  const panel = page.getByRole("region", { name: "Publication" });
  for (const box of await panel.getByRole("checkbox").all()) await box.check();
  await panel.getByRole("button", { name: /Publier la version 2/ }).click();
  await expect(panel.getByText("Publié.")).toBeVisible();
  const publicUrl = (await panel.getByRole("link", { name: /localhost/ }).getAttribute("href"))!;

  // 4. A buyer orders: server-side validation, then sent to the seller's SasPay link.
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(`${publicUrl}?utm_source=facebook&utm_campaign=lancement`);
  const form = visitor.locator("section#checkout");
  await form.getByLabel("Prénom").fill("A");
  await form.getByLabel("Nom", { exact: true }).fill("Koné");
  await form.getByLabel(/E-mail/).fill("awa@exemple.test");
  await form.getByRole("button", { name: "Payer maintenant" }).click();
  await expect(visitor.getByText("Prénom : 2 caractères minimum")).toBeVisible();
  const retry = visitor.locator("section#checkout");
  await retry.getByLabel("Prénom").fill("Awa");
  await retry.getByLabel("Nom", { exact: true }).fill("Koné");
  await retry.getByLabel(/E-mail/).fill("awa@exemple.test");
  // The test link host does not exist: the browser lands on an error page, but at the seller's link.
  const redirect = visitor.waitForRequest((r) => r.url() === LINK);
  await retry.getByRole("button", { name: "Payer maintenant" }).click();
  await redirect;
  await visitorContext.close();

  // 5. The order is pending: nothing the buyer's browser did marks it paid.
  await page.goto(`${workspaceUrl}/paiements`);
  const order = page.getByRole("listitem").filter({ hasText: "Awa Koné" });
  await expect(order.getByText("Paiement en attente")).toBeVisible();

  // 6. A notification arrives on the seller's URL: stored, not trusted, to reconcile by hand.
  const posted = await page.request.post(webhookUrl, { data: { type: "transaction.success", data: { id: "tx_e2e", status: "SUCCESS", amount: 5000, currency: "XOF" } } });
  expect(posted.status()).toBe(200);
  expect((await page.request.post(webhookUrl.replace(/[^/]+$/, "jeton-inconnu-jeton-inconnu-1"), { data: {} })).status()).toBe(404);
  await page.reload();
  await expect(page.getByRole("heading", { name: "À rapprocher (1)" })).toBeVisible();
  await expect(page.getByText(/référence annoncée : tx_e2e/)).toBeVisible();
  await expect(order.getByText("Paiement en attente")).toBeVisible();

  const queue = page.getByRole("listitem").filter({ hasText: "tx_e2e" });
  await queue.getByRole("button", { name: "Rapprocher et confirmer" }).click();
  await expect(queue.getByText(/Cochez la confirmation/)).toBeVisible();
  await queue.getByRole("checkbox").check();
  await queue.getByRole("button", { name: "Rapprocher et confirmer" }).click();
  await expect(page.getByRole("heading", { name: "À rapprocher (0)" })).toBeVisible();
  await expect(order.getByText("Payée (confirmée par vous)")).toBeVisible();
  await order.getByText("Historique").click();
  await expect(order.getByText(/Paiement confirmé manuellement/)).toBeVisible();

  // 7. Delivery by hand: attach the private file, create the buyer's link, check what it serves.
  const products = page.getByRole("region", { name: "Produits et liens de paiement" });
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  await products.getByLabel("Fichier à livrer").setInputFiles({ name: "piege.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html><script>alert(1)</script>") });
  await products.getByRole("button", { name: "Envoyer le fichier" }).click();
  await expect(products.getByText(/Type de fichier non accepté/)).toBeVisible();
  await products.getByLabel("Fichier à livrer").setInputFiles({ name: "Guide Excel.pdf", mimeType: "application/pdf", buffer: pdf });
  await products.getByRole("button", { name: "Envoyer le fichier" }).click();
  await expect(products.getByText("Fichier enregistré.")).toBeVisible();
  await expect(products.getByText("Guide Excel.pdf", { exact: true })).toBeVisible();

  await order.getByRole("button", { name: "Liens de téléchargement" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Créer les liens" }).click();
  const link = await dialog.getByLabel("Guide Excel.pdf").inputValue();
  expect(link).toMatch(/\/api\/telechargement\/[A-Za-z0-9_-]{43}$/);
  // One tap hands the message to WhatsApp; nothing is sent by the app itself.
  const whatsapp = new URL((await dialog.getByRole("link", { name: "Envoyer sur WhatsApp" }).getAttribute("href"))!);
  expect(whatsapp.origin).toBe("https://wa.me");
  expect(whatsapp.searchParams.get("text")).toContain(link);
  const download = await page.request.get(link);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toContain("attachment");
  expect((await download.body()).toString()).toBe(pdf.toString());
  expect((await page.request.get(`${link.slice(0, -1)}x`)).status()).toBe(404);
  await dialog.getByRole("button", { name: "Fermer" }).click();
  await page.reload();
  await expect(order.getByText(/Guide Excel.pdf · 1\/5 téléchargements/)).toBeVisible();
});
