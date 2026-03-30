import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const VALID_BRAND_TYPES = ["technical-builder", "creative-director", "experience-designer", "digital-innovator"] as const;
const VALID_PATHWAYS = ["content-creator", "3d-modeler", "sound-designer", "digital-artist", "computer-programmer", "game-designer"] as const;

const SYSTEM_PROMPT = `You are an AI assistant that analyzes images of previously completed PFLX Creative Identity Diagnostic assessments.

The PFLX Diagnostic measures 4 creative dimensions:
- Maker (hands-on builder) vs Visionary (big-picture thinker) — scored 0-6
- Storyteller (narrative/emotional focus) vs Technologist (technical/systems focus) — scored 0-6

It determines one of 4 Brand Types:
- "technical-builder" — Detail-oriented problem-solver, implementation-focused
- "creative-director" — Visionary strategic storyteller, leadership-oriented
- "experience-designer" — Hands-on creator, empathetic, user-focused, narrative-driven
- "digital-innovator" — Forward-thinking technical expert, system architect

It identifies Top 3 Pathways from:
- "content-creator" — Video production, editing, storytelling through media
- "3d-modeler" — 3D modeling, virtual worlds, VR experiences
- "sound-designer" — Music production, sound design, audio mixing
- "digital-artist" — Graphic design, illustration, visual storytelling
- "computer-programmer" — Coding, web development, building apps
- "game-designer" — Game design, mechanics, interactive experiences

It identifies a creative Style from: minimal, futuristic, retro, modern, classic, organic, industrial, playful

It may contain a Vision Statement with 4 parts:
- create: What the player wants to create
- impact: The impact they want to make
- perspective: Their unique perspective
- future: What they'll be known for in 2 years

Analyze the uploaded image and extract ALL diagnostic information you can find. Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "brandType": "one of the 4 brand types listed above",
  "scores": { "maker": <0-6>, "visionary": <0-6>, "storyteller": <0-6>, "technologist": <0-6> },
  "topPathways": ["pathway-1", "pathway-2", "pathway-3"],
  "style": "one of the styles listed above",
  "visionStatement": { "create": "...", "impact": "...", "perspective": "...", "future": "..." },
  "confidence": <0.0-1.0>,
  "extractedFields": ["list of fields you could clearly read from the image"]
}

RULES:
- Only use the exact string values listed above for brandType, pathways, and style.
- If you can't determine a field, use reasonable defaults based on what you CAN see.
- For scores, if not visible, infer from the brandType: technical-builder → maker>visionary, technologist>storyteller; creative-director → visionary>maker, storyteller>technologist; etc.
- Set confidence to how certain you are overall (1.0 = perfect match, 0.5 = some guessing).
- extractedFields should list which fields were clearly readable vs inferred.
- If the image is NOT a diagnostic result at all, return: { "error": "not_diagnostic", "message": "This doesn't appear to be a PFLX diagnostic result." }`;

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { image, mimeType } = body as { image: string; mimeType: string };

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Strip data URL prefix if present
    const base64Data = image.includes(",") ? image.split(",")[1] : image;
    const imgMime = mimeType || "image/jpeg";

    const geminiBody = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: imgMime, data: base64Data } },
            { text: "Analyze this diagnostic result image and extract all PFLX Creative Identity Assessment data. Return only valid JSON." },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 1200,
      },
    };

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[analyze-diagnostic] Gemini error:", res.status, errText);
      return NextResponse.json(
        { error: "ai_error", details: errText },
        { status: res.status }
      );
    }

    const data = await res.json();
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response (handle potential markdown fences)
    let parsed: Record<string, unknown>;
    try {
      const jsonStr = rawText.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[analyze-diagnostic] Failed to parse AI response:", rawText);
      return NextResponse.json(
        { error: "parse_error", rawText },
        { status: 422 }
      );
    }

    // Check for explicit error from AI
    if (parsed.error === "not_diagnostic") {
      return NextResponse.json(parsed, { status: 422 });
    }

    // Validate and sanitize the result
    const result = sanitizeResult(parsed);

    return NextResponse.json({ result });
  } catch (err) {
    console.error("[analyze-diagnostic] Route error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function sanitizeResult(raw: Record<string, unknown>) {
  const brandType = VALID_BRAND_TYPES.includes(raw.brandType as any)
    ? (raw.brandType as string)
    : "experience-designer";

  const rawScores = (raw.scores || {}) as Record<string, number>;
  const scores = {
    maker: clamp(rawScores.maker ?? 3, 0, 6),
    visionary: clamp(rawScores.visionary ?? 3, 0, 6),
    storyteller: clamp(rawScores.storyteller ?? 3, 0, 6),
    technologist: clamp(rawScores.technologist ?? 3, 0, 6),
  };

  const rawPathways = (raw.topPathways || []) as string[];
  const topPathways = rawPathways
    .filter((p) => VALID_PATHWAYS.includes(p as any))
    .slice(0, 3);
  // Pad to 3 if needed
  const defaultPathways = ["content-creator", "digital-artist", "game-designer"];
  while (topPathways.length < 3) {
    const next = defaultPathways.find((d) => !topPathways.includes(d));
    if (next) topPathways.push(next);
    else break;
  }

  const validStyles = ["minimal", "futuristic", "retro", "modern", "classic", "organic", "industrial", "playful"];
  const style = validStyles.includes(raw.style as string) ? (raw.style as string) : "modern";

  const rawVision = (raw.visionStatement || {}) as Record<string, string>;
  const visionStatement = {
    create: rawVision.create || "",
    impact: rawVision.impact || "",
    perspective: rawVision.perspective || "",
    future: rawVision.future || "",
  };

  return {
    brandType,
    scores,
    topPathways,
    style,
    visionStatement,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
    extractedFields: Array.isArray(raw.extractedFields) ? raw.extractedFields : [],
  };
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(val)));
}
