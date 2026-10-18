import { z } from "zod";

/*
 * Page content, schema version 1.
 *
 * A page is data, never code: every field is plain text rendered through React (escaped),
 * links and images are restricted to safe URL schemes, and sizes are bounded.
 * The same schema validates the web editor, the API and every MCP tool.
 */

export const PAGE_SCHEMA_VERSION = 1;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

// Relative paths, in-page anchors, https, and http (some local merchants still serve http).
const href = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^(https?:\/\/[^\s]+|\/[^\s]*|#[\w-]*)$/i.test(v), {
    message: "Lien invalide : utilisez https://…, /chemin ou #ancre",
  });

const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => /^https:\/\/[^\s]+$/i.test(v), { message: "Image : URL https:// requise" });

const sectionId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "Identifiant de section : minuscules, chiffres, tirets (40 max)");

/** Optional per-section presentation; added in v1 without breaking existing pages. */
const layout = z
  .object({
    align: z.enum(["left", "center"]).optional(),
    spacing: z.enum(["compact", "normal", "airy"]).optional(),
  })
  .optional();

const cta = z.object({ label: text(40), href });
const image = z.object({
  url: imageUrl,
  alt: text(200).describe("Texte alternatif décrivant l'image (accessibilité)"),
});

const hero = z.object({
  id: sectionId,
  layout,
  type: z.literal("hero"),
  eyebrow: optionalText(60),
  headline: text(120),
  subheadline: optionalText(300),
  cta: cta.optional(),
  image: image.optional(),
});

const features = z.object({
  id: sectionId,
  layout,
  type: z.literal("features"),
  title: optionalText(120),
  items: z.array(z.object({ title: text(80), body: text(400) })).min(1).max(8),
});

const benefits = z.object({
  id: sectionId,
  layout,
  type: z.literal("benefits"),
  title: optionalText(120),
  items: z.array(text(200)).min(1).max(10),
});

const testimonials = z.object({
  id: sectionId,
  layout,
  type: z.literal("testimonials"),
  title: optionalText(120),
  // Fabricated testimonials are forbidden. The author of the change must assert the source.
  providedByUser: z.literal(true, {
    error: "Témoignages : uniquement ceux fournis par l'utilisateur (providedByUser: true)",
  }),
  items: z
    .array(z.object({ quote: text(600), author: text(80), role: optionalText(80) }))
    .min(1)
    .max(6),
});

const pricing = z.object({
  id: sectionId,
  layout,
  type: z.literal("pricing"),
  title: optionalText(120),
  price: z.number().nonnegative().max(1_000_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/, "Devise : code ISO 4217 (XOF, EUR…)"),
  period: optionalText(30),
  features: z.array(text(160)).max(12).default([]),
  cta,
});

const faq = z.object({
  id: sectionId,
  layout,
  type: z.literal("faq"),
  title: optionalText(120),
  items: z.array(z.object({ question: text(200), answer: text(1000) })).min(1).max(12),
});

/** Order form for a product; the price always comes from the product, never from the page. */
const checkout = z.object({
  id: sectionId,
  layout,
  type: z.literal("checkout"),
  title: optionalText(120),
  productId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Choisissez un produit"),
  buttonLabel: text(40),
  note: optionalText(300),
});

const ctaSection = z.object({
  id: sectionId,
  layout,
  type: z.literal("cta"),
  headline: text(120),
  body: optionalText(400),
  cta,
});

const textSection = z.object({
  id: sectionId,
  layout,
  type: z.literal("text"),
  title: optionalText(120),
  body: text(4000),
});

const imageSection = z.object({
  id: sectionId,
  layout,
  type: z.literal("image"),
  image,
  caption: optionalText(200),
});

export const sectionSchema = z.discriminatedUnion("type", [
  hero,
  features,
  benefits,
  testimonials,
  pricing,
  faq,
  ctaSection,
  textSection,
  imageSection,
  checkout,
]);

export const themeSchema = z.object({
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur : format #RRGGBB"),
  background: z.enum(["light", "dark"]),
  font: z.enum(["sans", "serif"]),
});

export const pageContentSchema = z
  .object({
    schemaVersion: z.literal(PAGE_SCHEMA_VERSION),
    theme: themeSchema,
    sections: z.array(sectionSchema).max(30),
  })
  .superRefine((page, ctx) => {
    const seen = new Set<string>();
    page.sections.forEach((s, i) => {
      if (seen.has(s.id)) {
        ctx.addIssue({ code: "custom", path: ["sections", i, "id"], message: `Identifiant de section dupliqué : ${s.id}` });
      }
      seen.add(s.id);
    });
  });

export type PageContent = z.infer<typeof pageContentSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];
export type SectionLayout = NonNullable<Section["layout"]>;
export const SECTION_TYPES = sectionSchema.options.map((o) => o.shape.type.value);

/** Short human-readable path + message, for API and MCP error messages. */
export function formatIssues(error: z.ZodError, limit = 8) {
  return error.issues
    .slice(0, limit)
    .map((i) => `${i.path.join(".") || "page"} : ${i.message}`)
    .join("\n");
}
