// Makes an existing account a platform administrator. The only way to become one:
// there is deliberately no button for it in the application.
//   pnpm admin:grant personne@exemple.com
import "dotenv/config";
import { createDb } from "@/db";
import { grantPlatformAdmin } from "@/server/admin";

const email = process.argv[2];
if (!email) {
  console.error("Usage : pnpm admin:grant <e-mail>");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, client } = createDb(url);
try {
  await grantPlatformAdmin(db, email);
  console.log(`${email} est maintenant administrateur de la plateforme.`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end();
}
