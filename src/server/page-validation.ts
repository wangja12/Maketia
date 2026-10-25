import type { PageKind } from "@/db/schema";
import { pageContentSchema, formatIssues, type PageContent } from "./page-schema";

/*
 * Deterministic pre-publication checks. No model is involved: these are objective rules.
 * Taste cannot be checked automatically, so `review` lists what a human must look at.
 */

export type CheckResult = { code: string; message: string };

export type PageReport = {
  /** Blocking: publication must be refused while any is present. */
  errors: CheckResult[];
  warnings: CheckResult[];
  /** Manual review items from the wang-design-engineering skill. Never auto-approved. */
  review: string[];
};

export const MANUAL_REVIEW = [
  "Hiérarchie visuelle claire : une seule promesse principale, lisible en 5 secondes.",
  "Aperçu vérifié en bureau, tablette et mobile (largeur 360 px) sans texte coupé.",
  "Chaque appel à l’action dit ce qui se passe au clic.",
  "Aucune affirmation, statistique, garantie ou certification non fournie par l’utilisateur.",
  "Témoignages : uniquement ceux fournis par l’utilisateur, sans modification de sens.",
  "Ton et couleurs cohérents avec le style demandé dans la fiche de l’offre.",
];

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text color the renderer puts on accent-colored buttons. */
export function onAccent(accent: string) {
  return contrastRatio(accent, "#ffffff") >= contrastRatio(accent, "#111111") ? "#ffffff" : "#111111";
}

export const PAGE_BACKGROUNDS = { light: "#ffffff", dark: "#111111" } as const;

const NEEDS_CTA: PageKind[] = ["landing", "sales", "offer", "order", "upsell"];

export function validatePageContent(kind: PageKind, raw: unknown): PageReport {
  const report: PageReport = { errors: [], warnings: [], review: MANUAL_REVIEW };
  const parsed = pageContentSchema.safeParse(raw);
  if (!parsed.success) {
    report.errors.push({ code: "schema", message: formatIssues(parsed.error) });
    return report;
  }
  const page: PageContent = parsed.data;
  const { accent, background } = page.theme;

  if (page.sections.length === 0) {
    report.errors.push({ code: "empty", message: "La page ne contient aucune section." });
  }

  // Buttons: accent background with the renderer's text color (WCAG AA, 4.5:1).
  const buttonContrast = contrastRatio(accent, onAccent(accent));
  if (buttonContrast < 4.5) {
    report.errors.push({
      code: "contrast-button",
      message: `Contraste insuffisant du texte des boutons (${buttonContrast.toFixed(2)}:1, minimum 4.5:1). Choisis une couleur d’accent plus foncée ou plus claire.`,
    });
  }
  // Accent used for small text on the page background (AA large text minimum, 3:1).
  const accentOnBg = contrastRatio(accent, PAGE_BACKGROUNDS[background]);
  if (accentOnBg < 3) {
    report.warnings.push({
      code: "contrast-accent",
      message: `La couleur d’accent se distingue mal du fond (${accentOnBg.toFixed(2)}:1, 3:1 recommandé).`,
    });
  }

  const hasCta = page.sections.some((s) => "cta" in s && s.cta);
  if (NEEDS_CTA.includes(kind) && !hasCta) {
    report.warnings.push({ code: "no-cta", message: "Aucun appel à l’action sur une page qui doit convertir." });
  }
  const heroes = page.sections.filter((s) => s.type === "hero");
  if (heroes.length > 1) {
    report.warnings.push({ code: "many-heroes", message: "Plusieurs sections d’en-tête : garde une seule promesse principale." });
  }
  for (const s of heroes) {
    if (s.headline.length > 90) {
      report.warnings.push({ code: "long-headline", message: `Titre de « ${s.id} » long (${s.headline.length} caractères) : vise moins de 90.` });
    }
  }
  for (const s of page.sections) {
    if (s.type === "pricing" && s.price === 0) {
      report.warnings.push({ code: "zero-price", message: `Prix à 0 dans « ${s.id} » : vérifie le montant.` });
    }
    if ("cta" in s && s.cta?.href === "#") {
      report.warnings.push({ code: "placeholder-link", message: `Lien « # » dans « ${s.id} » : il ne mène nulle part.` });
    }
  }
  return report;
}
