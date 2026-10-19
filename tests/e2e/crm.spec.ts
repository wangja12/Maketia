import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function signUp(page: Page, name: string, email: string) {
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByLabel("Nouveau tunnel")).toBeVisible();
  return page.url();
}

/** A separate browser; a distinct client IP so per-IP limits do not carry over between runs. */
async function newVisitor(browser: Browser) {
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
  return (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } })).newPage();
}

test("a visitor's contact form lands in the CRM: tags, status, segment, export, erasure", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const workspaceUrl = await signUp(page, "Mariam", `crm-${unique()}@exemple.test`);
  await page.getByLabel("Nouveau tunnel").fill("Coaching");
  await page.getByRole("button", { name: "Créer le tunnel" }).click();
  await page.getByRole("link", { name: "Coaching", exact: true }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Inscription");
  await page.getByLabel("Modèle").selectOption("landing");
  await page.getByRole("button", { name: "Créer la page" }).click();
  await expect(page.getByRole("heading", { name: "Inscription", level: 1 })).toBeVisible();
  const pageUrl = page.url();

  // Contact form added in the editor (no AI involved), then published by a person.
  await page.getByRole("link", { name: "Modifier la page" }).click();
  await page.getByRole("button", { name: "Ajouter une section" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Formulaire de contact/ }).click();
  await page.getByRole("complementary", { name: "Propriétés" }).getByLabel("Téléphone").selectOption("required");
  // Both changes land in one autosave.
  await expect(page.getByText("Enregistré · v2")).toBeVisible();
  await expect(page.getByRole("main", { name: "Page en cours d’édition" }).getByLabel("Téléphone (ex. +225…)")).toBeVisible();
  await page.goto(pageUrl);
  const panel = page.getByRole("region", { name: "Publication" });
  for (const box of await panel.getByRole("checkbox").all()) await box.check();
  await panel.getByRole("button", { name: /Publier la version 2/ }).click();
  await expect(panel.getByText("Publié.")).toBeVisible();
  const publicUrl = (await panel.getByRole("link", { name: /localhost/ }).getAttribute("href"))!;

  // A visitor signs up; a bad phone is refused by the server and explained.
  const v = await newVisitor(browser);
  await v.goto(publicUrl);
  const form = v.locator("form[action='/api/leads']");
  await form.getByLabel("Prénom").fill("Aïcha");
  await form.getByLabel("E-mail").fill("aicha@exemple.test");
  await form.getByLabel(/Téléphone/).fill("0700");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Envoyer" }).click();
  await expect(v.getByText("Téléphone au format international, ex. +2250700000000")).toBeVisible();
  const retry = v.locator("form[action='/api/leads']");
  await retry.getByLabel("Prénom").fill("Aïcha");
  await retry.getByLabel("E-mail").fill("aicha@exemple.test");
  await retry.getByLabel(/Téléphone/).fill("+225 07 11 22 33 44");
  await retry.getByRole("checkbox").check();
  await retry.getByRole("button", { name: "Envoyer" }).click();
  await expect(v.getByRole("status").filter({ hasText: "Merci ! Nous vous recontactons très vite." })).toBeVisible();
  await v.context().close();

  // The owner finds them in Contacts, with where they came from.
  await page.goto(workspaceUrl);
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Contacts" }).click();
  await expect(page.getByRole("heading", { name: "Contacts", level: 1 })).toBeVisible();
  await expect(page.getByText("1 contact", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Aïcha/ }).click();
  await expect(page.getByRole("heading", { name: "Aïcha", level: 1 })).toBeVisible();
  await expect(page.getByText("+2250711223344")).toBeVisible();
  await expect(page.getByText("Inscription · variante A")).toBeVisible();
  await expect(page.getByText(/^Donné le/)).toBeVisible();

  await page.getByLabel("Nouveau tag").fill("VIP");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("list", { name: "Tags" }).getByText("vip")).toBeVisible();
  await page.getByLabel("Statut").selectOption("customer");
  await page.getByRole("button", { name: "Changer" }).click();
  await expect(page.getByText("Prospect → Client")).toBeVisible();
  const contactUrl = page.url();

  // Filter, save as a dynamic segment, export what is filtered.
  await page.getByRole("link", { name: "← Contacts" }).click();
  await expect(page.getByRole("heading", { name: "Contacts", level: 1 })).toBeVisible();
  await page.getByRole("combobox", { name: "Tag", exact: true }).selectOption("vip");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await page.getByLabel("Enregistrer ces filtres comme segment").fill("VIP");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Segments" }).getByRole("link", { name: /VIP \(1\)/ })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Exporter en CSV \(1\)/ }).click();
  const csv = await readFile((await (await download).path())!, "utf8");
  expect(csv).toContain("aicha@exemple.test");
  expect(csv).toContain("Client");

  // Erasure on request, confirmed in a dialog.
  await page.goto(contactUrl);
  await page.getByRole("button", { name: "Supprimer ce contact" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("Aucun contact pour l’instant")).toBeVisible();
});

