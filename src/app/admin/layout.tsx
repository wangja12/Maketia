import type { Metadata } from "next";
import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { buttonClass } from "@/components/ui/button";
import { loadAdmin } from "./admin";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: "Administration · Tunnels IA", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await loadAdmin();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 md:h-14 md:flex-nowrap md:py-0">
          <Link href="/admin" className="text-sm font-semibold tracking-tight">Tunnels IA · Administration</Link>
          <div className="order-last w-full md:order-none md:w-auto md:min-w-0">
            <AdminNav />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/app" className="text-sm text-muted underline-offset-4 hover:underline">Mon espace</Link>
            <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
            <form action={signOutAction}>
              <button type="submit" className={buttonClass("ghost")}>Se déconnecter</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
