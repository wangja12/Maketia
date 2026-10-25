import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function WorkspaceNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Espace introuvable</h1>
      <p className="text-sm text-muted">Cet espace n’existe pas ou tu n’y as pas accès.</p>
      <Link href="/app" className={buttonClass("secondary", "mt-2")}>
        Retour à mes offres
      </Link>
    </main>
  );
}
