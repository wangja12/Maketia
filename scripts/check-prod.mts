// Pre-deploy check: `pnpm check:prod` with the production environment loaded. Exits 1 on any error.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { createDb } from "@/db";
import { checkProductionConfig } from "@/server/config-check";

const { errors, warnings } = checkProductionConfig(process.env);

if (process.env.DATABASE_URL) {
  const { db, client } = createDb(process.env.DATABASE_URL);
  try {
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };
    const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    if (n < journal.entries.length) errors.push(`Migrations non appliquées : ${n}/${journal.entries.length} (pnpm db:migrate).`);
    const [plan] = await db.execute<{ n: number }>(sql`select count(*)::int as n from plans where is_default and active`);
    if (!plan || plan.n !== 1) errors.push("Aucun plan par défaut actif.");
    const [admin] = await db.execute<{ n: number }>(sql`select count(*)::int as n from users where is_platform_admin and suspended_at is null`);
    if (!admin || admin.n === 0) warnings.push("Aucun administrateur de la plateforme (pnpm admin:grant <e-mail>).");
  } catch (e) {
    errors.push(`Base de données inaccessible ou incomplète : ${e instanceof Error ? e.message : e}`);
  } finally {
    await client.end();
  }
}

for (const w of warnings) console.log(`AVERTISSEMENT  ${w}`);
for (const e of errors) console.log(`ERREUR         ${e}`);
console.log(errors.length ? `\n${errors.length} erreur(s) : ne pas déployer.` : "\nConfiguration de production valide.");
process.exitCode = errors.length ? 1 : 0;
