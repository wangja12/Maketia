import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/** For the host's health checks and uptime monitoring. Says nothing about data or config. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
