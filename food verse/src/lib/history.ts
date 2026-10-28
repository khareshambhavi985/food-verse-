// Analysis history kept only on this device (localStorage) to protect user data.
import { useEffect, useState } from "react";

export type HistoryEntry =
  | { id: string; at: number; kind: "food"; dish: string; calories: number; protein: number; carbs: number; fat: number }
  | { id: string; at: number; kind: "freshness"; item: string; status: string; confidence: number }
  | { id: string; at: number; kind: "hygiene"; score: number; risks: number }
  | { id: string; at: number; kind: "plan"; days: number; calories: number };

const KEY = "foodverse.history.v1";
const PROFILE_KEY = "foodverse.profile.v1";

type Dist<T> = T extends unknown ? Omit<T, "id" | "at"> : never;

export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function addHistory(e: Dist<HistoryEntry>) {
  const all = [{ ...e, id: crypto.randomUUID(), at: Date.now() } as HistoryEntry, ...readHistory()].slice(0, 200);
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("foodverse-history"));
}

export function clearHistory() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(PROFILE_KEY);
  window.dispatchEvent(new Event("foodverse-history"));
}

export function useHistory() {
  const [h, setH] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    const f = () => setH(readHistory());
    f();
    window.addEventListener("foodverse-history", f);
    return () => window.removeEventListener("foodverse-history", f);
  }, []);
  return h;
}

export function saveProfile(p: unknown) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}
export function loadProfile<T>(): T | null {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
  } catch {
    return null;
  }
}
