import { z } from "zod";

/** The offer described by the user. External agents read it before preparing pages. */
export const briefSchema = z.object({
  productName: z.string().trim().max(120).default(""),
  productType: z.enum(["formation", "ebook", "service", "logiciel", "coaching", "autre"]).default("autre"),
  audience: z.string().trim().max(500).default(""),
  problem: z.string().trim().max(1000).default(""),
  promise: z.string().trim().max(500).default(""),
  benefits: z.string().trim().max(2000).default(""),
  price: z.string().trim().max(40).default(""),
  currency: z.string().trim().toUpperCase().regex(/^([A-Z]{3})?$/, "Devise : code ISO 4217 (XOF, EUR…)").default(""),
  style: z.string().trim().max(300).default(""),
  goal: z.string().trim().max(300).default(""),
  // Free description, and the only place for real testimonials the user wants to use.
  notes: z.string().trim().max(5000).default(""),
});

export type FunnelBrief = z.infer<typeof briefSchema>;

export const PRODUCT_TYPE_LABELS: Record<FunnelBrief["productType"], string> = {
  formation: "Formation",
  ebook: "E-book",
  service: "Service",
  logiciel: "Logiciel",
  coaching: "Coaching",
  autre: "Autre",
};
