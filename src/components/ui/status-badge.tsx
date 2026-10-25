import type { Funnel } from "@/db/schema";

// Label always present: status is never conveyed by color alone.
const styles: Record<Funnel["status"], { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-surface-sunken text-muted" },
  published: { label: "Publiée", className: "bg-success-soft text-success" },
  archived: { label: "Archivée", className: "bg-surface-sunken text-muted line-through" },
};

export function StatusBadge({ status }: { status: Funnel["status"] }) {
  const s = styles[status];
  return (
    <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
