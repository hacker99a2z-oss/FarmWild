import { describe, expect, it } from "vitest";
import { CROP_RULES, GROW_MS, dailyStatus, dayKey, fieldParts, growStage, isReady, seedPriceCents } from "./rules";

describe("seeds, growth and daily reward", () => {
  it("ads needed per crop", () => {
    expect(Object.values(CROP_RULES).map((c) => c.adsNeed)).toEqual([10, 20, 28, 36, 45]);
  });
  it("10 seeds prices", () => {
    expect(seedPriceCents("wheat", 10)).toBe(1);
    expect(seedPriceCents("pumpkin", 10)).toBe(4.5);
    expect(seedPriceCents("carrot", 20)).toBeCloseTo(5.6);
  });
  it("grows in 10 steps by time or ads", () => {
    const f = { planted: true, plantedAt: 0, ads: 0 };
    expect(growStage("wheat", f, GROW_MS / 10)).toBe(1);
    expect(isReady("wheat", f, GROW_MS)).toBe(true);
    expect(growStage("wheat", { ...f, ads: 3 }, 0)).toBe(3);
    expect(isReady("corn", { ...f, ads: 20 }, 0)).toBe(true);
  });
  it("empty fields have 2 parts, pumpkin 4", () => {
    expect(fieldParts("wheat")).toHaveLength(2);
    expect(fieldParts("pumpkin")).toHaveLength(4);
  });
  it("daily streak resets after a missed day or a finished week", () => {
    const now = Date.parse("2026-10-13T10:00:00Z");
    const yest = dayKey(now - 86_400_000);
    expect(dailyStatus({ streak: 3, lastDay: yest }, now)).toEqual({ done: 3, canClaim: true });
    expect(dailyStatus({ streak: 3, lastDay: "2026-10-10" }, now)).toEqual({ done: 0, canClaim: true });
    expect(dailyStatus({ streak: 7, lastDay: yest }, now)).toEqual({ done: 0, canClaim: true });
    expect(dailyStatus({ streak: 2, lastDay: dayKey(now) }, now)).toEqual({ done: 2, canClaim: false });
  });
});
