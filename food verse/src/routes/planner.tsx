import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel, errMsg } from "@/components/AppShell";
import { generateMealPlan } from "@/lib/foodverse.functions";
import { bmi, bmr, macros, targetCalories, tdee, type Activity, type Goal } from "@/lib/nutrition";
import { addHistory, loadProfile, saveProfile } from "@/lib/history";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Personalized Meal Planner — FoodVerse AI" },
      { name: "description", content: "Daily and weekly meal plans tailored to your body, goals, diet and allergies." },
      { property: "og:title", content: "Personalized Meal Planner — FoodVerse AI" },
      { property: "og:description", content: "AI meal plans with calorie and macro targets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Form = { age: string; sex: "male" | "female"; height: string; weight: string; activity: Activity; goal: Goal; diet: string; allergies: string };
type Plan = Awaited<ReturnType<typeof generateMealPlan>>;
const DEF: Form = { age: "", sex: "male", height: "", weight: "", activity: "moderate", goal: "maintain", diet: "", allergies: "" };
const sel = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

function Page() {
  const run = useServerFn(generateMealPlan);
  const [f, setF] = useState<Form>(DEF);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { const p = loadProfile<Form>(); if (p?.age) setF({ ...DEF, ...p, age: String(p.age), height: String(p.height), weight: String(p.weight) }); }, []);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const age = Number(f.age), h = Number(f.height), w = Number(f.weight);
  const valid = age >= 13 && age <= 100 && h >= 120 && h <= 230 && w >= 30 && w <= 300;
  const stats = valid ? (() => { const b = bmr(f.sex, w, h, age); const t = tdee(b, f.activity); const kcal = targetCalories(t, f.goal); return { b, t, kcal, bmi: bmi(w, h), m: macros(kcal, w, f.goal) }; })() : null;

  async function generate(days: 1 | 7) {
    if (!stats) return setErr("Enter valid age (13–100), height (120–230 cm) and weight (30–300 kg).");
    setErr(null); setLoading(true);
    const profile = { age, sex: f.sex, height: h, weight: w, activity: f.activity, goal: f.goal, diet: f.diet.trim(), allergies: f.allergies.trim(), targetCalories: stats.kcal };
    saveProfile({ ...profile });
    try {
      const r = await run({ data: { profile, days } });
      setPlan(r);
      addHistory({ kind: "plan", days, calories: stats.kcal });
    } catch (e) { setErr(errMsg(e)); } finally { setLoading(false); }
  }

  const chart = plan?.days.map((d) => ({ day: d.day.slice(0, 3), Protein: Math.round(d.meals.reduce((s, m) => s + m.protein, 0)), Carbs: Math.round(d.meals.reduce((s, m) => s + m.carbs, 0)), Fat: Math.round(d.meals.reduce((s, m) => s + m.fat, 0)) }));

  return (
    <>
      <PageHeader title="Personalized Meal Planner" subtitle="Your profile is saved only on this device." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Age</Label><Input type="number" value={f.age} onChange={(e) => set("age", e.target.value)} /></div>
            <div><Label>Sex</Label><select className={sel} value={f.sex} onChange={(e) => set("sex", e.target.value as Form["sex"])}><option value="male">Male</option><option value="female">Female</option></select></div>
            <div><Label>Height (cm)</Label><Input type="number" value={f.height} onChange={(e) => set("height", e.target.value)} /></div>
            <div><Label>Weight (kg)</Label><Input type="number" value={f.weight} onChange={(e) => set("weight", e.target.value)} /></div>
          </div>
          <div><Label>Activity</Label><select className={sel} value={f.activity} onChange={(e) => set("activity", e.target.value as Activity)}>
            <option value="sedentary">Sedentary</option><option value="light">Lightly active</option><option value="moderate">Moderately active</option><option value="active">Active</option><option value="very_active">Very active</option></select></div>
          <div><Label>Goal</Label><select className={sel} value={f.goal} onChange={(e) => set("goal", e.target.value as Goal)}>
            <option value="lose">Lose weight</option><option value="maintain">Maintain</option><option value="gain">Gain muscle</option></select></div>
          <div><Label>Dietary preference</Label><Input maxLength={60} placeholder="e.g. vegetarian, keto" value={f.diet} onChange={(e) => set("diet", e.target.value)} /></div>
          <div><Label>Allergies</Label><Input maxLength={200} placeholder="e.g. peanuts, shellfish" value={f.allergies} onChange={(e) => set("allergies", e.target.value)} /></div>
          {stats && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[["BMI", stats.bmi], ["BMR", `${stats.b} kcal`], ["TDEE", `${stats.t} kcal`], ["Target", `${stats.kcal} kcal`], ["Protein", `${stats.m.protein} g`], ["Carbs / Fat", `${stats.m.carbs} / ${stats.m.fat} g`]].map(([k, v]) => (
                <div key={k as string} className="rounded-lg bg-muted px-3 py-2"><div className="text-muted-foreground">{k}</div><div className="font-semibold">{v}</div></div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => generate(1)} disabled={loading}>{loading && <Loader2 className="size-4 animate-spin" />} Daily plan</Button>
            <Button className="flex-1" variant="outline" onClick={() => generate(7)} disabled={loading}>Weekly plan</Button>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </Panel>
        <div className="space-y-4 lg:col-span-2">
          {!plan ? <Panel><p className="text-sm text-muted-foreground">Fill in your profile and generate a plan.</p></Panel> : (
            <>
              {chart && chart.length > 1 && (
                <Panel><h2 className="mb-3 font-semibold">Weekly macros (g)</h2><div className="h-56"><ResponsiveContainer><BarChart data={chart}>
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} /><YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} /><Legend />
                  <Bar dataKey="Protein" stackId="a" fill="var(--chart-1)" /><Bar dataKey="Carbs" stackId="a" fill="var(--chart-3)" /><Bar dataKey="Fat" stackId="a" fill="var(--chart-2)" />
                </BarChart></ResponsiveContainer></div></Panel>
              )}
              {plan.days.map((d) => {
                const total = Math.round(d.meals.reduce((s, m) => s + m.calories, 0));
                return (
                  <Panel key={d.day}>
                    <div className="mb-3 flex justify-between"><h3 className="font-semibold">{d.day}</h3><span className="text-sm text-primary">{total} kcal</span></div>
                    <div className="grid gap-2 sm:grid-cols-2">{d.meals.map((m) => (
                      <div key={m.type + m.name} className="rounded-lg bg-muted p-3 text-sm">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.type}</div>
                        <div className="font-medium">{m.name}</div>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                        <p className="mt-1 text-xs">{Math.round(m.calories)} kcal · P{Math.round(m.protein)} C{Math.round(m.carbs)} F{Math.round(m.fat)}</p>
                      </div>
                    ))}</div>
                  </Panel>
                );
              })}
              {plan.tips.length > 0 && <Panel><h3 className="mb-2 font-semibold">Tips</h3><ul className="list-disc pl-5 text-sm">{plan.tips.map((t) => <li key={t}>{t}</li>)}</ul></Panel>}
              <p className="text-xs text-muted-foreground">Meal plans are general guidance, not medical advice. Consult a professional for medical conditions.</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
