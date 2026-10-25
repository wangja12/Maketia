import { expect, test, type Page } from "@playwright/test";

const password = "motdepasse-solide";

function uniqueEmail(tag: string) {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.test`;
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Mes offres" })).toBeVisible();
}

test("sign up, create, rename and delete a funnel; data persists across reloads", async ({ page }) => {
  await signUp(page, "Awa Diop", uniqueEmail("awa"));
  await expect(page.getByText("Crée ta première offre")).toBeVisible();

  const input = page.getByLabel("Nouvelle offre");
  await input.fill("Formation Excel");
  await input.press("Enter");
  const row = page.getByRole("listitem").filter({ hasText: "Formation Excel" });
  await expect(row).toBeVisible();
  await expect(row.getByText("Brouillon")).toBeVisible();
  await expect(row.getByText("/formation-excel")).toBeVisible();
  await expect(input).toHaveValue("");

  await page.reload();
  await expect(row).toBeVisible();

  // Rename through the modal, keyboard only after opening.
  await row.getByRole("button", { name: /Renommer/ }).click();
  const dialog = page.getByRole("dialog", { name: "Renommer l’offre" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Nom")).toBeFocused();
  await dialog.getByLabel("Nom").fill("Formation Excel avancée");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Formation Excel avancée", { exact: true })).toBeVisible();

  // Escape closes the delete confirmation without deleting.
  const renamed = page.getByRole("listitem").filter({ hasText: "Formation Excel avancée" });
  await renamed.getByRole("button", { name: /Supprimer/ }).click();
  const confirm = page.getByRole("dialog", { name: "Supprimer cette offre ?" });
  await expect(confirm.getByRole("button", { name: "Annuler" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(renamed).toBeVisible();

  await renamed.getByRole("button", { name: /Supprimer/ }).click();
  await confirm.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Crée ta première offre")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Crée ta première offre")).toBeVisible();
});

test("shows validation errors inline and keeps typed values", async ({ page }) => {
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill("Kofi");
  await page.getByLabel("E-mail").fill("pas-un-email");
  await page.getByLabel("Mot de passe").fill("court");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Adresse e-mail invalide")).toBeVisible();
  await expect(page.getByText("10 caractères minimum").first()).toBeVisible();
  await expect(page.getByLabel("Nom")).toHaveValue("Kofi");
  await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
});

test("sign out, wrong password, sign back in", async ({ page }) => {
  const email = uniqueEmail("fatou");
  await signUp(page, "Fatou", email);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion$/);

  await page.goto("/app");
  await expect(page).toHaveURL(/\/connexion$/);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toHaveText("E-mail ou mot de passe incorrect.");

  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Mes offres" })).toBeVisible();
});

test("a user cannot open another user's workspace", async ({ browser }) => {
  const alice = await browser.newPage();
  await signUp(alice, "Alice", uniqueEmail("alice"));
  const aliceWorkspaceUrl = alice.url();
  await alice.getByLabel("Nouvelle offre").fill("Tunnel privé");
  await alice.getByRole("button", { name: "Créer l’offre" }).click();
  await expect(alice.getByText("Tunnel privé", { exact: true })).toBeVisible();

  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  await signUp(bob, "Bob", uniqueEmail("bob"));
  const response = await bob.goto(aliceWorkspaceUrl);
  expect(response?.status()).toBe(404);
  await expect(bob.getByText("Espace introuvable")).toBeVisible();
  await expect(bob.getByText("Tunnel privé", { exact: true })).toHaveCount(0);
  await bobContext.close();
});
