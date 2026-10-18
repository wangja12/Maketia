/*
 * Statistics for A/B results. Documented, conventional, and deliberately conservative:
 * - Conversion rate per arm with a 95 % Wilson score interval.
 * - Each arm compared with the control (the first arm, usually A) by a two-sided
 *   two-proportion z-test, with a Bonferroni correction for k − 1 comparisons.
 * - No conclusion at all below MIN_VISITORS visitors and MIN_CONVERSIONS conversions per arm.
 * These are measures of uncertainty, not a verdict: the person decides.
 */

export const MIN_VISITORS = 100;
export const MIN_CONVERSIONS = 10;
export const ALPHA = 0.05;

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function wilsonInterval(conversions: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = conversions / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Two-sided p-value for the difference between two proportions (pooled variance). */
export function twoProportionTest(c1: number, n1: number, c2: number, n2: number) {
  if (n1 === 0 || n2 === 0) return { z: 0, p: 1 };
  const pooled = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return { z: 0, p: 1 };
  const z = (c2 / n2 - c1 / n1) / se;
  return { z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}

export type ArmInput = { label: string; visitors: number; conversions: number; revenue: number };

export type ArmResult = ArmInput & {
  rate: number;
  interval: [number, number];
  revenuePerVisitor: number;
  enoughData: boolean;
  /** Comparison with the control; null for the control itself. */
  vsControl: null | { difference: number; pValue: number; significant: boolean };
};

export type Verdict =
  | { kind: "insufficient"; message: string }
  | { kind: "no_difference"; message: string }
  | { kind: "difference"; message: string; better: string[]; worse: string[] };

export function analyse(arms: ArmInput[]): { arms: ArmResult[]; verdict: Verdict; threshold: number } {
  const comparisons = Math.max(1, arms.length - 1);
  const threshold = ALPHA / comparisons;
  const control = arms[0];
  const results: ArmResult[] = arms.map((a, i) => {
    const rate = a.visitors ? a.conversions / a.visitors : 0;
    const enoughData = a.visitors >= MIN_VISITORS && a.conversions >= MIN_CONVERSIONS;
    let vsControl: ArmResult["vsControl"] = null;
    if (i > 0 && control) {
      const t = twoProportionTest(control.conversions, control.visitors, a.conversions, a.visitors);
      const controlRate = control.visitors ? control.conversions / control.visitors : 0;
      vsControl = { difference: rate - controlRate, pValue: t.p, significant: t.p < threshold };
    }
    return { ...a, rate, interval: wilsonInterval(a.conversions, a.visitors), revenuePerVisitor: a.visitors ? a.revenue / a.visitors : 0, enoughData, vsControl };
  });

  let verdict: Verdict;
  if (results.length < 2 || results.some((r) => !r.enoughData)) {
    verdict = {
      kind: "insufficient",
      message: `Données insuffisantes : il faut au moins ${MIN_VISITORS} visiteurs et ${MIN_CONVERSIONS} conversions par variante avant de comparer. Ne choisissez pas de gagnant maintenant.`,
    };
  } else {
    const better = results.filter((r) => r.vsControl?.significant && r.vsControl.difference > 0).map((r) => r.label);
    const worse = results.filter((r) => r.vsControl?.significant && r.vsControl.difference < 0).map((r) => r.label);
    if (better.length === 0 && worse.length === 0) {
      verdict = { kind: "no_difference", message: `Aucune différence statistiquement significative avec ${control.label} (seuil p < ${threshold.toFixed(3)}). Les écarts observés peuvent venir du hasard.` };
    } else {
      const parts = [
        better.length ? `${better.join(", ")} convertit mieux que ${control.label}` : "",
        worse.length ? `${worse.join(", ")} convertit moins bien que ${control.label}` : "",
      ].filter(Boolean);
      verdict = { kind: "difference", better, worse, message: `${parts.join(" ; ")} (p < ${threshold.toFixed(3)}). Résultat probable, pas une certitude : vérifiez la période et le volume avant de décider.` };
    }
  }
  return { arms: results, verdict, threshold };
}
