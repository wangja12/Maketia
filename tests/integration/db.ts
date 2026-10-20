import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { createDb } from "@/db";
import { signUp } from "@/server/accounts";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set");

export const { db, client } = createDb(url);

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE users, sessions, workspaces, workspace_members, funnels, pages, page_versions, mcp_tokens, mcp_audit_log, publications, domains, payment_providers, products, orders, payment_events, experiments, experiment_arms, experiment_assignments, events, contacts, contact_events, segments, admin_audit_log, login_attempts, product_files, download_grants, saspay_webhook_endpoints, saspay_webhook_events, agent_requests CASCADE`,
  );
  // Seeded by the migration: keep the default plan (unlimited) and the settings row.
  await db.execute(sql`DELETE FROM plans WHERE code <> 'defaut'`);
  await db.execute(
    sql`UPDATE plans SET is_default = true, active = true, limits = '{"funnels":null,"variantsPerPage":null,"customDomains":null,"mcpWritesPerMonth":null,"analyticsEventsPerMonth":null}' WHERE code = 'defaut'`,
  );
  await db.execute(sql`UPDATE platform_settings SET signups_open = true, saspay_link_hosts = '{}'`);
});

afterAll(async () => {
  await client.end();
});

let n = 0;
export async function makeUser(name = "Awa") {
  n++;
  return signUp(db, { name, email: `${name.toLowerCase()}${n}@exemple.test`, password: "motdepasse-solide" });
}
