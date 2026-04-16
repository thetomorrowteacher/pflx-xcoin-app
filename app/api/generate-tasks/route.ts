import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const SYSTEM_PROMPT = `You are an AI task generator for the PFLX X-Coin platform — a gamified education and entrepreneurship system for students in grades 5-12.

PFLX TASK SYSTEM:
- Tasks are assignments with XC (X-Coin) rewards that players (students) complete and submit for host (teacher) review.
- Each task has: title, description, xcReward (number 50-500), category (a short label like "Design", "Research", "Production", "Writing", "Coding", "Marketing", "Business", "Audio", "Video"), and an optional pathwayTag (one of the 8 Core Pathways below).
- Tasks should be actionable, specific, and achievable by students ages 10-18.
- Tasks should encourage creativity, critical thinking, and skill development.

CORE PATHWAYS (8 skill tracks):
1. digital-artist — Digital art, illustration, design tools
2. music-producer — Music creation, audio engineering, beats
3. videographer — Video production, editing, storytelling
4. professional-entrepreneur — Business planning, pitching, startup skills
5. graphic-designer — Visual design, branding, layout
6. web-developer — Coding, websites, web applications
7. content-creator — Social media, writing, content strategy
8. industrial-designer — Product design, prototyping, manufacturing

YOUR JOB:
Analyze the provided content (could be course material, a syllabus, a lesson plan, a webpage, or freeform text) and generate 3-10 tasks that students could complete based on that content. Each task should be a meaningful learning activity.

RESPOND WITH ONLY a valid JSON array, no markdown fences, no explanation:
[{ "title": "...", "description": "...", "xcReward": 100, "category": "...", "pathwayTag": "" }]

The pathwayTag should be the slug of the most relevant Core Pathway, or "" if none applies clearly. Set xcReward proportional to effort: quick tasks 50-100, medium tasks 100-250, large tasks 250-500.`;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return res;
  }
  throw new Error("Retry exhausted");
}

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500, headers: CORS_HEADERS });
    }

    const body = await req.json();
    const { content, contentType, fileName } = body as {
      content: string;
      contentType: "text" | "link" | "file";
      fileName?: string;
    };

    if (!content) {
      return NextResponse.json({ error: "No content provided" }, { status: 400, headers: CORS_HEADERS });
    }

    let userMessage = "";
    if (contentType === "link") {
      userMessage = `Analyze this link/URL and generate tasks based on what you can infer from it:\n\nURL: ${content}`;
    } else if (contentType === "file") {
      userMessage = `Analyze this file content${fileName ? ` (from file: ${fileName})` : ""} and generate tasks:\n\n${content}`;
    } else {
      userMessage = `Analyze this content and generate tasks:\n\n${content}`;
    }

    const geminiBody = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    };

    const res = await fetchWithRetry(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[generate-tasks] API error:", res.status, errText);
      return NextResponse.json(
        { error: res.status === 429 ? "rate_limited" : "api_error", details: errText },
        { status: res.status, headers: CORS_HEADERS }
      );
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from the response (handle markdown fences if present)
    let tasks: any[] = [];
    try {
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      tasks = JSON.parse(cleaned);
      if (!Array.isArray(tasks)) {
        tasks = [tasks];
      }
    } catch {
      console.error("[generate-tasks] Failed to parse JSON:", rawText);
      return NextResponse.json(
        { error: "Failed to parse generated tasks. Please try again." },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // Validate and normalize
    tasks = tasks.map((t: any) => ({
      title: String(t.title || "Untitled Task"),
      description: String(t.description || ""),
      xcReward: Math.min(500, Math.max(50, Number(t.xcReward) || 100)),
      category: String(t.category || "General"),
      pathwayTag: String(t.pathwayTag || ""),
    }));

    return NextResponse.json({ tasks }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[generate-tasks] Route error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS });
  }
}
