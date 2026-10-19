import type { ContactStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/server/crm/contacts";

// Label always present: status is never conveyed by color alone.
const styles: Record<ContactStatus, string> = {
  lead: "bg-surface-sunken text-fg",
  customer: "bg-success-soft text-success",
  lost: "bg-surface-sunken text-muted",
};

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  return <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${styles[status]}`}>{STATUS_LABELS[status]}</span>;
}
