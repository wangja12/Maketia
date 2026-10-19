/** Runs once at server start: reports configuration problems in the logs (see `pnpm check:prod`). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { checkProductionConfig } = await import("./server/config-check");
  const { errors, warnings } = checkProductionConfig(process.env);
  for (const w of warnings) console.warn(`[config] ${w}`);
  for (const e of errors) console.error(`[config] ERREUR : ${e}`);
}
