import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/app");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-sm font-semibold tracking-tight">
        Tunnels IA
      </Link>
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-raised sm:p-8">
        {children}
      </div>
    </main>
  );
}
