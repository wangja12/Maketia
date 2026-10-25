import Link from "next/link";
import { getDb } from "@/db";
import { count } from "@/lib/format";
import { adminOverview } from "@/server/admin";
import { loadAdmin } from "./admin";

export default async function AdminHome() {
  const admin = await loadAdmin();
  const o = await adminOverview(getDb(), admin.id);
  const tiles = [
    { label: "Utilisateurs", value: count(o.users), hint: o.suspended ? `${count(o.suspended)} suspendu(s)` : undefined, href: "/admin/utilisateurs" },
    { label: "Espaces", value: count(o.workspaces) },
    { label: "Offres", value: count(o.funnels) },
    { label: "Pages en ligne", value: count(o.livePages), href: "/admin/diagnostics" },
    { label: "Paiements confirmés (30 j)", value: count(o.paidOrders30d) },
    { label: "Appels MCP (24 h)", value: count(o.mcpCalls24h), hint: `${count(o.mcpErrors24h)} en erreur`, href: "/admin/mcp" },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vue d’ensemble</h1>
        <p className="mt-1 text-sm text-muted">La plateforme n’exécute aucun modèle d’IA : il n’y a pas de coût d’IA interne à suivre, seulement l’usage du serveur MCP par les agents externes.</p>
      </div>
      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => {
          const body = (
            <>
              <span className="text-xs text-muted">{t.label}</span>
              <span className="text-xl font-semibold tabular-nums">{t.value}</span>
              {t.hint && <span className="text-xs text-muted">{t.hint}</span>}
            </>
          );
          const cls = "flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3 shadow-raised";
          return t.href ? (
            <Link key={t.label} href={t.href} className={`${cls} pressable [@media(hover:hover)_and_(pointer:fine)]:hover:border-border-strong`}>{body}</Link>
          ) : (
            <div key={t.label} className={cls}>{body}</div>
          );
        })}
      </section>
    </div>
  );
}
