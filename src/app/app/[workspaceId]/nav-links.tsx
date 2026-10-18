"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const base = `/app/${workspaceId}`;
  const links = [
    { href: base, label: "Tunnels", active: pathname === base || pathname.startsWith(`${base}/tunnels`) },
    { href: `${base}/paiements`, label: "Paiements", active: pathname.startsWith(`${base}/paiements`) },
    { href: `${base}/agents`, label: "Agents IA", active: pathname.startsWith(`${base}/agents`) },
  ];
  return (
    <nav aria-label="Navigation principale" className="flex gap-1">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? "page" : undefined}
          // Instant state change: navigation is used tens of times a day, so it does not animate.
          className="rounded-control px-2.5 py-1.5 text-sm text-muted aria-[current=page]:bg-surface-sunken aria-[current=page]:font-medium aria-[current=page]:text-fg [@media(hover:hover)_and_(pointer:fine)]:hover:text-fg"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
