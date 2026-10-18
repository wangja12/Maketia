import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { createDb } from "@/db";
import { signUp } from "@/server/accounts";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set");

export const { db, client } = createDb(url);

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE users, sessions, workspaces, workspace_members, funnels, pages, page_versions, mcp_tokens, mcp_audit_log, publications, domains CASCADE`,
  );
});

afterAll(async () => {
  await client.end();
});

let n = 0;
export async function makeUser(name = "Awa") {
  n++;
  return signUp(db, { name, email: `${name.toLowerCase()}${n}@exemple.test`, password: "motdepasse-solide" });
}
