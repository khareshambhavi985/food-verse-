import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, errMsg } from "@/components/AppShell";
import { FeatureList, ImagePicker, type Picked } from "@/components/ImagePicker";
import { recognizeFood } from "@/lib/foodverse.functions";
import { addHistory } from "@/lib/history";

export const Route = createFileRoute("/recognition")({
  head: () => ({
    meta: [
      { title: "Food Recognition & Nutrition — FoodVerse AI" },
      { name: "description", content: "Upload a food photo to identify dishes and estimate calories and macronutrients." },
      { property: "og:title", content: "Food Recognition & Nutrition — FoodVerse AI" },
      { property: "og:description", content: "Identify food and estimate nutrition from a photo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Result = Awaited<ReturnType<typeof recognizeFood>>;

function Page() {
  const run = useServerFn(recognizeFood);
  const [img, setImg] = useState<Picked | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function analyze() {
    if (!img) return setErr("Please select an image first.");
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await run({ data: { image: img.dataUrl, features: JSON.stringify(img.features) } });
      setRes(r);
      if (r.is_food) addHistory({ kind: "food", dish: r.dish, calories: Math.round(r.totals.calories), protein: r.totals.protein, carbs: r.totals.carbs, fat: r.totals.fat });
    } catch (e) { setErr(errMsg(e)); } finally { setLoading(false); }
  }

  return (
    <>
      <PageHeader title="Food Recognition & Nutrition" subtitle="Identify dishes and estimate their nutritional content." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <ImagePicker value={img} onChange={(p) => { setImg(p); setRes(null); }} />
          {img && <FeatureList f={img.features} />}
          <Button className="w-full" onClick={analyze} disabled={!img || loading}>
            {loading && <Loader2 className="size-4 animate-spin" />} Analyze food
          </Button>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </Panel>
        <Panel>
          {!res ? <p className="text-sm text-muted-foreground">Results will appear here.</p> : !res.is_food ? (
            <p className="text-warning">No food detected in this image. Try a clearer photo of a meal.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold capitalize">{res.dish}</h2>
                <p className="text-sm text-muted-foreground">{res.portion} · confidence {Math.round(res.confidence * 100)}%</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Calories", `${Math.round(res.totals.calories)}`, "kcal"], ["Protein", res.totals.protein, "g"], ["Carbs", res.totals.carbs, "g"], ["Fat", res.totals.fat, "g"]].map(([k, v, u]) => (
                  <div key={k as string} className="rounded-xl bg-muted p-3 text-center">
                    <div className="text-xl font-bold text-primary">{Math.round(Number(v))}</div>
                    <div className="text-xs text-muted-foreground">{k} ({u})</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Fiber {res.totals.fiber}g · Sugar {res.totals.sugar}g · Sodium {Math.round(res.totals.sodium_mg)}mg</p>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground"><tr><th>Item</th><th>g</th><th>kcal</th><th>P</th><th>C</th><th>F</th></tr></thead>
                <tbody>{res.items.map((i) => (
                  <tr key={i.name} className="border-t border-border"><td className="py-1.5 capitalize">{i.name}</td><td>{Math.round(i.grams)}</td><td>{Math.round(i.calories)}</td><td>{Math.round(i.protein)}</td><td>{Math.round(i.carbs)}</td><td>{Math.round(i.fat)}</td></tr>
                ))}</tbody>
              </table>
              {res.notes && <p className="text-sm text-muted-foreground">{res.notes}</p>}
              <p className="text-xs text-muted-foreground">Nutrition values are estimates based on visual portion size.</p>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
