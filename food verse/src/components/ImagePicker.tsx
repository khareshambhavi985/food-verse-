import { useRef, useState } from "react";
import { Upload, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileToDataUrl, preprocess, qualityWarnings, validateImageFile, type Features } from "@/lib/vision";

export type Picked = { dataUrl: string; features: Features; warnings: string[] };

export function ImagePicker({ value, onChange }: { value: Picked | null; onChange: (p: Picked | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState<MediaStream | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handle(src: string | HTMLVideoElement) {
    try {
      const { dataUrl, features } = await preprocess(src);
      onChange({ dataUrl, features, warnings: qualityWarnings(features) });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid image");
    }
  }

  async function onFile(f?: File) {
    if (!f) return;
    const v = validateImageFile(f);
    if (v) return setErr(v);
    await handle(await fileToDataUrl(f));
  }

  async function startCam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCam(s);
      setTimeout(() => video.current && (video.current.srcObject = s), 0);
    } catch {
      setErr("Camera unavailable or permission denied.");
    }
  }
  function stopCam() {
    cam?.getTracks().forEach((t) => t.stop());
    setCam(null);
  }

  return (
    <div>
      {cam ? (
        <div className="space-y-3">
          <video ref={video} autoPlay playsInline className="aspect-video w-full rounded-xl bg-muted object-cover" />
          <div className="flex gap-2">
            <Button onClick={async () => { if (video.current) await handle(video.current); stopCam(); }}>Capture</Button>
            <Button variant="outline" onClick={stopCam}>Cancel</Button>
          </div>
        </div>
      ) : value ? (
        <div className="relative">
          <img src={value.dataUrl} alt="Selected food" className="max-h-80 w-full rounded-xl object-contain bg-muted" />
          <button
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5"
            aria-label="Remove image"
          >
            <X className="size-4" />
          </button>
          {value.warnings.map((w) => (
            <p key={w} className="mt-2 text-xs text-warning">⚠ {w}</p>
          ))}
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-10 text-center"
        >
          <Upload className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Drop an image here, or</p>
          <div className="flex gap-2">
            <Button onClick={() => input.current?.click()}>Choose image</Button>
            <Button variant="outline" onClick={startCam}><Camera className="size-4" /> Camera</Button>
          </div>
          <p className="text-xs text-muted-foreground">JPG, PNG, WebP · up to 10 MB</p>
        </div>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}

export function FeatureList({ f }: { f: Features }) {
  const rows: [string, string][] = [
    ["Resolution", `${f.width}×${f.height}`],
    ["Brightness", `${f.brightness}/255`],
    ["Contrast", `${f.contrast}`],
    ["Saturation", `${Math.round(f.saturation * 100)}%`],
    ["Dominant hue", `${f.dominantHue}°`],
    ["Browning", `${(f.brownRatio * 100).toFixed(1)}%`],
    ["Dark spots", `${(f.darkSpotRatio * 100).toFixed(1)}%`],
    ["Sharpness", `${f.sharpness}`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-muted px-3 py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
