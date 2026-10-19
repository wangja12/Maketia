import { createHash } from "node:crypto";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { contactEvents } from "@/db/schema";
import { recordLeadSubmitted } from "../analytics/tracking";
import { resolvePublishedPage, type PublicSite } from "../publishing";
import { fieldErrorsOf } from "../validation";
import { recordContact } from "./contacts";

/*
 * Public contact form (section "lead_form"). The form only exists on a live publication;
 * consent is required; submissions are limited per IP (hashed). The visitor is told nothing
 * about whether they were already a contact.
 */

// Generous on purpose: many mobile users share one public IP behind their carrier (CGNAT).
export const LEADS_LIMIT_PER_10_MIN = 20;

export class LeadError extends Error {
  constructor(
    readonly code: "invalid" | "unavailable" | "rate_limited",
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "LeadError";
  }
}

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .refine((v) => v === "" || /^\+[1-9][0-9]{7,14}$/.test(v), "Téléphone au format international, ex. +2250700000000");

const leadSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom : 2 caractères minimum").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide")),
  phone,
  consent: z.literal("on", { error: "Cochez la case pour accepter d’être recontacté(e)." }),
});

export async function submitLead(
  db: Db,
  input: { site: PublicSite; path: string; sectionId: string; fields: Record<string, string>; ip: string | null; visitorId?: string | null },
) {
  const page = await resolvePublishedPage(db, input.site, input.path, input.visitorId ?? null);
  const section = page?.content.sections.find((s) => s.id === input.sectionId && s.type === "lead_form");
  if (!page || !section || section.type !== "lead_form") throw new LeadError("unavailable", "Ce formulaire n’est plus en ligne.");

  const parsed = leadSchema.safeParse(input.fields);
  if (!parsed.success) throw new LeadError("invalid", "Vérifiez vos informations.", fieldErrorsOf(parsed.error));
  const data = parsed.data;
  if (section.phone === "required" && !data.phone) throw new LeadError("invalid", "Vérifiez vos informations.", { phone: "Indiquez votre téléphone" });

  const ipHash = input.ip ? createHash("sha256").update(`tunnels-ia:${input.ip}`).digest("hex") : null;
  if (ipHash) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(contactEvents)
      .where(and(eq(contactEvents.ipHash, ipHash), gt(contactEvents.createdAt, sql`now() - interval '10 minutes'`)));
    if (n >= LEADS_LIMIT_PER_10_MIN) throw new LeadError("rate_limited", "Trop d’envois. Réessayez dans quelques minutes.");
  }

  const contactId = await db.transaction((tx) =>
    recordContact(
      tx,
      {
        workspaceId: page.workspaceId,
        firstName: data.firstName,
        email: data.email,
        phone: section.phone === "hidden" ? null : data.phone || null,
        funnelId: page.funnelId,
        pageId: page.pageId,
        variantLabel: page.variantLabel,
        visitorId: input.visitorId,
        consent: true,
      },
      { kind: "lead_submitted", detail: `${section.title ?? "Formulaire"} · /${input.path}`, ipHash },
    ),
  );
  await recordLeadSubmitted(db, { ...page, visitorId: input.visitorId ?? null, contactId });
  return { contactId };
}
