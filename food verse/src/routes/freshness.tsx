import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, errMsg } from "@/components/AppShell";
import { FeatureList, ImagePicker, type Picked } from "@/components/ImagePicker";
import { detectFreshness } from "@/lib/foodverse.functions";
import { addHistory } from "@/lib/history";

export const Route = createFileRoute("/freshness")({
  head: () => ({
    meta: [
      { title: "Freshness & Spoilage Detector — FoodVerse AI" },
      { name: "description", content: "Check visual freshness indicators of produce and food with confidence levels." },
      { property: "og:title", content: "Freshness & Spoilage Detector — FoodVerse AI" },
      { property: "og:description", content: "Classify food as fresh, moderately fresh or potentially spoiled." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Result = Awaited<ReturnType<typeof detectFreshness>>;
const STATUS = {
  fresh: { label: "Fresh", cls: "bg-success text-primary-foreground" },
  moderately_fresh: { label: "Moderately fresh", cls: "bg-warning text-primary-foreground" },
  potentially_spoiled: { label: "Potentially spoiled", cls: "bg-destructive text-destructive-foreground" },
};
const SEV = { none: "text-success", low: "text-muted-foreground", medium: "text-warning", high: "text-destructive" };

function Page() {
  const run = useServerFn(detectFreshness);
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
      if (r.is_food) addHistory({ kind: "freshness", item: r.item, status: r.status, confidence: r.confidence });
    } catch (e) { setErr(errMsg(e)); } finally { setLoading(false); }
  }

  return (
    <>
      <PageHeader title="Freshness & Spoilage Detection" subtitle="Analyze color, texture and surface indicators." />
      <div className="mb-6 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
        <AlertTriangle className="size-5 shrink-0 text-warning" />
        <p>Visual freshness detection <strong>cannot guarantee food safety</strong>. Smell, storage time, temperature history and hidden bacteria can't be seen in a photo. When in doubt, throw it out.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <ImagePicker value={img} onChange={(p) => { setImg(p); setRes(null); }} />
          {img && <FeatureList f={img.features} />}
          <Button className="w-full" onClick={analyze} disabled={!img || loading}>
            {loading && <Loader2 className="size-4 animate-spin" />} Check freshness
          </Button>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </Panel>
        <Panel>
          {!res ? <p className="text-sm text-muted-foreground">Results will appear here.</p> : !res.is_food ? (
            <p className="text-warning">No food detected. Try a closer photo of the item.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold capitalize">{res.item}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[res.status].cls}`}>{STATUS[res.status].label}</span>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Confidence</span><span>{Math.round(res.confidence * 100)}%</span></div>
                <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${res.confidence * 100}%` }} /></div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Visual indicators</h3>
                <ul className="space-y-2 text-sm">{res.indicators.map((i) => (
                  <li key={i.name} className="rounded-lg bg-muted px-3 py-2"><span className={`font-medium ${SEV[i.severity]}`}>{i.name}</span> — {i.observation}</li>
                ))}</ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Safety recommendations</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">{res.recommendations.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
              <p className="text-sm text-muted-foreground">Estimated shelf life: {res.estimated_shelf_life}</p>
              <p className="text-xs text-warning">{res.disclaimer}</p>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
