"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Vue d’ensemble" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/mcp", label: "MCP" },
  { href: "/admin/diagnostics", label: "Diagnostics" },
  { href: "/admin/journal", label: "Journal" },
  { href: "/admin/parametres", label: "Paramètres" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={(l.href === "/admin" ? pathname === l.href : pathname.startsWith(l.href)) ? "page" : undefined}
          className="shrink-0 rounded-control px-2.5 py-1.5 text-sm text-muted aria-[current=page]:bg-surface-sunken aria-[current=page]:font-medium aria-[current=page]:text-fg [@media(hover:hover)_and_(pointer:fine)]:hover:text-fg"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
