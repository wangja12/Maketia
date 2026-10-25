import type { Metadata } from "next";
import { getDb } from "@/db";
import { accountDeletionPlan, getAccount } from "@/server/account-settings";
import { countSessions } from "@/server/sessions";
import { loadWorkspace } from "../workspace";
import { DeleteAccountButton, PasswordForm, ProfileForm, SignOutOthersButton } from "./forms";

export const metadata: Metadata = { title: "Compte et sécurité · Maketia" };

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });

export default async function AccountPage({ params }: PageProps<"/app/[workspaceId]/compte">) {
  const { workspaceId } = await params;
  const { user } = await loadWorkspace(workspaceId);
  const db = getDb();
  const [account, sessions, plan] = await Promise.all([getAccount(db, user.id), countSessions(db, user.id), accountDeletionPlan(db, user.id)]);
  const card = "flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised";
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compte et sécurité</h1>
        <p className="mt-1 text-sm text-muted">{account.email} · compte créé le {date.format(account.createdAt)}</p>
      </div>
      <section aria-labelledby="profile" className={card}>
        <h2 id="profile" className="text-sm font-semibold">Profil</h2>
        <ProfileForm name={account.name} />
      </section>
      <section aria-labelledby="password" className={card}>
        <h2 id="password" className="text-sm font-semibold">Mot de passe</h2>
        <p className="text-xs text-muted">Changer le mot de passe déconnecte vos autres appareils.</p>
        <PasswordForm />
      </section>
      <section aria-labelledby="sessions" className={card}>
        <h2 id="sessions" className="text-sm font-semibold">Sessions</h2>
        <SignOutOthersButton others={Math.max(0, sessions - 1)} />
        <p className="text-xs text-muted">Les connexions des agents IA (MCP) se gèrent dans « Agents IA ».</p>
      </section>
      <section aria-labelledby="delete" className={`${card} border-danger/30`}>
        <h2 id="delete" className="text-sm font-semibold text-danger">Supprimer le compte</h2>
        {plan.blocking.length > 0 ? (
          <p className="text-sm">
            Vous êtes le seul propriétaire de {plan.blocking.map((w) => `« ${w.name} »`).join(", ")}, qui a d’autres membres. Transmettez la propriété avant de supprimer votre compte.
          </p>
        ) : (
          <p className="text-sm text-muted">
            {plan.deleted.length
              ? `Les espaces dont vous êtes le seul membre seront supprimés avec tout leur contenu : ${plan.deleted.map((w) => w.name).join(", ")}.`
              : "Votre compte sera supprimé ; les espaces partagés restent à leurs autres membres."}
          </p>
        )}
        <div><DeleteAccountButton email={account.email} blocking={plan.blocking.map((w) => w.name)} deleted={plan.deleted.map((w) => w.name)} /></div>
      </section>
    </div>
  );
}
