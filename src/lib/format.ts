/** fr-FR display helpers shared by the app and published pages. */

export function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

const integer = new Intl.NumberFormat("fr-FR");
export const count = (n: number) => integer.format(n);

const pct = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const percent = (ratio: number) => pct.format(ratio);
