import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { buttonClass } from "@/components/ui/button";
import { NavLinks } from "./nav-links";
import { loadWorkspace } from "./workspace";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/app/[workspaceId]">) {
  const { workspaceId } = await params;
  const { user, workspace } = await loadWorkspace(workspaceId);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 md:h-14 md:flex-nowrap md:py-0">
          <Link href={`/app/${workspace.id}`} className="text-sm font-semibold tracking-tight">
            Tunnels IA
          </Link>
          <span className="hidden text-border-strong md:inline" aria-hidden="true">/</span>
          <span className="hidden truncate text-sm text-muted md:inline">{workspace.name}</span>
          <div className="order-last w-full md:order-none md:w-auto md:min-w-0">
            <NavLinks workspaceId={workspace.id} />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {user.isPlatformAdmin && (
              <Link href="/admin" className="text-sm font-medium text-accent underline-offset-4 hover:underline">Administration</Link>
            )}
            <span className="hidden truncate text-sm text-muted sm:inline">{user.name}</span>
            <form action={signOutAction}>
              <button type="submit" className={buttonClass("ghost")}>
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
