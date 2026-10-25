import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Connexion · Maketia" };

export default async function SignInPage({ searchParams }: PageProps<"/connexion">) {
  const { compte } = await searchParams;
  return (
    <>
      {compte === "supprime" && <p role="status" className="mb-4 rounded-control bg-surface-sunken px-3 py-2 text-sm">Ton compte a été supprimé.</p>}
      <h1 className="text-xl font-semibold tracking-tight">Connexion</h1>
      <p className="mt-1 text-sm text-muted">Retrouve tes offres.</p>
      <SignInForm />
      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-medium text-accent underline-offset-4 hover:underline">
          Créer un compte
        </Link>
      </p>
    </>
  );
}
