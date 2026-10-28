// Server-only Lovable AI Gateway helper (OpenAI Responses API, streamed SSE).
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Part =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

export async function callStructured<T>(opts: {
  system: string;
  text: string;
  images?: string[];
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(500, "AI is not configured on the server.");
  const content: Part[] = [{ type: "input_text", text: opts.text }];
  for (const img of opts.images ?? []) content.push({ type: "input_image", image_url: img });

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: opts.system,
      input: [{ role: "user", content }],
      reasoning: { effort: "low" },
      store: false,
      stream: true,
      text: {
        format: { type: "json_schema", name: opts.schemaName, strict: true, schema: opts.schema },
      },
    }),
  });

  if (!res.ok || !res.body) {
    let msg = `AI request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? j?.message ?? msg;
    } catch {}
    if (res.status === 402) msg = "AI credits exhausted. Add credits in Settings → Plans & credits.";
    if (res.status === 429) msg = "Too many requests right now — please try again in a moment.";
    throw new AiError(res.status, msg);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  let failed: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        if (ev.type === "response.failed" || ev.type === "error")
          failed = ev?.response?.error?.message ?? ev?.message ?? "AI request failed";
      } catch {}
    }
  }
  if (failed) throw new AiError(502, failed);
  if (!out.trim()) throw new AiError(502, "The AI returned no result. Try a different image.");
  return JSON.parse(out) as T;
}
