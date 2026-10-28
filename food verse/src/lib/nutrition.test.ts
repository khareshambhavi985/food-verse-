import { describe, it, expect } from "vitest";
import { bmr, tdee, targetCalories, bmi, macros } from "./nutrition";

describe("nutrition", () => {
  it("computes Mifflin-St Jeor BMR", () => {
    expect(bmr("male", 70, 175, 30)).toBe(1649);
    expect(bmr("female", 60, 165, 25)).toBe(1345);
  });
  it("applies activity factor", () => {
    expect(tdee(1649, "moderate")).toBe(2556);
  });
  it("adjusts calories by goal with 1200 floor", () => {
    expect(targetCalories(2556, "lose")).toBe(2056);
    expect(targetCalories(2556, "gain")).toBe(2856);
    expect(targetCalories(1500, "lose")).toBe(1200);
  });
  it("computes BMI", () => {
    expect(bmi(70, 175)).toBe(22.9);
  });
  it("splits macros", () => {
    expect(macros(2000, 70, "lose")).toEqual({ protein: 140, fat: 56, carbs: 234 });
  });
});
