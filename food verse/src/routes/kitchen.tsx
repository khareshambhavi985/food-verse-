import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Panel, errMsg } from "@/components/AppShell";
import { kitchenAssist } from "@/lib/foodverse.functions";
import { fileToDataUrl, preprocess, validateImageFile } from "@/lib/vision";

export const Route = createFileRoute("/kitchen")({
  head: () => ({
    meta: [
      { title: "Smart Kitchen Assistant — FoodVerse AI" },
      { name: "description", content: "Ask cooking questions, get step-by-step guidance and food safety tips." },
      { property: "og:title", content: "Smart Kitchen Assistant — FoodVerse AI" },
      { property: "og:description", content: "Step-by-step cooking guidance with safety tips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Msg = { role: "user" | "assistant"; text: string; steps?: string[]; tips?: string[]; image?: string | undefined };
const SUGGEST = ["What can I cook with eggs, spinach and feta?", "Safe internal temperature for chicken?", "How do I substitute buttermilk?"];

function Page() {
  const run = useServerFn(kitchenAssist);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(text = q) {
    const question = text.trim();
    if (question.length < 2) return setErr("Please type a question.");
    setErr(null); setLoading(true);
    const history = msgs.map((m) => ({ role: m.role, text: m.text })).slice(-12);
    setMsgs((m) => [...m, { role: "user", text: question, image: img ?? undefined }]);
    setQ(""); const image = img; setImg(null);
    try {
      const r = await run({ data: { question, history, image: image ?? undefined } });
      setMsgs((m) => [...m, { role: "assistant", text: r.answer, steps: r.steps, tips: r.safety_tips }]);
    } catch (e) { setErr(errMsg(e)); } finally { setLoading(false); }
  }

  async function pick(f?: File) {
    if (!f) return;
    const v = validateImageFile(f);
    if (v) return setErr(v);
    try { setImg((await preprocess(await fileToDataUrl(f), 768)).dataUrl); } catch (e) { setErr(errMsg(e)); }
  }

  return (
    <>
      <PageHeader title="Smart Kitchen Assistant" subtitle="Cooking guidance, substitutions and safety — snap your ingredients for ideas." />
      <Panel className="flex min-h-[60vh] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto">
          {!msgs.length && (
            <div className="flex flex-wrap gap-2">{SUGGEST.map((s) => <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>{s}</Button>)}</div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-auto max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground" : "max-w-[90%] rounded-2xl bg-muted px-4 py-3"}>
              {m.image && <img src={m.image} alt="Attached" className="mb-2 max-h-40 rounded-lg" />}
              <p className="whitespace-pre-wrap text-sm">{m.text}</p>
              {m.steps && m.steps.length > 0 && <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{m.steps.map((s, j) => <li key={j}>{s}</li>)}</ol>}
              {m.tips && m.tips.length > 0 && <div className="mt-3 rounded-lg bg-accent p-2 text-xs text-accent-foreground">🛡 {m.tips.join(" · ")}</div>}
            </div>
          ))}
          {loading && <Loader2 className="size-5 animate-spin text-primary" />}
        </div>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        {img && <div className="relative mt-3 w-fit"><img src={img} alt="To send" className="h-16 rounded" /><button onClick={() => setImg(null)} className="absolute -right-2 -top-2 rounded-full bg-background p-0.5" aria-label="Remove"><X className="size-3" /></button></div>}
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label className="grid cursor-pointer place-items-center rounded-md border border-input px-3" aria-label="Attach image">
            <ImagePlus className="size-4" />
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <Textarea value={q} onChange={(e) => setQ(e.target.value)} maxLength={1000} rows={1} placeholder="Ask anything about cooking…" className="min-h-10 resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <Button type="submit" disabled={loading}><Send className="size-4" /></Button>
        </form>
      </Panel>
    </>
  );
}
