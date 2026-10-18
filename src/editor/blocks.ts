import type { PageContent, Section, SectionType } from "@/server/page-schema";

/*
 * Ready-made sections for the block library. Placeholder copy reads as an instruction
 * so it is never mistaken for a real claim (wang-design-engineering §2).
 */

type Block = { type: SectionType; label: string; description: string; create: (id: string) => Section };

export const BLOCKS: Block[] = [
  {
    type: "hero",
    label: "En-tête",
    description: "La promesse principale et un appel à l’action.",
    create: (id) => ({ id, type: "hero", headline: "Votre promesse principale", subheadline: "Pour qui, et quel résultat.", cta: { label: "Je commence", href: "#" } }),
  },
  {
    type: "benefits",
    label: "Bénéfices",
    description: "Liste courte de ce que le client obtient.",
    create: (id) => ({ id, type: "benefits", title: "Ce que vous obtenez", items: ["Premier bénéfice", "Deuxième bénéfice", "Troisième bénéfice"] }),
  },
  {
    type: "features",
    label: "Contenu inclus",
    description: "Éléments de l’offre, avec titre et explication.",
    create: (id) => ({ id, type: "features", title: "Ce qui est inclus", items: [{ title: "Élément inclus", body: "Ce qu’il apporte au client." }] }),
  },
  {
    type: "text",
    label: "Texte",
    description: "Un paragraphe libre : problème, histoire, explication.",
    create: (id) => ({ id, type: "text", title: "Titre de la section", body: "Votre texte." }),
  },
  {
    type: "pricing",
    label: "Prix",
    description: "Le prix, ce qui est inclus et le bouton de commande.",
    create: (id) => ({ id, type: "pricing", title: "L’offre", price: 0, currency: "XOF", features: ["Ce qui est inclus"], cta: { label: "Commander", href: "#" } }),
  },
  {
    type: "testimonials",
    label: "Témoignages",
    description: "Uniquement des témoignages réels que vous fournissez.",
    create: (id) => ({ id, type: "testimonials", title: "Ils en parlent", providedByUser: true, items: [{ quote: "Collez ici un témoignage réel.", author: "Nom du client" }] }),
  },
  {
    type: "faq",
    label: "Questions fréquentes",
    description: "Lever les dernières objections.",
    create: (id) => ({ id, type: "faq", title: "Questions fréquentes", items: [{ question: "Une question de vos clients ?", answer: "Votre réponse." }] }),
  },
  {
    type: "cta",
    label: "Appel à l’action",
    description: "Une relance courte avec un bouton.",
    create: (id) => ({ id, type: "cta", headline: "Prêt à commencer ?", cta: { label: "Je commence", href: "#" } }),
  },
  {
    type: "image",
    label: "Image",
    description: "Une image par adresse https:// avec son texte alternatif.",
    create: (id) => ({ id, type: "image", image: { url: "https://", alt: "Décrivez l’image" } }),
  },
];

/** First free `type`, `type-2`, … id in the page. */
export function freeSectionId(content: PageContent, type: string) {
  const used = new Set(content.sections.map((s) => s.id));
  if (!used.has(type)) return type;
  for (let n = 2; ; n++) if (!used.has(`${type}-${n}`)) return `${type}-${n}`;
}

export const SECTION_LABELS: Record<SectionType, string> = Object.fromEntries(BLOCKS.map((b) => [b.type, b.label])) as Record<SectionType, string>;
