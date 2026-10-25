import { expect, test } from "@playwright/test";

test("profile, password and account deletion, with the password asked again", async ({ page, browser }) => {
  const email = `compte-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.test`;
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill("Ines");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByLabel("Nouvelle offre")).toBeVisible();

  // A second device, to be signed out by the password change.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/connexion");
  await otherPage.getByLabel("E-mail").fill(email);
  await otherPage.getByLabel("Mot de passe").fill("motdepasse-solide");
  await otherPage.getByRole("button", { name: "Se connecter" }).click();
  await expect(otherPage.getByLabel("Nouvelle offre")).toBeVisible();

  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Compte" }).click();
  await expect(page.getByRole("heading", { name: "Compte et sécurité" })).toBeVisible();
  await page.getByLabel("Nom", { exact: true }).fill("Inès Ouédraogo");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Profil enregistré.")).toBeVisible();

  await page.getByLabel("Mot de passe actuel").fill("faux-mot-de-passe");
  await page.getByLabel("Nouveau mot de passe").fill("nouveau-mdp-solide");
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByText("Mot de passe actuel incorrect", { exact: true })).toBeVisible();
  await page.getByLabel("Mot de passe actuel").fill("motdepasse-solide");
  await page.getByLabel("Nouveau mot de passe").fill("nouveau-mdp-solide");
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByText(/Mot de passe changé\. 1 autre\(s\) session\(s\) fermée\(s\)\./)).toBeVisible();
  await otherPage.reload();
  await expect(otherPage).toHaveURL(/\/connexion$/);
  await other.close();

  await page.getByRole("button", { name: "Supprimer mon compte" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Recopie ton e-mail/).fill(email);
  await dialog.getByLabel("Mot de passe").fill("motdepasse-solide");
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(dialog.getByText("Mot de passe actuel incorrect", { exact: true })).toBeVisible();
  await dialog.getByLabel("Mot de passe").fill("nouveau-mdp-solide");
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("Ton compte a été supprimé.")).toBeVisible();

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("nouveau-mdp-solide");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
});
