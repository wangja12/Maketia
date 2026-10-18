import { describe, expect, it } from "vitest";
import { analyse, normalCdf, twoProportionTest, wilsonInterval } from "@/server/analytics/stats";

describe("statistics", () => {
  it("normal CDF matches known values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.645)).toBeCloseTo(0.05, 3);
  });

  it("Wilson interval matches the textbook example", () => {
    // 10 successes out of 100 → [0.0552, 0.1744] (Wilson 1927, z = 1.96)
    const [lo, hi] = wilsonInterval(10, 100);
    expect(lo).toBeCloseTo(0.0552, 3);
    expect(hi).toBeCloseTo(0.1744, 3);
    expect(wilsonInterval(0, 0)).toEqual([0, 0]);
  });

  it("two-proportion test", () => {
    // 100/1000 vs 130/1000: z ≈ 2.10, p ≈ 0.036
    const t = twoProportionTest(100, 1000, 130, 1000);
    expect(t.z).toBeCloseTo(2.10, 1);
    expect(t.p).toBeCloseTo(0.036, 2);
    expect(twoProportionTest(0, 0, 1, 10).p).toBe(1);
  });

  it("refuses to conclude on small samples", () => {
    const r = analyse([
      { label: "A", visitors: 40, conversions: 2, revenue: 0 },
      { label: "B", visitors: 38, conversions: 9, revenue: 0 },
    ]);
    expect(r.verdict.kind).toBe("insufficient");
  });

  it("applies Bonferroni across arms", () => {
    const base = { label: "A", visitors: 1000, conversions: 100, revenue: 0 };
    const two = analyse([base, { label: "B", visitors: 1000, conversions: 130, revenue: 0 }]);
    expect(two.verdict.kind).toBe("difference"); // p ≈ 0.036 < 0.05
    const four = analyse([base, { label: "B", visitors: 1000, conversions: 130, revenue: 0 }, { label: "C", visitors: 1000, conversions: 101, revenue: 0 }, { label: "D", visitors: 1000, conversions: 99, revenue: 0 }]);
    expect(four.threshold).toBeCloseTo(0.05 / 3, 6);
    expect(four.verdict.kind).toBe("no_difference"); // 0.036 > 0.0167
  });

  it("reports revenue per visitor", () => {
    const r = analyse([
      { label: "A", visitors: 200, conversions: 20, revenue: 100000 },
      { label: "B", visitors: 200, conversions: 20, revenue: 150000 },
    ]);
    expect(r.arms.map((a) => a.revenuePerVisitor)).toEqual([500, 750]);
  });
});
