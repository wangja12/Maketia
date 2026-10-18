import type { PageKind } from "@/db/schema";
import { PAGE_SCHEMA_VERSION, type PageContent, type Section } from "./page-schema";

/*
 * Starting points for pages created by hand. Placeholder copy is written as instructions
 * ("Votre promesse…") so nobody mistakes it for real claims.
 */

const theme: PageContent["theme"] = { accent: "#1f5f4a", background: "light", font: "sans" };

const hero: Section = {
  id: "hero",
  type: "hero",
  headline: "Votre promesse principale, en une phrase",
  subheadline: "Expliquez pour qui est l’offre et le résultat concret qu’elle apporte.",
  cta: { label: "Je commence", href: "#offre" },
};

const byKind: Record<PageKind, Section[]> = {
  landing: [
    hero,
    { id: "benefices", type: "benefits", title: "Ce que vous obtenez", items: ["Premier bénéfice", "Deuxième bénéfice", "Troisième bénéfice"] },
    { id: "offre", type: "cta", headline: "Prêt à commencer ?", cta: { label: "Je commence", href: "#" } },
  ],
  sales: [
    hero,
    { id: "probleme", type: "text", title: "Le problème", body: "Décrivez la situation de votre client avant l’offre." },
    { id: "contenu", type: "features", title: "Ce qui est inclus", items: [{ title: "Élément inclus", body: "Ce qu’il apporte au client." }] },
    { id: "offre", type: "pricing", title: "L’offre", price: 0, currency: "XOF", features: ["Ce qui est inclus"], cta: { label: "Commander", href: "#" } },
    { id: "questions", type: "faq", title: "Questions fréquentes", items: [{ question: "Une question que vos clients posent ?", answer: "Votre réponse." }] },
  ],
  offer: [
    hero,
    { id: "offre", type: "pricing", title: "L’offre", price: 0, currency: "XOF", features: ["Ce qui est inclus"], cta: { label: "Commander", href: "#" } },
  ],
  order: [
    { id: "recap", type: "text", title: "Votre commande", body: "Récapitulez ce que le client achète." },
    { id: "offre", type: "pricing", price: 0, currency: "XOF", features: [], cta: { label: "Passer au paiement", href: "#" } },
  ],
  checkout: [{ id: "paiement", type: "text", title: "Paiement", body: "Le paiement sera branché en phase 5 (prestataire africain vérifié)." }],
  thank_you: [{ id: "merci", type: "text", title: "Merci !", body: "Indiquez la prochaine étape au client." }],
  confirmation: [{ id: "confirmation", type: "text", title: "Commande confirmée", body: "Expliquez comment accéder au produit." }],
  upsell: [
    { id: "hero", type: "hero", headline: "Une offre complémentaire", subheadline: "Présentez le complément et pourquoi il est utile maintenant." },
    { id: "offre", type: "cta", headline: "Ajouter à ma commande", cta: { label: "Oui, je l’ajoute", href: "#" } },
  ],
  other: [hero],
};

export function templateFor(kind: PageKind): PageContent {
  return structuredClone({ schemaVersion: PAGE_SCHEMA_VERSION, theme, sections: byKind[kind] });
}

export const PAGE_KIND_LABELS: Record<PageKind, string> = {
  landing: "Page d’atterrissage",
  sales: "Page de vente",
  offer: "Présentation de l’offre",
  order: "Page de commande",
  checkout: "Page de paiement",
  thank_you: "Remerciement",
  confirmation: "Confirmation",
  upsell: "Offre complémentaire",
  other: "Autre",
};
