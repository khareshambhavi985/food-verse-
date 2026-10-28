"""FoodVerse AI - Python (FastAPI) backend.

Same 5 endpoints as the app's features. The JavaScript frontend forwards to
these when PYTHON_API_URL is set.
"""
import json
import os
from typing import Literal, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.openai.com/v1")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")  # cheap model = fewer credits
DISCLAIMER = "Visual analysis cannot guarantee food safety. When in doubt, throw it out."

app = FastAPI(title="FoodVerse AI API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------- schema helpers ----------
def obj(props: dict) -> dict:
    return {"type": "object", "additionalProperties": False, "properties": props, "required": list(props)}

S, N, B = {"type": "string"}, {"type": "number"}, {"type": "boolean"}
def arr(i): return {"type": "array", "items": i}
def enum(*v): return {"type": "string", "enum": list(v)}


async def call_ai(system: str, text: str, name: str, schema: dict, images: list[str] | None = None) -> dict:
    if not AI_API_KEY:
        raise HTTPException(500, "AI_API_KEY is not set in backend/.env")
    content = [{"type": "text", "text": text}] + [
        {"type": "image_url", "image_url": {"url": u, "detail": "low"}} for u in (images or [])
    ]
    body = {
        "model": AI_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": content}],
        "response_format": {"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": schema}},
    }
    async with httpx.AsyncClient(timeout=90) as c:
        r = await c.post(f"{AI_BASE_URL}/chat/completions", json=body,
                         headers={"Authorization": f"Bearer {AI_API_KEY}"})
    if r.status_code == 429:
        raise HTTPException(429, "Too many requests - try again shortly.")
    if r.status_code >= 400:
        raise HTTPException(502, f"AI request failed ({r.status_code}): {r.text[:300]}")
    return json.loads(r.json()["choices"][0]["message"]["content"])


# ---------- request models ----------
Img = Field(pattern=r"^data:image/(jpeg|png|webp);base64,", max_length=6_000_000)

class ImageReq(BaseModel):
    image: str = Img
    features: str = Field("", max_length=2000)

class HygieneReq(BaseModel):
    frames: list[str] = Field(min_length=1, max_length=6)

class Msg(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=4000)

class KitchenReq(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    history: list[Msg] = Field(default_factory=list, max_length=12)
    image: Optional[str] = None

class Profile(BaseModel):
    age: int = Field(ge=13, le=100)
    sex: Literal["male", "female"]
    height: float = Field(ge=120, le=230)
    weight: float = Field(ge=30, le=300)
    activity: Literal["sedentary", "light", "moderate", "active", "very_active"]
    goal: Literal["lose", "maintain", "gain"]
    diet: str = Field("", max_length=60)
    allergies: str = Field("", max_length=200)
    targetCalories: float = Field(ge=1000, le=5000)

class PlanReq(BaseModel):
    profile: Profile
    days: Literal[1, 7]


# ---------- endpoints ----------
@app.get("/health")
def health():
    return {"ok": True}


@app.post("/recognize")
async def recognize(d: ImageReq):
    return await call_ai(
        "You are a food recognition and nutrition expert. Identify every food item visible, estimate portion "
        "weight in grams, and estimate nutrition using standard USDA-style values. If no food, is_food=false, "
        "empty items and zero totals. confidence is 0-1.",
        f"Analyze this food image. Pre-computed image features: {d.features}", "food_recognition",
        obj({"is_food": B, "dish": S, "confidence": N, "portion": S,
             "items": arr(obj({"name": S, "grams": N, "calories": N, "protein": N, "carbs": N, "fat": N})),
             "totals": obj({"calories": N, "protein": N, "carbs": N, "fat": N, "fiber": N, "sugar": N, "sodium_mg": N}),
             "notes": S}),
        [d.image])


@app.post("/freshness")
async def freshness(d: ImageReq):
    r = await call_ai(
        "You assess food freshness from visual indicators only: color, discoloration, mold, bruising, wilting, "
        "sliminess, texture, dryness. Be conservative: visible mold => potentially_spoiled. If no food, is_food=false.",
        f"Classify freshness. Pre-computed color/texture features: {d.features}", "freshness",
        obj({"is_food": B, "item": S, "status": enum("fresh", "moderately_fresh", "potentially_spoiled"),
             "confidence": N,
             "indicators": arr(obj({"name": S, "observation": S, "severity": enum("none", "low", "medium", "high")})),
             "recommendations": arr(S), "estimated_shelf_life": S}),
        [d.image])
    return {**r, "disclaimer": DISCLAIMER}


@app.post("/hygiene")
async def hygiene(d: HygieneReq):
    return await call_ai(
        "You are a food safety inspector reviewing kitchen frames. Identify visible hygiene risks only (no gloves/"
        "hairnet, cross-contamination, dirty surfaces, pests, uncovered food, waste near prep, improper storage). "
        "score 0-100 (100 = excellent). frame is the 1-based frame index.",
        f"Inspect these {len(d.frames)} frames.", "hygiene",
        obj({"is_kitchen": B, "score": N, "summary": S,
             "risks": arr(obj({"issue": S, "severity": enum("low", "medium", "high"), "frame": N, "fix": S})),
             "good_practices": arr(S)}),
        d.frames)


@app.post("/kitchen")
async def kitchen(d: KitchenReq):
    hist = "\n".join(f"{h.role.upper()}: {h.text}" for h in d.history)
    text = (f"Conversation so far:\n{hist}\n\n" if hist else "") + f"USER: {d.question}"
    return await call_ai(
        "You are a concise smart kitchen assistant. Give practical cooking guidance, substitutions, timings and "
        "safe internal temperatures. steps may be empty when not a recipe/procedure.",
        text, "kitchen", obj({"answer": S, "steps": arr(S), "safety_tips": arr(S)}),
        [d.image] if d.image else [])


@app.post("/meal-plan")
async def meal_plan(d: PlanReq):
    p = d.profile
    meal = obj({"type": S, "name": S, "description": S, "calories": N, "protein": N, "carbs": N, "fat": N})
    return await call_ai(
        "You are a registered dietitian. Create realistic, varied meal plans. Strictly exclude allergens and respect "
        "the diet. Each day has breakfast, lunch, dinner and one snack, within ±5% of the calorie target.",
        f"Create a {d.days}-day plan. Profile: age {p.age}, {p.sex}, {p.height}cm, {p.weight}kg, activity "
        f"{p.activity}, goal {p.goal}. Diet: {p.diet or 'none'}. Allergies: {p.allergies or 'none'}. "
        f"Daily calorie target: {p.targetCalories} kcal.", "meal_plan",
        obj({"days": arr(obj({"day": S, "meals": arr(meal)})), "tips": arr(S)}))
