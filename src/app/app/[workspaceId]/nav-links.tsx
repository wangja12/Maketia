"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ workspaceId, pendingRequests = 0 }: { workspaceId: string; pendingRequests?: number }) {
  const pathname = usePathname();
  const base = `/app/${workspaceId}`;
  const links = [
    { href: base, label: "Tunnels", active: pathname === base || pathname.startsWith(`${base}/tunnels`) },
    { href: `${base}/contacts`, label: "Contacts", active: pathname.startsWith(`${base}/contacts`) },
    { href: `${base}/paiements`, label: "Paiements", active: pathname.startsWith(`${base}/paiements`) },
    { href: `${base}/agents`, label: pendingRequests ? `Agents IA (${pendingRequests} à approuver)` : "Agents IA", active: pathname.startsWith(`${base}/agents`) },
    { href: `${base}/abonnement`, label: "Abonnement", active: pathname.startsWith(`${base}/abonnement`) },
    { href: `${base}/compte`, label: "Compte", active: pathname.startsWith(`${base}/compte`) },
  ];
  return (
    // Scrolls sideways on narrow screens instead of wrapping.
    <nav aria-label="Navigation principale" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? "page" : undefined}
          // Instant state change: navigation is used tens of times a day, so it does not animate.
          className="shrink-0 rounded-control px-2.5 py-1.5 text-sm text-muted aria-[current=page]:bg-surface-sunken aria-[current=page]:font-medium aria-[current=page]:text-fg [@media(hover:hover)_and_(pointer:fine)]:hover:text-fg"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
