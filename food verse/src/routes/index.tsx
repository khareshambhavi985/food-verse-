import { createFileRoute, Link } from "@tanstack/react-router";
import { ScanLine, Thermometer, ShieldCheck, ChefHat, CalendarDays, ArrowRight, Download, Trash2, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/AppShell";
import { clearHistory, loadProfile, useHistory, type HistoryEntry } from "@/lib/history";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoodVerse AI — Multimodal Food Intelligence Dashboard" },
      { name: "description", content: "Recognize food, check freshness, monitor kitchen hygiene and plan meals with AI." },
      { property: "og:title", content: "FoodVerse AI — Food Intelligence Dashboard" },
      { property: "og:description", content: "Food recognition, freshness, hygiene and personalized meal planning in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const MODULES = [
  { to: "/recognition", title: "Food Recognition", desc: "Identify dishes & nutrition", icon: ScanLine, tone: "bg-chart-1" },
  { to: "/freshness", title: "Freshness Detector", desc: "Detect spoilage signs", icon: Thermometer, tone: "bg-chart-2" },
  { to: "/hygiene", title: "Hygiene Monitor", desc: "Kitchen compliance check", icon: ShieldCheck, tone: "bg-chart-3" },
  { to: "/kitchen", title: "Smart Kitchen", desc: "Real-time cooking aid", icon: ChefHat, tone: "bg-chart-5" },
  { to: "/planner", title: "Meal Planner", desc: "Personalized diet plans", icon: CalendarDays, tone: "bg-chart-4" },
] as const;

type Profile = { targetCalories: number; goal: string; allergies: string };

function recommendations(h: HistoryEntry[], p: Profile | null): string[] {
  const out: string[] = [];
  const today = new Date().toDateString();
  const foods = h.filter((e) => e.kind === "food" && new Date(e.at).toDateString() === today) as Extract<HistoryEntry, { kind: "food" }>[];
  const kcal = foods.reduce((s, f) => s + f.calories, 0);
  const protein = foods.reduce((s, f) => s + f.protein, 0);
  if (p) {
    const left = p.targetCalories - kcal;
    if (foods.length) out.push(left > 0 ? `You have about ${left} kcal left today toward your ${p.targetCalories} kcal target.` : `You're ${-left} kcal over today's target — keep dinner light and vegetable-forward.`);
    if (foods.length && protein < 50) out.push("Protein is low so far today — add eggs, legumes, Greek yogurt or lean meat.");
    if (p.allergies) out.push(`Remember to check labels for: ${p.allergies}.`);
  } else out.push("Create a profile in Meal Planner to unlock calorie-aware recommendations.");
  const spoiled = h.filter((e) => e.kind === "freshness" && e.status === "potentially_spoiled");
  if (spoiled.length) out.push(`${spoiled.length} item(s) flagged as potentially spoiled — discard rather than taste-test.`);
  const lastHyg = h.find((e) => e.kind === "hygiene") as Extract<HistoryEntry, { kind: "hygiene" }> | undefined;
  if (lastHyg && lastHyg.score < 70) out.push(`Last kitchen hygiene score was ${lastHyg.score}/100 — review the flagged risks.`);
  const fat = foods.reduce((s, f) => s + f.fat, 0);
  if (kcal > 0 && (fat * 9) / kcal > 0.4) out.push("Today's meals are high in fat (>40% of calories) — balance with whole grains and vegetables.");
  if (!h.length) out.push("Scan your first meal to start building your nutrition report.");
  return out;
}

function Index() {
  const h = useHistory();
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => setProfile(loadProfile<Profile>()), [h]);

  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    const kcal = h.filter((e) => e.kind === "food" && new Date(e.at).toDateString() === key).reduce((s, e) => s + (e as { calories: number }).calories, 0);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), kcal: Math.round(kcal) };
  });
  const fr = ["fresh", "moderately_fresh", "potentially_spoiled"].map((s) => ({
    name: s.replace("_", " "),
    value: h.filter((e) => e.kind === "freshness" && e.status === s).length,
  }));
  const frColors = ["var(--chart-1)", "var(--chart-4)", "var(--destructive)"];

  function exportCsv() {
    const rows = [["time", "kind", "detail", "value"], ...h.map((e) => [new Date(e.at).toISOString(), e.kind,
      e.kind === "food" ? e.dish : e.kind === "freshness" ? `${e.item} (${e.status})` : e.kind === "hygiene" ? `${e.risks} risks` : `${e.days}-day plan`,
      e.kind === "food" ? e.calories : e.kind === "freshness" ? e.confidence : e.kind === "hygiene" ? e.score : e.calories])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "foodverse-report.csv";
    a.click();
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-hero p-8 md:p-10">
        <h1 className="text-4xl font-bold md:text-5xl">
          Welcome to <span className="text-primary">FoodVerse AI</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">A unified multimodal AI platform for the food lifecycle — from what's on your plate to what's in your kitchen.</p>
        <Button asChild className="mt-6"><Link to="/recognition">Start analysis</Link></Button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {MODULES.map(({ to, title, desc, icon: Icon, tone }) => (
          <Link key={to} to={to} className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary">
            <span className={`grid size-10 place-items-center rounded-xl ${tone} text-primary-foreground`}><Icon className="size-5" /></span>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
            <span className="mt-3 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground group-hover:text-primary">Launch <ArrowRight className="size-3" /></span>
          </Link>
        ))}
      </div>

      <Panel>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-5 text-primary" /> AI Recommendations</h2>
        <ul className="space-y-2 text-sm">{recommendations(h, profile).map((r) => <li key={r} className="rounded-lg bg-muted px-3 py-2">{r}</li>)}</ul>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Calories logged — last 7 days</h2>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={days}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="kcal" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <h2 className="mb-4 font-semibold">Freshness checks</h2>
          {fr.some((f) => f.value) ? (
            <div className="h-60">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={fr} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {fr.map((_, i) => <Cell key={i} fill={frColors[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-muted-foreground">No freshness checks yet.</p>}
        </Panel>
      </div>

      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Recent activity</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!h.length}><Download className="size-4" /> Export CSV</Button>
            <Button size="sm" variant="outline" onClick={() => confirm("Delete all local history and profile?") && clearHistory()} disabled={!h.length}><Trash2 className="size-4" /> Clear</Button>
          </div>
        </div>
        {h.length ? (
          <ul className="divide-y divide-border text-sm">
            {h.slice(0, 10).map((e) => (
              <li key={e.id} className="flex justify-between py-2">
                <span className="capitalize">
                  {e.kind === "food" && `🍽 ${e.dish} — ${e.calories} kcal`}
                  {e.kind === "freshness" && `🌡 ${e.item} — ${e.status.replace("_", " ")}`}
                  {e.kind === "hygiene" && `🛡 Hygiene score ${e.score}/100 (${e.risks} risks)`}
                  {e.kind === "plan" && `📅 ${e.days}-day meal plan @ ${e.calories} kcal`}
                </span>
                <span className="text-muted-foreground">{new Date(e.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Your analyses will appear here.</p>}
      </Panel>
    </div>
  );
}
