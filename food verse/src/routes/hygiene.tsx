import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Video, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, errMsg } from "@/components/AppShell";
import { analyzeHygiene } from "@/lib/foodverse.functions";
import { preprocess, sampleVideoFrames } from "@/lib/vision";
import { addHistory } from "@/lib/history";

export const Route = createFileRoute("/hygiene")({
  head: () => ({
    meta: [
      { title: "Restaurant Hygiene Monitor — FoodVerse AI" },
      { name: "description", content: "Analyze kitchen video or camera frames for visible hygiene risks." },
      { property: "og:title", content: "Restaurant Hygiene Monitor — FoodVerse AI" },
      { property: "og:description", content: "Spot visible kitchen hygiene risks from video." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Result = Awaited<ReturnType<typeof analyzeHygiene>>;
const SEV = { low: "bg-muted text-foreground", medium: "bg-warning text-primary-foreground", high: "bg-destructive text-destructive-foreground" };

function Page() {
  const run = useServerFn(analyzeHygiene);
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState<MediaStream | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onVideo(f?: File) {
    if (!f) return;
    setErr(null); setRes(null); setBusy("Extracting frames…");
    try { setFrames(await sampleVideoFrames(f, 5)); } catch (e) { setErr(errMsg(e)); } finally { setBusy(null); }
  }
  async function startCam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCam(s); setFrames([]); setRes(null);
      setTimeout(() => video.current && (video.current.srcObject = s), 0);
    } catch { setErr("Camera unavailable or permission denied."); }
  }
  async function snap() {
    if (!video.current) return;
    const { dataUrl } = await preprocess(video.current, 768);
    setFrames((f) => [...f, dataUrl].slice(-6));
  }
  function stopCam() { cam?.getTracks().forEach((t) => t.stop()); setCam(null); }

  async function analyze() {
    if (!frames.length) return setErr("Add a video or capture camera frames first.");
    setBusy("Inspecting…"); setErr(null);
    try {
      const r = await run({ data: { frames } });
      setRes(r);
      if (r.is_kitchen) addHistory({ kind: "hygiene", score: Math.round(r.score), risks: r.risks.length });
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader title="Restaurant Hygiene Monitor" subtitle="Upload kitchen footage or use a live camera to flag visible risks." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => input.current?.click()} disabled={!!busy}><Video className="size-4" /> Upload video</Button>
            {cam ? <Button variant="outline" onClick={stopCam}>Stop camera</Button> : <Button variant="outline" onClick={startCam}><Camera className="size-4" /> Live camera</Button>}
          </div>
          <input ref={input} type="file" accept="video/*" hidden onChange={(e) => { onVideo(e.target.files?.[0]); e.target.value = ""; }} />
          {cam && (
            <div className="space-y-2">
              <video ref={video} autoPlay playsInline muted className="aspect-video w-full rounded-xl bg-muted object-cover" />
              <Button size="sm" onClick={snap}>Capture frame ({frames.length}/6)</Button>
            </div>
          )}
          {frames.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {frames.map((f, i) => (
                <div key={i} className="relative">
                  <img src={f} alt={`Frame ${i + 1}`} className="aspect-video w-full rounded-lg object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-background/80 px-1.5 text-xs">#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
          <Button className="w-full" onClick={analyze} disabled={!frames.length || !!busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} {busy ?? "Analyze hygiene"}
          </Button>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <p className="text-xs text-muted-foreground">Frames are processed for this analysis only and never stored on a server.</p>
        </Panel>
        <Panel>
          {!res ? <p className="text-sm text-muted-foreground">Results will appear here.</p> : !res.is_kitchen ? (
            <p className="text-warning">This doesn't look like a kitchen or food-prep area.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-end gap-3">
                <span className={`text-5xl font-bold ${res.score >= 80 ? "text-success" : res.score >= 60 ? "text-warning" : "text-destructive"}`}>{Math.round(res.score)}</span>
                <span className="pb-2 text-muted-foreground">/ 100 hygiene score</span>
              </div>
              <p className="text-sm">{res.summary}</p>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Risks ({res.risks.length})</h3>
                {res.risks.length ? <ul className="space-y-2">{res.risks.map((r, i) => (
                  <li key={i} className="rounded-lg bg-muted p-3 text-sm">
                    <div className="flex items-center gap-2"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${SEV[r.severity]}`}>{r.severity}</span><span className="font-medium">{r.issue}</span><span className="ml-auto text-xs text-muted-foreground">frame #{r.frame}</span></div>
                    <p className="mt-1 text-muted-foreground">Fix: {r.fix}</p>
                  </li>
                ))}</ul> : <p className="text-sm text-success">No visible risks detected.</p>}
              </div>
              {res.good_practices.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Good practices observed</h3><ul className="list-disc pl-5 text-sm">{res.good_practices.map((g) => <li key={g}>{g}</li>)}</ul></div>}
              <p className="text-xs text-muted-foreground">Automated visual review supports, but does not replace, a certified health inspection.</p>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