test.describe("platform administration", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Admin flows run once; the admin layout is responsive like the app's.");
  });

  test("plans and quotas set by an admin apply to users; suspension locks the account out", async ({ page, browser }) => {
    test.setTimeout(90_000);
    const adminEmail = `admin-${unique()}@exemple.test`;
    await signUp(page, "Admin", adminEmail);
    // The only way to become an admin: the command line.
    execFileSync("pnpm", ["-s", "admin:grant", adminEmail], { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } });

    const userPage = await newVisitor(browser);
    const userEmail = `kwame-${unique()}@exemple.test`;
    await signUp(userPage, "Kwame", userEmail);
    expect((await userPage.goto("/admin"))?.status()).toBe(404);

    // Admin creates a free plan with one funnel.
    await page.goto("/admin/plans");
    const create = page.getByRole("region", { name: "Nouveau plan" });
    const planName = `Essai ${unique().slice(-6)}`;
    await create.getByLabel("Nom").fill(planName);
    await create.getByLabel("Code (unique)").fill(`essai-${unique()}`);
    await create.getByLabel(/Prix mensuel/).fill("0");
    await create.getByLabel("Tunnels").fill("1");
    await create.getByRole("button", { name: "Créer le plan" }).click();
    await expect(create.getByText("Plan créé.")).toBeVisible();

    // The user switches to it and hits the limit, with a clear message.
    await userPage.goto("/app");
    await userPage.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Abonnement" }).click();
    await userPage.getByRole("button", { name: `Passer au plan ${planName}` }).click();
    await expect(userPage.getByRole("heading", { name: `Plan actuel : ${planName}` })).toBeVisible();
    await userPage.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Tunnels" }).click();
    await userPage.getByLabel("Nouveau tunnel").fill("Premier");
    await userPage.getByRole("button", { name: "Créer le tunnel" }).click();
    await expect(userPage.getByRole("link", { name: "Premier", exact: true })).toBeVisible();
    await userPage.getByLabel("Nouveau tunnel").fill("Second");
    await userPage.getByRole("button", { name: "Créer le tunnel" }).click();
    await expect(userPage.getByText(`Limite du plan « ${planName} » atteinte : tunnels, 1 maximum. Changez de plan ou libérez de la place.`)).toBeVisible();

    // Admin suspends the user: their session ends and they cannot sign back in.
    await page.goto(`/admin/utilisateurs?q=${encodeURIComponent(userEmail)}`);
    await page.getByRole("link", { name: /Kwame/ }).click();
    await expect(page.getByText(`plan ${planName}`, { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Suspendre le compte" }).click();
    await page.getByRole("dialog").getByLabel(/Motif/).fill("Contenus frauduleux signalés");
    await page.getByRole("dialog").getByRole("button", { name: "Suspendre" }).click();
    await expect(page.getByText(/motif : Contenus frauduleux signalés/)).toBeVisible();

    await userPage.reload();
    await expect(userPage).toHaveURL(/\/connexion$/);
    await userPage.getByLabel("E-mail").fill(userEmail);
    await userPage.getByLabel("Mot de passe").fill("motdepasse-solide");
    await userPage.getByRole("button", { name: "Se connecter" }).click();
    await expect(userPage.getByText("Ce compte est suspendu. Contactez l’équipe de la plateforme.")).toBeVisible();

    await page.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: "Journal" }).click();
    await expect(page.getByText("user.suspend").first()).toBeVisible();
    await userPage.context().close();
  });
});
