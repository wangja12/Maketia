import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Connexion · Tunnels IA" };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Connexion</h1>
      <p className="mt-1 text-sm text-muted">Retrouvez vos tunnels de vente.</p>
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
