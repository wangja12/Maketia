import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { expect, test, type Page } from "@playwright/test";

const password = "motdepasse-solide";

async function signUpWithFunnel(page: Page) {
  await page.goto("/inscription");
  await page.getByLabel("Nom").fill("Awa Diop");
  await page.getByLabel("E-mail").fill(`mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.test`);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nouvelle offre").fill("Excel facile");
  await page.getByRole("button", { name: "Créer l’offre" }).click();
  await page.getByRole("link", { name: "Excel facile" }).click();
  await expect(page.getByRole("heading", { name: "Excel facile", level: 1 })).toBeVisible();
}

async function mcpClient(url: string, token: string) {
  const client = new Client({ name: "e2e-agent", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as CallToolResult;
    const text = r.content[0]?.type === "text" ? r.content[0].text : "";
    if (r.isError) throw new Error(text);
    return JSON.parse(text);
  };
  return { client, call };
}

test("manual work without AI, then an external agent edits through MCP over HTTP", async ({ page, baseURL }) => {
  await signUpWithFunnel(page);
  await expect(page.getByText("Aucun agent IA actif.")).toBeVisible();

  // 1. Describe the offer by hand; it persists.
  await page.getByLabel("Nom du produit ou de l’offre").fill("Excel facile");
  await page.getByLabel("Public cible").fill("Commerçants qui débutent");
  await page.getByLabel("Devise").fill("xof");
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click();
  await expect(page.getByText("Fiche enregistrée.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Public cible")).toHaveValue("Commerçants qui débutent");
  await expect(page.getByLabel("Devise")).toHaveValue("XOF");

  // 2. Create a page from a template, no AI involved.
  await page.getByLabel("Nom", { exact: true }).fill("Page de vente");
  await page.getByLabel("Modèle").selectOption("sales");
  await page.getByRole("button", { name: "Créer la page" }).click();
  await expect(page.getByRole("heading", { name: "Page de vente", level: 1 })).toBeVisible();
  const pageUrl = page.url();
  const pageId = pageUrl.split("/pages/")[1];
  const preview = page.frameLocator("iframe");
  await expect(preview.getByRole("heading", { name: "Votre promesse principale, en une phrase" })).toBeVisible();
  await expect(page.getByRole("link", { name: "v1 · actuelle" })).toBeVisible();

  // 3. Create an MCP connection; the token is shown once.
  const workspaceUrl = pageUrl.split("/tunnels/")[0];
  await page.goto(`${workspaceUrl}/agents`);
  await page.getByLabel("Nom").fill("Claude d’Awa");
  await page.getByRole("button", { name: "Créer la connexion" }).click();
  const tokenBlock = page.getByRole("status", { name: "Jeton créé" }).locator("pre").first();
  await expect(tokenBlock).toHaveText(/^tia_/);
  const token = (await tokenBlock.textContent())!.trim();
  const mcpUrl = `${baseURL}/api/mcp`;

  // 4. The agent reads the skill and the brief, then edits one section over real HTTP.
  const { client, call } = await mcpClient(mcpUrl, token);
  const skill = await call("get_design_engineering_skill");
  expect(skill.version).toBe("1.1.0");
  const funnelId = pageUrl.split("/tunnels/")[1].split("/")[0];
  const funnel = await call("get_funnel", { funnel_id: funnelId });
  expect(funnel.brief.audience).toBe("Commerçants qui débutent");
  await call("update_page_section", {
    page_id: pageId, base_version: 1, section_id: "hero",
    changes: { headline: "Maîtrisez Excel pour votre commerce en 7 jours" },
    skill_version: skill.version, note: "Accroche orientée résultat",
  });
  const variant = await call("create_page_variant", { page_id: pageId, skill_version: skill.version });
  expect(variant.variantLabel).toBe("B");
  await client.close();

  // 5. The web app shows the agent's version, attributed, and the new variant.
  await page.goto(pageUrl);
  await expect(preview.getByRole("heading", { name: "Maîtrisez Excel pour votre commerce en 7 jours" })).toBeVisible();
  await expect(page.getByText("Accroche orientée résultat")).toBeVisible();
  await expect(page.getByText(/Agent « Claude d’Awa » pour Awa Diop/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Variante B" })).toBeVisible();

  // 6. Restore v1 by hand: a new version, nothing deleted.
  await page.getByRole("listitem").filter({ hasText: "v1" }).getByRole("button", { name: "Restaurer" }).click();
  await expect(page.getByRole("link", { name: "v3 · actuelle" })).toBeVisible();
  await expect(preview.getByRole("heading", { name: "Votre promesse principale, en une phrase" })).toBeVisible();

  // 7. The agent asks to publish: nothing happens until Awa approves it in the app, after review.
  const agent = await mcpClient(mcpUrl, token);
  const request = await agent.call("publish_page", { page_id: pageId, path: "", skill_version: "1.1.0", reason: "Version restaurée prête" });
  expect(request.status).toBe("pending_human_confirmation");
  await agent.client.close();
  await expect(page.getByRole("region", { name: "Publication" }).getByText("Pas en ligne.")).toBeVisible();
  await page.goto(`${workspaceUrl}/agents`);
  await expect(page.getByRole("link", { name: "Agents IA (1 à approuver)" })).toBeVisible();
  const asked = page.getByRole("listitem").filter({ hasText: "Publier une page" });
  await expect(asked.getByText(/Motif donné par l’agent \(non vérifié\) : Version restaurée prête/)).toBeVisible();
  const approve = asked.getByRole("button", { name: "Approuver et exécuter" });
  await expect(approve).toBeDisabled();
  for (const box of await asked.getByRole("checkbox").all()) await box.check();
  await approve.click();
  await expect(page.getByRole("heading", { name: "Demandes à approuver (0)" })).toBeVisible();
  await page.goto(pageUrl);
  await expect(page.getByRole("region", { name: "Publication" }).getByText("En ligne", { exact: true })).toBeVisible();

  // 8. The audit log lists the agent's calls; revoking cuts access immediately.
  await page.goto(`${workspaceUrl}/agents`);
  await expect(page.getByRole("cell", { name: "update_page_section" })).toBeVisible();
  await page.getByRole("button", { name: "Révoquer Claude d’Awa" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Révoquer" }).click();
  await expect(page.getByText("Aucun agent connecté.")).toBeVisible();
  const afterRevoke = await mcpClient(mcpUrl, token).then(() => "connected", (e: Error) => e.message);
  expect(afterRevoke).toContain("Jeton invalide ou révoqué");
});

test("the MCP endpoint rejects missing and unknown tokens", async ({ request }) => {
  const body = { jsonrpc: "2.0", id: 1, method: "tools/list" };
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  const none = await request.post("/api/mcp", { data: body, headers });
  expect(none.status()).toBe(401);
  expect(none.headers()["www-authenticate"]).toContain("Bearer");
  const bad = await request.post("/api/mcp", { data: body, headers: { ...headers, authorization: "Bearer tia_faux" } });
  expect(bad.status()).toBe(401);
  expect((await request.get("/api/mcp")).status()).toBe(405);
});
