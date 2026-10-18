import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { expect, test, type Page } from "@playwright/test";

const mod = process.platform === "darwin" ? "Meta" : "Control";

async function openEditor(page: Page) {
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill("Kofi");
  await page.getByLabel("E-mail").fill(`ed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.test`);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nouveau tunnel").fill("Coaching");
  await page.getByRole("button", { name: "Créer le tunnel" }).click();
  await page.getByRole("link", { name: "Coaching" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Landing");
  await page.getByLabel("Modèle").selectOption("landing");
  await page.getByRole("button", { name: "Créer la page" }).click();
  await page.getByRole("link", { name: "Modifier la page" }).click();
  await expect(page.getByText("Enregistré · v1")).toBeVisible();
  return page.url();
}

const canvas = (page: Page) => page.getByRole("main", { name: "Page en cours d’édition" });

test("edit text in place, change colour and structure, autosave, undo, persist", async ({ page }) => {
  const editorUrl = await openEditor(page);

  // Click the headline in the canvas and type: no AI, no form.
  const headline = canvas(page).getByRole("textbox", { name: "Titre principal" });
  await headline.click();
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.type("Coaching business pour artisans");
  await expect(page.getByText("Enregistré · v2")).toBeVisible();
  // The property panel follows the selection and shows the same value.
  await expect(page.getByRole("complementary", { name: "Propriétés" }).getByLabel("Titre principal")).toHaveValue("Coaching business pour artisans");

  // Theme colour from the panel; a low-contrast colour is flagged immediately.
  await page.keyboard.press("Escape");
  const accent = page.getByLabel("Couleur d’accent", { exact: true });
  await accent.fill("#7a2e0e");
  await expect(page.getByText(/Contraste des boutons : .*conforme/)).toBeVisible();
  await expect(page.getByText("Enregistré · v3")).toBeVisible();

  // Add a section from the library, after the hero.
  await canvas(page).getByRole("textbox", { name: "Titre principal" }).click();
  await page.getByRole("button", { name: "Ajouter une section" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Questions fréquentes/ }).click();
  const outline = page.getByRole("navigation", { name: "Structure de la page" });
  await expect(outline.getByRole("button")).toHaveText([/En-tête/, /Questions fréquentes/, /Bénéfices/, /Appel à l’action/]);
  await expect(page.getByText("Enregistré · v4")).toBeVisible();

  // Reorder with the keyboard (Alt+↓), then undo it.
  await outline.getByRole("button", { name: /Questions fréquentes/ }).focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(outline.getByRole("button")).toHaveText([/En-tête/, /Bénéfices/, /Questions fréquentes/, /Appel à l’action/]);
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(outline.getByRole("button")).toHaveText([/En-tête/, /Questions fréquentes/, /Bénéfices/, /Appel à l’action/]);

  // An emptied required field blocks the save and says why.
  await canvas(page).getByRole("textbox", { name: "Titre principal" }).click();
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.press("Backspace");
  await expect(page.getByText(/Non enregistré : 1 champ à corriger/)).toBeVisible();
  await page.keyboard.press(`${mod}+Z`);
  await expect(canvas(page).getByRole("textbox", { name: "Titre principal" })).toHaveText("Coaching business pour artisans");

  // Persisted: reload shows the saved state.
  await page.waitForTimeout(1200);
  await page.goto(editorUrl);
  await expect(canvas(page).getByRole("textbox", { name: "Titre principal" })).toHaveText("Coaching business pour artisans");
  await expect(page.getByLabel("Couleur d’accent", { exact: true })).toHaveValue("#7a2e0e");
  await expect(outline.getByRole("button")).toHaveCount(4);

  // Preview mode renders the real page, without editing controls.
  await page.getByRole("button", { name: "Aperçu" }).click();
  await expect(canvas(page).getByRole("textbox")).toHaveCount(0);
  await expect(canvas(page).getByRole("heading", { name: "Coaching business pour artisans" })).toBeVisible();
});

test("an agent's version during editing is announced, never applied silently", async ({ page, baseURL }) => {
  const editorUrl = await openEditor(page);
  const pageId = editorUrl.split("/pages/")[1].split("/")[0];

  // Create an MCP connection in a second tab and let an agent edit the same page.
  const agents = await page.context().newPage();
  await agents.goto(editorUrl.split("/tunnels/")[0] + "/agents");
  await agents.getByLabel("Nom").fill("Agent test");
  await agents.getByRole("button", { name: "Créer la connexion" }).click();
  const token = (await agents.getByRole("status", { name: "Jeton créé" }).locator("pre").first().textContent())!.trim();
  await agents.close();

  const client = new Client({ name: "e2e", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${baseURL}/api/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const r = (await client.callTool({
    name: "update_page_section",
    arguments: { page_id: pageId, base_version: 1, section_id: "hero", changes: { headline: "Version de l’agent" }, skill_version: "1.0.0" },
  })) as CallToolResult;
  expect(r.isError).toBeFalsy();
  await client.close();

  // The editor still shows the user's content and announces v2.
  await expect(page.getByText(/La version 2 a été enregistrée par l’agent « Agent test »/)).toBeVisible({ timeout: 15_000 });
  await expect(canvas(page).getByRole("textbox", { name: "Titre principal" })).toHaveText("Votre promesse principale, en une phrase");

  // Editing on the stale base raises a conflict instead of overwriting.
  await canvas(page).getByRole("textbox", { name: "Bénéfice 1" }).click();
  await page.keyboard.type(" (modifié)");
  await expect(page.getByRole("alert").filter({ hasText: "Conflit" })).toBeVisible();
  await page.getByRole("button", { name: "Garder ma version (nouvelle version 3)" }).click();
  await expect(page.getByText("Enregistré · v3")).toBeVisible();
});

test("reorder sections by drag and drop in the structure panel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Mouse drag and drop; touch users have the ↑/↓ buttons.");
  await openEditor(page);
  const outline = page.getByRole("navigation", { name: "Structure de la page" });
  await expect(outline.getByRole("button")).toHaveText([/En-tête/, /Bénéfices/, /Appel à l’action/]);
  await outline.getByRole("listitem").filter({ hasText: "Appel à l’action" }).dragTo(outline.getByRole("listitem").filter({ hasText: "En-tête" }), {
    targetPosition: { x: 20, y: 2 },
  });
  await expect(outline.getByRole("button")).toHaveText([/Appel à l’action/, /En-tête/, /Bénéfices/]);
  await expect(page.getByText("Enregistré · v2")).toBeVisible();
});
