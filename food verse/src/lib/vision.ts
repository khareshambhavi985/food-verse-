// Client-side image preprocessing & feature extraction (canvas-based).
export const MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type Features = {
  width: number;
  height: number;
  brightness: number; // 0-255
  contrast: number; // std dev of luma
  saturation: number; // 0-1
  dominantHue: number; // degrees
  brownRatio: number; // share of brown/dark-yellow pixels (browning)
  darkSpotRatio: number; // share of very dark pixels
  greenRatio: number;
  sharpness: number; // laplacian variance
};

export function validateImageFile(f: File): string | null {
  if (!OK_TYPES.includes(f.type)) return "Please upload a JPG, PNG or WebP image.";
  if (f.size > MAX_BYTES) return "Image must be under 10 MB.";
  if (f.size < 1000) return "That file looks empty or corrupted.";
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not read this image — it may be corrupted."));
    i.src = src;
  });
}

export async function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Could not read file"));
    r.readAsDataURL(f);
  });
}

/** Resize to max side, return JPEG data URL + extracted features. */
export async function preprocess(src: string | CanvasImageSource, maxSide = 1024) {
  const el = typeof src === "string" ? await loadImage(src) : src;
  const w0 = (el as HTMLImageElement).naturalWidth || (el as HTMLVideoElement).videoWidth || (el as HTMLCanvasElement).width;
  const h0 = (el as HTMLImageElement).naturalHeight || (el as HTMLVideoElement).videoHeight || (el as HTMLCanvasElement).height;
  if (!w0 || !h0) throw new Error("Invalid image dimensions.");
  if (w0 < 64 || h0 < 64) throw new Error("Image is too small to analyze (min 64px).");
  const s = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.round(w0 * s);
  const h = Math.round(h0 * s);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(el, 0, 0, w, h);
  const dataUrl = c.toDataURL("image/jpeg", 0.85);
  const features = extractFeatures(ctx.getImageData(0, 0, w, h));
  return { dataUrl, features };
}

export function extractFeatures(img: ImageData): Features {
  const { data, width, height } = img;
  const n = width * height;
  const luma = new Float32Array(n);
  let sumL = 0, sumS = 0, brown = 0, dark = 0, green = 0;
  const hueBins = new Array(36).fill(0);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i]! / 255, g = data[i + 1]! / 255, b = data[i + 2]! / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[p] = L * 255;
    sumL += L * 255;
    const sat = mx === 0 ? 0 : d / mx;
    sumS += sat;
    let hue = 0;
    if (d > 0) {
      if (mx === r) hue = 60 * (((g - b) / d) % 6);
      else if (mx === g) hue = 60 * ((b - r) / d + 2);
      else hue = 60 * ((r - g) / d + 4);
      if (hue < 0) hue += 360;
    }
    if (sat > 0.15) hueBins[Math.floor(hue / 10) % 36]!++;
    if (hue >= 15 && hue <= 45 && sat > 0.3 && mx < 0.6) brown++;
    if (mx < 0.15) dark++;
    if (hue >= 75 && hue <= 160 && sat > 0.25) green++;
  }
  const mean = sumL / n;
  let v = 0;
  for (let p = 0; p < n; p++) v += (luma[p]! - mean) ** 2;
  // Laplacian variance (sharpness / blur check)
  let lapSum = 0, lapSq = 0, cnt = 0;
  for (let y = 1; y < height - 1; y += 2)
    for (let x = 1; x < width - 1; x += 2) {
      const p = y * width + x;
      const l = 4 * luma[p]! - luma[p - 1]! - luma[p + 1]! - luma[p - width]! - luma[p + width]!;
      lapSum += l; lapSq += l * l; cnt++;
    }
  const lapMean = lapSum / cnt;
  const r2 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    width, height,
    brightness: Math.round(mean),
    contrast: Math.round(Math.sqrt(v / n)),
    saturation: r2(sumS / n),
    dominantHue: hueBins.indexOf(Math.max(...hueBins)) * 10 + 5,
    brownRatio: r2(brown / n),
    darkSpotRatio: r2(dark / n),
    greenRatio: r2(green / n),
    sharpness: Math.round(lapSq / cnt - lapMean * lapMean),
  };
}

export function qualityWarnings(f: Features): string[] {
  const w: string[] = [];
  if (f.brightness < 40) w.push("Image is very dark — results may be less accurate.");
  if (f.brightness > 235) w.push("Image is overexposed.");
  if (f.sharpness < 30) w.push("Image looks blurry.");
  return w;
}

/** Sample N evenly spaced frames from a video file. */
export async function sampleVideoFrames(file: File, count = 5): Promise<string[]> {
  if (!file.type.startsWith("video/")) throw new Error("Please upload a video file.");
  if (file.size > 100 * 1024 * 1024) throw new Error("Video must be under 100 MB.");
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.src = url;
  await new Promise<void>((res, rej) => {
    v.onloadedmetadata = () => res();
    v.onerror = () => rej(new Error("Could not read this video format."));
  });
  const dur = v.duration;
  if (!isFinite(dur) || dur <= 0) throw new Error("Video has no readable duration.");
  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    v.currentTime = (dur * (i + 0.5)) / count;
    await new Promise<void>((res) => (v.onseeked = () => res()));
    frames.push((await preprocess(v, 768)).dataUrl);
  }
  URL.revokeObjectURL(url);
  return frames;
}
