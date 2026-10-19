import { getDb } from "@/db";
import { getPlatformSettings } from "@/server/admin";
import { loadAdmin } from "../admin";
import { SettingsForm } from "../forms";

export default async function AdminSettings() {
  const admin = await loadAdmin();
  const s = await getPlatformSettings(getDb(), admin.id);
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Paramètres de la plateforme</h1>
      <div className="rounded-card border border-border bg-surface p-4 shadow-raised"><SettingsForm signupsOpen={s.signupsOpen} /></div>
      <p className="text-xs text-muted">Nommer un administrateur se fait uniquement en ligne de commande : <code>pnpm admin:grant e-mail</code>.</p>
    </div>
  );
}
