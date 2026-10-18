import type { SectionType } from "@/server/page-schema";

/** What the property panel shows for each section type. Mirrors page-schema.ts limits. */

export type SubField = { key: string; label: string; kind: "text" | "textarea"; optional?: boolean };

export type FieldDef =
  | { kind: "text" | "textarea"; key: string; label: string; optional?: boolean }
  | { kind: "number"; key: string; label: string }
  | { kind: "currency"; key: string; label: string }
  | { kind: "cta"; key: string; label: string; optional?: boolean }
  | { kind: "image"; key: string; label: string; optional?: boolean }
  | { kind: "strings"; key: string; label: string; itemLabel: string; max: number; min: number }
  | { kind: "items"; key: string; label: string; itemLabel: string; max: number; fields: SubField[]; blank: Record<string, string> }
  | { kind: "confirm"; key: string; label: string };

const title: FieldDef = { kind: "text", key: "title", label: "Titre de la section", optional: true };

export const SECTION_FIELDS: Record<SectionType, FieldDef[]> = {
  hero: [
    { kind: "text", key: "eyebrow", label: "Surtitre", optional: true },
    { kind: "text", key: "headline", label: "Titre principal" },
    { kind: "textarea", key: "subheadline", label: "Sous-titre", optional: true },
    { kind: "cta", key: "cta", label: "Bouton", optional: true },
    { kind: "image", key: "image", label: "Image", optional: true },
  ],
  features: [
    title,
    {
      kind: "items", key: "items", label: "Éléments", itemLabel: "Élément", max: 8,
      fields: [{ key: "title", label: "Titre", kind: "text" }, { key: "body", label: "Texte", kind: "textarea" }],
      blank: { title: "Nouvel élément", body: "Ce qu’il apporte." },
    },
  ],
  benefits: [title, { kind: "strings", key: "items", label: "Bénéfices", itemLabel: "Bénéfice", max: 10, min: 1 }],
  testimonials: [
    title,
    { kind: "confirm", key: "providedByUser", label: "Ces témoignages sont réels et je les fournis moi-même." },
    {
      kind: "items", key: "items", label: "Témoignages", itemLabel: "Témoignage", max: 6,
      fields: [
        { key: "quote", label: "Citation exacte", kind: "textarea" },
        { key: "author", label: "Auteur", kind: "text" },
        { key: "role", label: "Fonction ou ville", kind: "text", optional: true },
      ],
      blank: { quote: "Collez ici un témoignage réel.", author: "Nom du client" },
    },
  ],
  pricing: [
    title,
    { kind: "number", key: "price", label: "Prix" },
    { kind: "currency", key: "currency", label: "Devise (ISO)" },
    { kind: "text", key: "period", label: "Période (ex. mois)", optional: true },
    { kind: "strings", key: "features", label: "Ce qui est inclus", itemLabel: "Inclus", max: 12, min: 0 },
    { kind: "cta", key: "cta", label: "Bouton" },
  ],
  faq: [
    title,
    {
      kind: "items", key: "items", label: "Questions", itemLabel: "Question", max: 12,
      fields: [{ key: "question", label: "Question", kind: "text" }, { key: "answer", label: "Réponse", kind: "textarea" }],
      blank: { question: "Nouvelle question ?", answer: "Votre réponse." },
    },
  ],
  cta: [
    { kind: "text", key: "headline", label: "Titre" },
    { kind: "textarea", key: "body", label: "Texte", optional: true },
    { kind: "cta", key: "cta", label: "Bouton" },
  ],
  text: [title, { kind: "textarea", key: "body", label: "Texte" }],
  image: [
    { kind: "image", key: "image", label: "Image" },
    { kind: "text", key: "caption", label: "Légende", optional: true },
  ],
};
