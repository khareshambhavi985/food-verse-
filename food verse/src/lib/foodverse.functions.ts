import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const img = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,/, "Invalid image")
  .max(6_000_000, "Image too large");

const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const str = { type: "string" };
const num = { type: "number" };
const arr = (items: unknown) => ({ type: "array", items });

// When PYTHON_API_URL is set, forward to the FastAPI backend (backend/main.py).
async function py<T>(path: string, body: unknown): Promise<T | null> {
  const base = process.env["PYTHON_API_URL"];
  if (!base) return null;
  const r = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(typeof j?.detail === "string" ? j.detail : "Python backend error");
  return j as T;
}

const DISCLAIMER =
  "Visual analysis cannot guarantee food safety. When in doubt, throw it out.";

// ---------- Food recognition & nutrition ----------
export const recognizeFood = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ image: img, features: z.string().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const viaPy = await py<any>("/recognize", data);
    if (viaPy) return viaPy;
    const { callStructured } = await import("./ai.server");
    return callStructured<{
      is_food: boolean;
      dish: string;
      confidence: number;
      portion: string;
      items: { name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }[];
      totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; sodium_mg: number };
      notes: string;
    }>({
      schemaName: "food_recognition",
      system:
        "You are a food recognition and nutrition expert. Identify every food item visible, estimate portion weight in grams, and estimate nutrition using standard USDA-style values. If the image contains no food, set is_food=false, use empty items and zero totals. confidence is 0-1.",
      text: `Analyze this food image. Pre-computed image features: ${data.features}`,
      images: [data.image],
      schema: obj({
        is_food: { type: "boolean" },
        dish: str,
        confidence: num,
        portion: str,
        items: arr(obj({ name: str, grams: num, calories: num, protein: num, carbs: num, fat: num })),
        totals: obj({ calories: num, protein: num, carbs: num, fat: num, fiber: num, sugar: num, sodium_mg: num }),
        notes: str,
      }),
    });
  });

// ---------- Freshness ----------
export const detectFreshness = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ image: img, features: z.string().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const viaPy = await py<any>("/freshness", data);
    if (viaPy) return viaPy;
    const { callStructured } = await import("./ai.server");
    const r = await callStructured<{
      is_food: boolean;
      item: string;
      status: "fresh" | "moderately_fresh" | "potentially_spoiled";
      confidence: number;
      indicators: { name: string; observation: string; severity: "none" | "low" | "medium" | "high" }[];
      recommendations: string[];
      estimated_shelf_life: string;
    }>({
      schemaName: "freshness",
      system:
        "You assess food freshness from visual indicators only: color, discoloration, mold, bruising, wilting, sliminess, texture, dryness. Be conservative: any visible mold => potentially_spoiled. If no food, is_food=false. confidence is 0-1.",
      text: `Classify freshness. Pre-computed color/texture features: ${data.features}`,
      images: [data.image],
      schema: obj({
        is_food: { type: "boolean" },
        item: str,
        status: { type: "string", enum: ["fresh", "moderately_fresh", "potentially_spoiled"] },
        confidence: num,
        indicators: arr(obj({ name: str, observation: str, severity: { type: "string", enum: ["none", "low", "medium", "high"] } })),
        recommendations: arr(str),
        estimated_shelf_life: str,
      }),
    });
    return { ...r, disclaimer: DISCLAIMER };
  });

// ---------- Hygiene ----------
export const analyzeHygiene = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ frames: z.array(img).min(1).max(6) }).parse(d))
  .handler(async ({ data }) => {
    const viaPy = await py<any>("/hygiene", data);
    if (viaPy) return viaPy;
    const { callStructured } = await import("./ai.server");
    return callStructured<{
      is_kitchen: boolean;
      score: number;
      summary: string;
      risks: { issue: string; severity: "low" | "medium" | "high"; frame: number; fix: string }[];
      good_practices: string[];
    }>({
      schemaName: "hygiene",
      system:
        "You are a food safety inspector reviewing frames from a kitchen video/camera. Identify visible hygiene risks only (no gloves/hairnet when handling food, raw/cooked cross-contamination, dirty surfaces, pests, uncovered food, waste near prep, improper storage). Do not guess what is not visible. score 0-100 (100 = excellent). frame is the 1-based frame index.",
      text: `Inspect these ${data.frames.length} frames.`,
      images: data.frames,
      schema: obj({
        is_kitchen: { type: "boolean" },
        score: num,
        summary: str,
        risks: arr(obj({ issue: str, severity: { type: "string", enum: ["low", "medium", "high"] }, frame: num, fix: str })),
        good_practices: arr(str),
      }),
    });
  });

// ---------- Smart kitchen ----------
export const kitchenAssist = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        question: z.string().trim().min(2).max(1000),
        history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(12),
        image: img.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const viaPy = await py<any>("/kitchen", data);
    if (viaPy) return viaPy;
    const { callStructured } = await import("./ai.server");
    const hist = data.history.map((h) => `${h.role.toUpperCase()}: ${h.text}`).join("\n");
    return callStructured<{ answer: string; steps: string[]; safety_tips: string[] }>({
      schemaName: "kitchen",
      system:
        "You are a concise smart kitchen assistant. Give practical cooking guidance, substitutions, timings and safe internal temperatures. steps may be empty when not a recipe/procedure.",
      text: `${hist ? `Conversation so far:\n${hist}\n\n` : ""}USER: ${data.question}`,
      images: data.image ? [data.image] : [],
      schema: obj({ answer: str, steps: arr(str), safety_tips: arr(str) }),
    });
  });

// ---------- Meal planner ----------
const profile = z.object({
  age: z.number().int().min(13).max(100),
  sex: z.enum(["male", "female"]),
  height: z.number().min(120).max(230),
  weight: z.number().min(30).max(300),
  activity: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose", "maintain", "gain"]),
  diet: z.string().max(60),
  allergies: z.string().max(200),
  targetCalories: z.number().min(1000).max(5000),
});

const meal = obj({ type: str, name: str, description: str, calories: num, protein: num, carbs: num, fat: num });

export const generateMealPlan = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ profile, days: z.union([z.literal(1), z.literal(7)]) }).parse(d))
  .handler(async ({ data }) => {
    const viaPy = await py<any>("/meal-plan", data);
    if (viaPy) return viaPy;
    const { callStructured } = await import("./ai.server");
    const p = data.profile;
    return callStructured<{
      days: { day: string; meals: { type: string; name: string; description: string; calories: number; protein: number; carbs: number; fat: number }[] }[];
      tips: string[];
    }>({
      schemaName: "meal_plan",
      system:
        "You are a registered dietitian. Create realistic, varied meal plans. Strictly exclude allergens and respect the dietary preference. Each day has breakfast, lunch, dinner and one snack, and the day's total should be within ±5% of the calorie target.",
      text: `Create a ${data.days}-day plan. Profile: age ${p.age}, ${p.sex}, ${p.height}cm, ${p.weight}kg, activity ${p.activity}, goal ${p.goal}. Diet: ${p.diet || "none"}. Allergies: ${p.allergies || "none"}. Daily calorie target: ${p.targetCalories} kcal.`,
      schema: obj({ days: arr(obj({ day: str, meals: arr(meal) })), tips: arr(str) }),
    });
  });
