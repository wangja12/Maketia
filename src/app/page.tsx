import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <p className="text-sm font-semibold tracking-tight">Tunnels IA</p>
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[2.25rem] sm:leading-tight">
        Créez vos tunnels de vente, testez plusieurs versions, gardez celle qui vend.
      </h1>
      <p className="max-w-lg text-base text-muted text-pretty">
        Décrivez votre offre, l’IA construit les pages, vous ajustez dans un éditeur simple et
        vous mesurez les résultats réels.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/inscription" className={buttonClass("primary")}>
          Créer un compte
        </Link>
        <Link href="/connexion" className={buttonClass("secondary")}>
          Se connecter
        </Link>
      </div>
    </main>
  );
}
