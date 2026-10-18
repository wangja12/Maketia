import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Créer un compte · Tunnels IA" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Créer un compte</h1>
      <p className="mt-1 text-sm text-muted">Votre espace de travail est créé automatiquement.</p>
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-medium text-accent underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
