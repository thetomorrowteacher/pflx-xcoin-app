"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User, DiagnosticResult, StartupStudio,
  mockUsers, mockStartupStudios,
  assignStudioFromDiagnostic, assignStudioFromVisionText, getCurrentRank,
} from "../lib/data";

// ─── Question data ────────────────────────────────────────────────────────────
const questions = [
  { id: "q1", dimension: "lifestyle", text: "When I get home from school, I usually:", options: [
    { text: "Play video games or browse online", value: "digital", hobbies: ["game-designer", "computer-programmer", "content-creator"] },
    { text: "Listen to music, make playlists, or play an instrument", value: "audio", hobbies: ["sound-designer", "content-creator"] },
    { text: "Draw, doodle, or work on art projects", value: "visual", hobbies: ["digital-artist", "3d-modeler"] },
    { text: "Read, write stories, or watch movies/shows", value: "narrative", hobbies: ["content-creator", "game-designer"] },
  ]},
  { id: "q2", dimension: "lifestyle", text: "In my free time, I enjoy:", options: [
    { text: "Creating things (building, coding, making videos, art)", value: "creator", hobbies: ["3d-modeler", "computer-programmer", "content-creator"] },
    { text: "Playing sports, working out, or being active", value: "kinesthetic", hobbies: ["content-creator", "game-designer"] },
    { text: "Hanging out with friends and organizing activities", value: "social", hobbies: ["content-creator", "digital-artist"] },
    { text: "Exploring new ideas through research or experimentation", value: "explorer", hobbies: ["computer-programmer", "game-designer", "3d-modeler"] },
  ]},
  { id: "q3", dimension: "lifestyle", text: "When I use social media, I mostly:", options: [
    { text: "Post my own content and build a following", value: "creator", hobbies: ["content-creator", "digital-artist"] },
    { text: "Share memes, music, and things I find interesting", value: "curator", hobbies: ["digital-artist", "sound-designer"] },
    { text: "Connect with friends and communities", value: "connector", hobbies: ["content-creator", "game-designer"] },
    { text: "Learn new skills and find inspiration", value: "learner", hobbies: ["computer-programmer", "game-designer"] },
  ]},
  { id: "q4", dimension: "lifestyle", text: "The apps/tools I use most are:", options: [
    { text: "Creative apps (photo/video editors, design tools, music apps)", value: "creative-tools", hobbies: ["digital-artist", "content-creator", "sound-designer"] },
    { text: "Gaming platforms, Discord, streaming services", value: "entertainment", hobbies: ["game-designer", "content-creator"] },
    { text: "Productivity tools, organization apps, planners", value: "productivity", hobbies: ["computer-programmer", "3d-modeler"] },
    { text: "Social platforms, messaging, connection apps", value: "social-tools", hobbies: ["content-creator", "digital-artist"] },
  ]},
  { id: "q5", dimension: "lifestyle", text: "When I watch YouTube or TikTok, I'm drawn to:", options: [
    { text: "Tutorials and how-to videos", value: "learner", hobbies: ["computer-programmer", "3d-modeler", "digital-artist"] },
    { text: "Entertainment and storytelling content", value: "entertainment", hobbies: ["content-creator", "game-designer"] },
    { text: "Vlogs, lifestyle, and personality-driven content", value: "personality", hobbies: ["content-creator", "digital-artist"] },
    { text: "Tech reviews, gaming, and digital culture", value: "tech", hobbies: ["game-designer", "computer-programmer"] },
  ]},
  { id: "q6", dimension: "maker-visionary", text: "When starting a new project, I prefer to:", options: [
    { text: "Jump in and start building immediately", value: "maker", weight: 2 },
    { text: "Build a quick prototype to test ideas", value: "maker", weight: 1 },
    { text: "Sketch concepts and plan the approach", value: "visionary", weight: 1 },
    { text: "Explore possibilities and research extensively", value: "visionary", weight: 2 },
  ]},
  { id: "q7", dimension: "maker-visionary", text: "I feel most energized when:", options: [
    { text: "Creating something tangible I can see progress on", value: "maker", weight: 2 },
    { text: "Iterating and refining a working prototype", value: "maker", weight: 1 },
    { text: "Designing the vision and overall strategy", value: "visionary", weight: 1 },
    { text: "Imagining future possibilities and innovations", value: "visionary", weight: 2 },
  ]},
  { id: "q8", dimension: "maker-visionary", text: "When collaborating, I naturally gravitate toward:", options: [
    { text: "Being the hands-on builder executing ideas", value: "maker", weight: 2 },
    { text: "Contributing practical implementation skills", value: "maker", weight: 1 },
    { text: "Guiding the creative direction", value: "visionary", weight: 1 },
    { text: "Leading ideation and concept development", value: "visionary", weight: 2 },
  ]},
  { id: "q9", dimension: "storyteller-technologist", text: "I'm most drawn to projects that:", options: [
    { text: "Tell powerful stories and move people emotionally", value: "storyteller", weight: 2 },
    { text: "Create engaging experiences with narrative", value: "storyteller", weight: 1 },
    { text: "Showcase technical innovation and clever solutions", value: "technologist", weight: 1 },
    { text: "Push the boundaries of what's technically possible", value: "technologist", weight: 2 },
  ]},
  { id: "q10", dimension: "storyteller-technologist", text: "Success for me means:", options: [
    { text: "Creating emotional impact and human connection", value: "storyteller", weight: 2 },
    { text: "Crafting compelling narratives that resonate", value: "storyteller", weight: 1 },
    { text: "Building systems that work flawlessly", value: "technologist", weight: 1 },
    { text: "Solving complex technical challenges elegantly", value: "technologist", weight: 2 },
  ]},
  { id: "q11", dimension: "storyteller-technologist", text: "When learning something new, I prefer:", options: [
    { text: "Understanding the human stories and contexts", value: "storyteller", weight: 2 },
    { text: "Exploring creative applications and expressions", value: "storyteller", weight: 1 },
    { text: "Mastering the technical mechanics and systems", value: "technologist", weight: 1 },
    { text: "Diving deep into how things work under the hood", value: "technologist", weight: 2 },
  ]},
  { id: "q12", dimension: "pathway-interest", text: "Rate your interest: Video production, editing, storytelling through media", pathway: "content-creator", type: "scale" },
  { id: "q13", dimension: "pathway-interest", text: "Rate your interest: 3D modeling, virtual worlds, VR experiences", pathway: "3d-modeler", type: "scale" },
  { id: "q14", dimension: "pathway-interest", text: "Rate your interest: Music production, sound design, audio mixing", pathway: "sound-designer", type: "scale" },
  { id: "q15", dimension: "pathway-interest", text: "Rate your interest: Graphic design, illustration, visual storytelling", pathway: "digital-artist", type: "scale" },
  { id: "q16", dimension: "pathway-interest", text: "Rate your interest: Coding, web development, building apps", pathway: "computer-programmer", type: "scale" },
  { id: "q17", dimension: "pathway-interest", text: "Rate your interest: Game design, mechanics, interactive experiences", pathway: "game-designer", type: "scale" },
  { id: "q18", dimension: "style-colors", text: "When choosing colors for a project, I prefer:", options: [
    { text: "Bold, bright colors that stand out", value: "bold", styles: { playful: 2, futuristic: 1, retro: 1 } },
    { text: "Black, white, and neutral tones", value: "neutral", styles: { minimal: 2, classic: 1, modern: 1 } },
    { text: "Warm, earthy, natural colors", value: "warm", styles: { organic: 2, retro: 1, classic: 1 } },
    { text: "Sleek metallics and cool tones", value: "cool", styles: { futuristic: 2, modern: 1, industrial: 1 } },
  ]},
  { id: "q19", dimension: "style-complexity", text: "I prefer designs that are:", options: [
    { text: "Simple and clean with lots of empty space", value: "simple", styles: { minimal: 2, modern: 1 } },
    { text: "Detailed with lots of interesting elements", value: "detailed", styles: { playful: 2, retro: 1, classic: 1 } },
    { text: "Raw and unfinished with visible textures", value: "textured", styles: { industrial: 2, organic: 1 } },
    { text: "Polished and perfectly refined", value: "polished", styles: { modern: 2, futuristic: 1, classic: 1 } },
  ]},
  { id: "q20", dimension: "style-inspiration", text: "I get inspired by:", options: [
    { text: "Sci-fi movies, robots, and space technology", value: "tech", styles: { futuristic: 2, modern: 1 } },
    { text: "Old movies, vintage posters, and classic games", value: "vintage", styles: { retro: 2, classic: 1 } },
    { text: "Nature, plants, and the outdoors", value: "nature", styles: { organic: 2, minimal: 1 } },
    { text: "Cities, buildings, and urban environments", value: "urban", styles: { industrial: 2, modern: 1 } },
  ]},
  { id: "q21", dimension: "style-vibe", text: "When working on creative projects, I want them to feel:", options: [
    { text: "Fun, energetic, and full of personality", value: "fun", styles: { playful: 2, retro: 1 } },
    { text: "Calm, organized, and focused", value: "calm", styles: { minimal: 2, classic: 1 } },
    { text: "Cutting-edge and innovative", value: "innovative", styles: { futuristic: 2, modern: 1 } },
    { text: "Authentic and down-to-earth", value: "authentic", styles: { organic: 2, industrial: 1 } },
  ]},
  { id: "q22", dimension: "style-reference", text: "Which of these sounds most appealing to you?", options: [
    { text: "A perfectly organized workspace with everything in its place", value: "organized", styles: { minimal: 2, classic: 1, modern: 1 } },
    { text: "A colorful room full of art supplies and creative chaos", value: "creative", styles: { playful: 2, organic: 1 } },
    { text: "A high-tech lab with screens and futuristic gadgets", value: "hightech", styles: { futuristic: 2, modern: 1 } },
    { text: "A cozy attic filled with old treasures and memories", value: "nostalgic", styles: { retro: 2, classic: 1 } },
    { text: "A converted warehouse with exposed brick and metal", value: "warehouse", styles: { industrial: 2, modern: 1 } },
    { text: "A garden studio surrounded by plants and natural light", value: "garden", styles: { organic: 2, minimal: 1 } },
  ]},
];

const visionOptions = {
  create: [
    "stories and worlds that celebrate diverse voices and cultures",
    "immersive experiences that blend technology and imagination",
    "tools and solutions that solve real-world problems",
    "futuristic innovations that explore what's possible tomorrow",
    "content that inspires positive change in my community",
    "games and interactive experiences that bring people together",
  ],
  impact: [
    "amplify underrepresented voices and build equity",
    "inspire people to see the world differently",
    "make complex technology accessible to everyone",
    "push the boundaries of what's possible with AI and XR",
    "create joy and wonder through storytelling",
    "address real problems that matter to my community",
  ],
  perspective: [
    "honoring my heritage while shaping the future",
    "finding beauty in the intersection of art and narrative",
    "breaking down complex systems into simple solutions",
    "asking 'what if?' and building the answer",
    "connecting people through shared human experiences",
    "transforming ideas into tangible realities",
  ],
  future: [
    "championing diversity and social impact through my work",
    "crafting unforgettable characters and stories",
    "building innovative tech that changes how people live",
    "pioneering new forms of digital and immersive media",
    "leading projects that create measurable positive impact",
    "designing experiences that matter",
  ],
};

const brandTypes: Record<string, { name: string; description: string; traits: string[] }> = {
  "technical-builder": { name: "Technical Builder", description: "You excel at turning ideas into working systems through hands-on technical execution.", traits: ["Detail-oriented", "Problem-solver", "Systems thinker", "Implementation-focused"] },
  "creative-director": { name: "Creative Director", description: "You thrive on big-picture thinking and guiding creative vision through compelling narratives.", traits: ["Visionary", "Strategic", "Story-driven", "Leadership-oriented"] },
  "experience-designer": { name: "Experience Designer", description: "You bring ideas to life through hands-on creation of emotionally engaging experiences.", traits: ["Hands-on creator", "Empathetic", "User-focused", "Narrative-driven"] },
  "digital-innovator": { name: "Digital Innovator", description: "You push boundaries by envisioning and architecting cutting-edge technical solutions.", traits: ["Forward-thinking", "Technical expert", "Innovation-focused", "System architect"] },
};

const pathwayLabels: Record<string, { name: string; icon: string }> = {
  "content-creator": { name: "Content Creator", icon: "\uD83C\uDFAC" },
  "3d-modeler": { name: "3D Modeler", icon: "\uD83C\uDFAE" },
  "sound-designer": { name: "Sound Designer", icon: "\uD83C\uDFB5" },
  "digital-artist": { name: "Digital Artist", icon: "\uD83C\uDFA8" },
  "computer-programmer": { name: "Computer Programmer", icon: "\uD83D\uDCBB" },
  "game-designer": { name: "Game Designer", icon: "\uD83C\uDFAF" },
};

// ─── Calculate diagnostic results ────────────────────────────────
function calculateResults(answers: Record<string, any>): Omit<DiagnosticResult, "completedAt"> {
  const scores = { maker: 0, visionary: 0, storyteller: 0, technologist: 0 };
  const pathwayScores: Record<string, number> = { "content-creator": 0, "3d-modeler": 0, "sound-designer": 0, "digital-artist": 0, "computer-programmer": 0, "game-designer": 0 };
  const styleScores: Record<string, number> = { minimal: 0, futuristic: 0, retro: 0, modern: 0, classic: 0, organic: 0, industrial: 0, playful: 0 };

  Object.entries(answers).forEach(([qId, answer]) => {
    const question = questions.find(q => q.id === qId);
    if (!question) return;
    if (question.dimension?.startsWith("style-")) {
      if (answer.styles) Object.entries(answer.styles).forEach(([style, pts]) => { styleScores[style] = (styleScores[style] || 0) + (pts as number); });
    } else if ((question as any).type === "scale") {
      pathwayScores[(question as any).pathway] = answer;
    } else if (question.dimension === "lifestyle" && answer.hobbies) {
      answer.hobbies.forEach((h: string) => { pathwayScores[h] = (pathwayScores[h] || 0) + 1; });
    } else if (question.dimension === "maker-visionary" || question.dimension === "storyteller-technologist") {
      (scores as any)[answer.value] += answer.weight;
    }
  });

  const topStyle = Object.entries(styleScores).sort(([, a], [, b]) => b - a)[0][0];
  const isMaker = scores.maker > scores.visionary;
  const isStoryteller = scores.storyteller > scores.technologist;
  const brandType = (isMaker && !isStoryteller) ? "technical-builder" : (!isMaker && isStoryteller) ? "creative-director" : (isMaker && isStoryteller) ? "experience-designer" : "digital-innovator";
  const topPathways = Object.entries(pathwayScores).sort(([, a], [, b]) => b - a).slice(0, 3).map(([p]) => p);

  return { brandType: brandType as DiagnosticResult["brandType"], scores, topPathways, style: topStyle };
}

// ─── Component ───────────────────────────────────────────────────
type OnboardingStep = "intro" | "assessment" | "results" | "vision" | "branding" | "placement" | "welcome";

export default function DiagnosticPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<OnboardingStep>("intro");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [results, setResults] = useState<Omit<DiagnosticResult, "completedAt"> | null>(null);
  const [vision, setVision] = useState({ create: "", impact: "", perspective: "", future: "" });
  const [assignedStudio, setAssignedStudio] = useState<StartupStudio | null>(null);
  const [placing, setPlacing] = useState(false);

  // Branding state
  const [brandName, setBrandName] = useState("");
  const [slogan, setSlogan] = useState("");

  // Skip/manual entry state
  const [isSkipMode, setIsSkipMode] = useState(false);
  const [manualBrandType, setManualBrandType] = useState("");
  const [manualPathways, setManualPathways] = useState<string[]>([]);
  const [manualVisionText, setManualVisionText] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.onboardingComplete) { router.push(u.role === "admin" ? "/admin" : "/player"); return; }
    // If diagnostic is done but branding isn't, go to branding
    if (u.diagnosticComplete && !u.brandingComplete) {
      setUser(u);
      setStep("branding");
      if (u.diagnosticResult) setResults(u.diagnosticResult);
      return;
    }
    // If both done, they're fully onboarded
    if (u.diagnosticComplete && u.brandingComplete) {
      const updated = { ...u, onboardingComplete: true };
      localStorage.setItem("pflx_user", JSON.stringify(updated));
      const idx = mockUsers.findIndex(mu => mu.id === u.id);
      if (idx >= 0) mockUsers[idx].onboardingComplete = true;
      router.push("/player");
      return;
    }
    setUser(u);
    setBrandName(u.brandName || "");
  }, [router]);

  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / questions.length) * 100;

  const handleCalculate = () => {
    if (!user) return;
    const res = calculateResults(answers);
    setResults(res);
    setStep("results");
  };

  // Complete vision step → do placement (AI assigns studio)
  const handleVisionComplete = () => {
    setStep("placement");
    setPlacing(true);
    setTimeout(() => {
      if (!results) return;
      const fullResult: DiagnosticResult = {
        ...results,
        visionStatement: vision,
        completedAt: new Date().toISOString(),
      };
      const studioId = assignStudioFromDiagnostic(fullResult);
      const studio = mockStartupStudios.find(s => s.id === studioId)!;
      setAssignedStudio(studio);

      if (user) {
        const updatedUser: User = {
          ...user,
          studioId,
          diagnosticComplete: true,
          pathway: pathwayLabels[results.topPathways[0]]?.name || user.pathway,
          diagnosticResult: fullResult,
        };
        localStorage.setItem("pflx_user", JSON.stringify(updatedUser));
        const idx = mockUsers.findIndex(u => u.id === user.id);
        if (idx >= 0) {
          mockUsers[idx] = updatedUser;
          const sIdx = mockStartupStudios.findIndex(s => s.id === studioId);
          if (sIdx >= 0 && !mockStartupStudios[sIdx].members.includes(user.id)) {
            mockStartupStudios[sIdx].members.push(user.id);
          }
        }
        setUser(updatedUser);
      }
      setPlacing(false);
      // Go to branding step (not welcome yet)
      setTimeout(() => setStep("branding"), 600);
    }, 2800);
  };

  // Skip mode: manual entry → AI analyzes vision text → assigns studio
  const handleSkipComplete = () => {
    if (!user) return;
    setStep("placement");
    setPlacing(true);
    setTimeout(() => {
      // Build a result from manual entries
      const brandType = (manualBrandType || "experience-designer") as DiagnosticResult["brandType"];
      const topPathways = manualPathways.length > 0 ? manualPathways.slice(0, 3) : ["content-creator", "digital-artist", "game-designer"];
      const visionStatement = { create: manualVisionText, impact: "", perspective: "", future: "" };

      const fullResult: DiagnosticResult = {
        brandType,
        scores: { maker: 3, visionary: 3, storyteller: 3, technologist: 3 },
        topPathways,
        style: "modern",
        visionStatement,
        completedAt: new Date().toISOString(),
      };

      // Use AI vision text analysis for studio assignment
      const studioId = assignStudioFromVisionText(manualVisionText || "creative experiences");
      const studio = mockStartupStudios.find(s => s.id === studioId)!;
      setAssignedStudio(studio);
      setResults(fullResult);

      const updatedUser: User = {
        ...user,
        studioId,
        diagnosticComplete: true,
        pathway: pathwayLabels[topPathways[0]]?.name || user.pathway,
        diagnosticResult: fullResult,
      };
      localStorage.setItem("pflx_user", JSON.stringify(updatedUser));
      const idx = mockUsers.findIndex(u => u.id === user.id);
      if (idx >= 0) {
        mockUsers[idx] = updatedUser;
        const sIdx = mockStartupStudios.findIndex(s => s.id === studioId);
        if (sIdx >= 0 && !mockStartupStudios[sIdx].members.includes(user.id)) {
          mockStartupStudios[sIdx].members.push(user.id);
        }
      }
      setUser(updatedUser);
      setPlacing(false);
      setTimeout(() => setStep("branding"), 600);
    }, 2800);
  };

  // Complete branding → mark onboarding complete → welcome
  const handleBrandingComplete = () => {
    if (!user) return;
    const updatedUser: User = {
      ...user,
      brandName: brandName || user.brandName,
      brandingComplete: true,
      onboardingComplete: true,
    };
    localStorage.setItem("pflx_user", JSON.stringify(updatedUser));
    const idx = mockUsers.findIndex(u => u.id === user.id);
    if (idx >= 0) mockUsers[idx] = updatedUser;
    setUser(updatedUser);
    setStep("welcome");
  };

  if (!user) return null;

  const CYAN = "#00d4ff";
  const studio = assignedStudio || mockStartupStudios.find(s => s.id === user.studioId);

  return (
    <div style={{ minHeight: "100vh", background: "#060810", color: "#f0f0ff", fontFamily: "'Inter','Segoe UI',sans-serif", overflowX: "hidden" }}>
      {/* Background grid */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(rgba(0,212,255,0.04) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "40px 24px 80px", position: "relative" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <p style={{ margin: "0 0 8px", fontSize: "12px", letterSpacing: "0.2em", color: "rgba(0,212,255,0.6)", fontWeight: 700 }}>PROTOTYPE FLX</p>
          <h1 style={{ margin: "0 0 6px", fontSize: "clamp(28px,5vw,44px)", fontWeight: 900, letterSpacing: "0.06em", background: "linear-gradient(90deg,#00d4ff,#a78bfa,#00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 16px rgba(0,212,255,0.4))" }}>
            PLAYER ONBOARDING
          </h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.12em" }}>[ CREATIVE IDENTITY ASSESSMENT ]</p>
        </div>

        {/* ── INTRO ── */}
        {step === "intro" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "24px", padding: "40px", position: "relative" }}>
              <div style={{ position: "absolute", top: "10px", left: "10px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.35)", borderRight: "none", borderBottom: "none", borderRadius: "2px" }} />
              <div style={{ position: "absolute", top: "10px", right: "10px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.35)", borderLeft: "none", borderBottom: "none", borderRadius: "2px" }} />
              <div style={{ position: "absolute", bottom: "10px", left: "10px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.35)", borderRight: "none", borderTop: "none", borderRadius: "2px" }} />
              <div style={{ position: "absolute", bottom: "10px", right: "10px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.35)", borderLeft: "none", borderTop: "none", borderRadius: "2px" }} />

              <h2 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: 800, color: CYAN }}>Welcome, {user.brandName || user.name}.</h2>
              <p style={{ margin: "0 0 28px", fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                Before you enter the PFLX ecosystem, you need to discover your <strong style={{ color: "#f0f0ff" }}>Creative Identity</strong>, build your <strong style={{ color: "#f0f0ff" }}>Personal Brand</strong>, and find your <strong style={{ color: "#f0f0ff" }}>Startup Studio</strong>.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
                {[
                  { icon: "\u2728", label: "Creative Identity Assessment", sub: "22 questions about your interests and creative style", color: CYAN },
                  { icon: "\uD83C\uDFAF", label: "Vision Statement Builder", sub: "Craft your personal creative mission", color: "#a78bfa" },
                  { icon: "\uD83C\uDFA8", label: "Personal Branding", sub: "Brand name, slogan, and creative identity", color: "#f472b6" },
                  { icon: "\uD83C\uDFE2", label: "Startup Studio Placement", sub: "AI assigns you to your studio based on your profile", color: "#f5c842" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "16px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "16px 20px" }}>
                    <span style={{ fontSize: "22px" }}>{item.icon}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: item.color }}>{item.label}</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep("assessment")}
                style={{ width: "100%", padding: "18px", borderRadius: "14px", border: "none", cursor: "pointer", background: "linear-gradient(90deg,#00d4ff,#a78bfa)", color: "#000", fontSize: "15px", fontWeight: 900, letterSpacing: "0.06em", marginBottom: "12px" }}
              >
                BEGIN FULL ASSESSMENT &rarr;
              </button>
            </div>

            {/* Skip option */}
            <button
              onClick={() => { setIsSkipMode(true); setStep("assessment"); }}
              style={{ padding: "14px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.4)", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
            >
              Already completed the assessment? Skip &amp; enter manually &rarr;
            </button>
          </div>
        )}

        {/* ── ASSESSMENT (full or skip/manual) ── */}
        {step === "assessment" && !isSkipMode && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Progress bar */}
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "100px", height: "6px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#00d4ff,#a78bfa)", borderRadius: "100px", transition: "width 0.3s ease" }} />
            </div>
            <p style={{ margin: 0, textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>{answeredCount} / {questions.length} ANSWERED</p>

            {questions.map((q) => (
              <div key={q.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "24px" }}>
                <p style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 700, color: CYAN }}>{q.text}</p>
                {(q as any).type === "scale" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>Low</span>
                    {[1, 2, 3, 4, 5].map(num => (
                      <button key={num} onClick={() => setAnswers({ ...answers, [q.id]: num })}
                        style={{ flex: 1, height: "48px", borderRadius: "10px", border: `2px solid ${answers[q.id] === num ? CYAN : "rgba(255,255,255,0.1)"}`, background: answers[q.id] === num ? "rgba(0,212,255,0.12)" : "transparent", color: answers[q.id] === num ? CYAN : "rgba(255,255,255,0.3)", fontWeight: 800, fontSize: "16px", cursor: "pointer", transition: "all 0.15s" }}>
                        {num}
                      </button>
                    ))}
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>High</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(q as any).options.map((opt: any, i: number) => (
                      <button key={i} onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                        style={{ padding: "14px 16px", borderRadius: "12px", border: `2px solid ${answers[q.id]?.text === opt.text ? CYAN : "rgba(255,255,255,0.08)"}`, background: answers[q.id]?.text === opt.text ? "rgba(0,212,255,0.08)" : "transparent", color: answers[q.id]?.text === opt.text ? CYAN : "rgba(255,255,255,0.55)", fontSize: "13px", fontWeight: 500, textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}>
                        {opt.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={handleCalculate}
              disabled={answeredCount < questions.length}
              style={{ padding: "18px", borderRadius: "14px", border: "none", cursor: answeredCount < questions.length ? "not-allowed" : "pointer", background: answeredCount < questions.length ? "rgba(255,255,255,0.06)" : "linear-gradient(90deg,#00d4ff,#a78bfa)", color: answeredCount < questions.length ? "rgba(255,255,255,0.25)" : "#000", fontSize: "15px", fontWeight: 900, letterSpacing: "0.06em", transition: "all 0.2s" }}>
              {answeredCount < questions.length ? `${answeredCount}/${questions.length} Questions Answered` : "SEE MY RESULTS \u2192"}
            </button>
          </div>
        )}

        {/* ── SKIP / MANUAL ENTRY ── */}
        {step === "assessment" && isSkipMode && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "rgba(245,200,66,0.05)", border: "1px solid rgba(245,200,66,0.2)", borderRadius: "18px", padding: "24px" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: "#f5c842" }}>Manual Entry Mode</h2>
              <p style={{ margin: "0 0 24px", fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
                If you&apos;ve already completed the assessment externally, enter your results below. The AI will analyze your vision to assign your Startup Studio.
              </p>

              {/* Brand Type */}
              <div style={{ marginBottom: "20px" }}>
                <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: CYAN, letterSpacing: "0.1em", textTransform: "uppercase" }}>Personality Brand Type</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {Object.entries(brandTypes).map(([key, bt]) => (
                    <button key={key} onClick={() => setManualBrandType(key)}
                      style={{ padding: "12px", borderRadius: "10px", border: `2px solid ${manualBrandType === key ? CYAN : "rgba(255,255,255,0.08)"}`, background: manualBrandType === key ? "rgba(0,212,255,0.08)" : "transparent", color: manualBrandType === key ? CYAN : "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 700, textAlign: "left", cursor: "pointer" }}>
                      {bt.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Top Pathways */}
              <div style={{ marginBottom: "20px" }}>
                <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: CYAN, letterSpacing: "0.1em", textTransform: "uppercase" }}>Top Pathways (select up to 3)</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {Object.entries(pathwayLabels).map(([key, pw]) => (
                    <button key={key} onClick={() => {
                      setManualPathways(prev => prev.includes(key) ? prev.filter(p => p !== key) : prev.length < 3 ? [...prev, key] : prev);
                    }}
                      style={{ padding: "12px", borderRadius: "10px", border: `2px solid ${manualPathways.includes(key) ? "#a78bfa" : "rgba(255,255,255,0.08)"}`, background: manualPathways.includes(key) ? "rgba(167,139,250,0.08)" : "transparent", color: manualPathways.includes(key) ? "#a78bfa" : "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 700, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>{pw.icon}</span> {pw.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vision text for AI analysis */}
              <div style={{ marginBottom: "20px" }}>
                <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: CYAN, letterSpacing: "0.1em", textTransform: "uppercase" }}>Vision Statement (AI will analyze this)</p>
                <textarea
                  value={manualVisionText}
                  onChange={e => setManualVisionText(e.target.value)}
                  placeholder="Describe what you want to create, the impact you want to make, and what you'll be known for in 2 years..."
                  rows={4}
                  style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid rgba(0,212,255,0.2)", background: "rgba(0,212,255,0.04)", color: "#fff", fontSize: "13px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
                />
                <p style={{ margin: "6px 0 0", fontSize: "10px", color: "rgba(0,212,255,0.3)" }}>The AI will analyze your vision to match you with the best Startup Studio</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => { setIsSkipMode(false); setStep("intro"); }}
                style={{ flex: 1, padding: "14px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                &larr; Back
              </button>
              <button
                onClick={handleSkipComplete}
                disabled={!manualVisionText.trim()}
                style={{ flex: 2, padding: "18px", borderRadius: "14px", border: "none", cursor: manualVisionText.trim() ? "pointer" : "not-allowed", background: manualVisionText.trim() ? "linear-gradient(90deg,#f5c842,#f97316)" : "rgba(255,255,255,0.06)", color: manualVisionText.trim() ? "#000" : "rgba(255,255,255,0.25)", fontSize: "15px", fontWeight: 900, letterSpacing: "0.06em" }}>
                ANALYZE &amp; FIND MY STUDIO &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {step === "results" && results && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Brand Type */}
            <div style={{ background: "rgba(0,212,255,0.04)", border: "2px solid rgba(0,212,255,0.2)", borderRadius: "24px", padding: "32px", textAlign: "center", position: "relative" }}>
              <div style={{ position: "absolute", top: "10px", left: "10px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.4)", borderRight: "none", borderBottom: "none", borderRadius: "2px" }} />
              <div style={{ position: "absolute", top: "10px", right: "10px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.4)", borderLeft: "none", borderBottom: "none", borderRadius: "2px" }} />
              <div style={{ position: "absolute", bottom: "10px", left: "10px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.4)", borderRight: "none", borderTop: "none", borderRadius: "2px" }} />
              <div style={{ position: "absolute", bottom: "10px", right: "10px", width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.4)", borderLeft: "none", borderTop: "none", borderRadius: "2px" }} />
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>{"\u2728"}</div>
              <p style={{ margin: "0 0 4px", fontSize: "12px", letterSpacing: "0.15em", color: "rgba(0,212,255,0.5)", fontWeight: 700 }}>YOUR PERSONALITY BRAND</p>
              <h2 style={{ margin: "0 0 16px", fontSize: "32px", fontWeight: 900, background: "linear-gradient(90deg,#00d4ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {brandTypes[results.brandType].name}
              </h2>
              <p style={{ margin: "0 0 20px", fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>{brandTypes[results.brandType].description}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {brandTypes[results.brandType].traits.map((t, i) => (
                  <div key={i} style={{ background: "rgba(0,0,0,0.4)", borderRadius: "10px", padding: "10px 14px", border: "1px solid rgba(0,212,255,0.15)" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: CYAN }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dimension scores */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "24px" }}>
              <p style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Creative Dimensions</p>
              {[
                { label: "Maker", val: results.scores.maker, max: 6, color: "#f5c842" },
                { label: "Visionary", val: results.scores.visionary, max: 6, color: "#a78bfa" },
                { label: "Storyteller", val: results.scores.storyteller, max: 6, color: "#f472b6" },
                { label: "Technologist", val: results.scores.technologist, max: 6, color: CYAN },
              ].map(d => (
                <div key={d.label} style={{ marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: d.color }}>{d.label}</span>
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>{d.val}/{d.max}</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(d.val / d.max) * 100}%`, background: d.color, borderRadius: "3px", transition: "width 0.5s ease" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Top pathways */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "24px" }}>
              <p style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Your Top Pathways</p>
              {results.topPathways.map((pid, i) => {
                const pw = pathwayLabels[pid];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", background: "rgba(0,212,255,0.04)", borderRadius: "12px", border: "1px solid rgba(0,212,255,0.12)", marginBottom: "8px" }}>
                    <span style={{ fontSize: "24px" }}>{pw.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: CYAN }}>{pw.name}</p>
                    </div>
                    <span style={{ fontSize: "18px", fontWeight: 900, color: "rgba(0,212,255,0.4)" }}>#{i + 1}</span>
                  </div>
                );
              })}
            </div>

            <button onClick={() => setStep("vision")}
              style={{ padding: "18px", borderRadius: "14px", border: "none", cursor: "pointer", background: "linear-gradient(90deg,#00d4ff,#a78bfa)", color: "#000", fontSize: "15px", fontWeight: 900, letterSpacing: "0.06em" }}>
              BUILD YOUR VISION STATEMENT &rarr;
            </button>
          </div>
        )}

        {/* ── VISION STATEMENT ── */}
        {step === "vision" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "24px", padding: "32px" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 800, color: CYAN }}>Craft Your Vision Statement</h2>
              <p style={{ margin: "0 0 28px", fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
                Complete the four parts below. This becomes your brand identity inside PFLX.
              </p>
              {(["create", "impact", "perspective", "future"] as const).map((field) => {
                const labels = { create: "I want to create\u2026", impact: "\u2026that will\u2026", perspective: "My unique perspective is\u2026", future: "In two years, I\u2019ll be known for\u2026" };
                return (
                  <div key={field} style={{ marginBottom: "24px" }}>
                    <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 700, color: "rgba(0,212,255,0.7)" }}>{labels[field]}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {visionOptions[field].map((opt, i) => (
                        <button key={i} onClick={() => setVision(v => ({ ...v, [field]: opt }))}
                          style={{ padding: "12px 16px", borderRadius: "10px", border: `1px solid ${vision[field] === opt ? CYAN : "rgba(255,255,255,0.08)"}`, background: vision[field] === opt ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.02)", color: vision[field] === opt ? CYAN : "rgba(255,255,255,0.5)", fontSize: "13px", textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}>
                          {opt}
                        </button>
                      ))}
                      <input
                        placeholder="Or type your own\u2026"
                        value={!visionOptions[field].includes(vision[field]) ? vision[field] : ""}
                        onChange={e => setVision(v => ({ ...v, [field]: e.target.value }))}
                        className="input-field"
                        style={{ fontSize: "13px", padding: "12px 14px", marginTop: "4px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "10px", color: "#fff", outline: "none" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vision preview */}
            {vision.create && vision.impact && vision.perspective && vision.future && (
              <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: "18px", padding: "24px" }}>
                <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: 700, color: "rgba(167,139,250,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Your Vision Statement</p>
                <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: 1.8, fontStyle: "italic" }}>
                  &quot;I want to create <strong style={{ color: "#a78bfa" }}>{vision.create}</strong> that will <strong style={{ color: "#a78bfa" }}>{vision.impact}</strong>. My unique perspective is <strong style={{ color: "#a78bfa" }}>{vision.perspective}</strong>. In two years, I&apos;ll be known for <strong style={{ color: "#a78bfa" }}>{vision.future}</strong>.&quot;
                </p>
              </div>
            )}

            <button
              onClick={handleVisionComplete}
              disabled={!vision.create || !vision.impact || !vision.perspective || !vision.future}
              style={{ padding: "18px", borderRadius: "14px", border: "none", cursor: (!vision.create || !vision.impact || !vision.perspective || !vision.future) ? "not-allowed" : "pointer", background: (!vision.create || !vision.impact || !vision.perspective || !vision.future) ? "rgba(255,255,255,0.06)" : "linear-gradient(90deg,#f5c842,#f97316)", color: (!vision.create || !vision.impact || !vision.perspective || !vision.future) ? "rgba(255,255,255,0.2)" : "#000", fontSize: "15px", fontWeight: 900, letterSpacing: "0.06em" }}>
              FIND MY STARTUP STUDIO &rarr;
            </button>
          </div>
        )}

        {/* ── AI PLACEMENT ── */}
        {step === "placement" && (
          <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "24px" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", border: "3px solid rgba(0,212,255,0.3)", borderTopColor: CYAN, animation: "spin 0.8s linear infinite" }} />
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: CYAN }}>Analyzing your profile&hellip;</p>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>The AI is finding your perfect Startup Studio match</p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── PERSONAL BRANDING ── */}
        {step === "branding" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Studio assignment preview */}
            {studio && (
              <div style={{
                background: `rgba(${studio.colorRgb},0.08)`, border: `2px solid rgba(${studio.colorRgb},0.3)`,
                borderRadius: "18px", padding: "20px", display: "flex", alignItems: "center", gap: "16px",
              }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: `rgba(${studio.colorRgb},0.2)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0 }}>{studio.icon}</div>
                <div>
                  <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", fontWeight: 700 }}>YOUR STARTUP STUDIO</p>
                  <p style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: studio.color }}>{studio.name}</p>
                </div>
              </div>
            )}

            <div style={{ background: "rgba(244,114,182,0.04)", border: "1px solid rgba(244,114,182,0.2)", borderRadius: "24px", padding: "32px" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 800, color: "#f472b6" }}>Build Your Personal Brand</h2>
              <p style={{ margin: "0 0 24px", fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
                Your brand is how people experience you in the PFLX ecosystem. Complete the steps below to establish your creative identity.
              </p>

              {/* Step 1: Brand Name */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900, color: CYAN }}>1</div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: CYAN }}>Brand Name</p>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                  Keep it memorable, easy to say/spell, and future-proof. You can keep your character name, shorten it, or add a twist.
                </p>
                <input
                  value={brandName}
                  onChange={e => setBrandName(e.target.value)}
                  placeholder="e.g., LumaTech, NovaCreates, PixelForge"
                  style={{ width: "100%", padding: "14px 16px", borderRadius: "10px", border: "1px solid rgba(244,114,182,0.25)", background: "rgba(244,114,182,0.04)", color: "#fff", fontSize: "15px", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Step 2: Slogan */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900, color: "#a78bfa" }}>2</div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#a78bfa" }}>Slogan / Tagline</p>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                  A short, punchy line that captures your brand&apos;s promise or energy. Aim for 3-7 words.
                </p>
                <input
                  value={slogan}
                  onChange={e => setSlogan(e.target.value)}
                  placeholder="e.g., Building tomorrow's worlds today"
                  style={{ width: "100%", padding: "14px 16px", borderRadius: "10px", border: "1px solid rgba(167,139,250,0.25)", background: "rgba(167,139,250,0.04)", color: "#fff", fontSize: "15px", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Remaining steps info */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px", marginBottom: "8px" }}>
                <p style={{ margin: "0 0 10px", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Complete these in Canva (links available in your dashboard)</p>
                {[
                  { num: "3", label: "Logo Design", sub: "Create in Canva — simple, scalable", color: "#f5c842" },
                  { num: "4", label: "Color Palette", sub: "3-5 colors with hex codes", color: "#22c55e" },
                  { num: "5", label: "Typography", sub: "One headline + one body font", color: "#06b6d4" },
                  { num: "6", label: "Brand Board", sub: "Assemble everything on one Canva slide", color: "#ef4444" },
                ].map(s => (
                  <div key={s.num} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 900, color: s.color, flexShrink: 0 }}>{s.num}</div>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: s.color }}>{s.label}</span>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginLeft: "6px" }}>{s.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleBrandingComplete}
              disabled={!brandName.trim()}
              style={{ padding: "18px", borderRadius: "14px", border: "none", cursor: brandName.trim() ? "pointer" : "not-allowed", background: brandName.trim() ? "linear-gradient(90deg,#f472b6,#a78bfa)" : "rgba(255,255,255,0.06)", color: brandName.trim() ? "#fff" : "rgba(255,255,255,0.2)", fontSize: "15px", fontWeight: 900, letterSpacing: "0.06em" }}>
              COMPLETE ONBOARDING &rarr;
            </button>
          </div>
        )}

        {/* ── WELCOME / COMPLETE ── */}
        {step === "welcome" && studio && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>{"\uD83C\uDF89"}</div>
              <h2 style={{ margin: "0 0 6px", fontSize: "28px", fontWeight: 900, background: "linear-gradient(90deg,#00d4ff,#a78bfa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Onboarding Complete!</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Welcome to the PFLX ecosystem, {brandName || user.brandName || user.name}</p>
            </div>

            {/* Studio card */}
            <div style={{
              background: `rgba(${studio.colorRgb},0.08)`,
              border: `2px solid rgba(${studio.colorRgb},0.4)`,
              borderRadius: "28px", padding: "40px 32px", textAlign: "center", position: "relative",
              boxShadow: `0 0 40px rgba(${studio.colorRgb},0.15), inset 0 0 40px rgba(${studio.colorRgb},0.04)`,
            }}>
              <div style={{ position: "absolute", top: "10px", left: "10px", width: "18px", height: "18px", border: `2px solid rgba(${studio.colorRgb},0.5)`, borderRight: "none", borderBottom: "none", borderRadius: "2px" }} />
              <div style={{ position: "absolute", top: "10px", right: "10px", width: "18px", height: "18px", border: `2px solid rgba(${studio.colorRgb},0.5)`, borderLeft: "none", borderBottom: "none", borderRadius: "2px" }} />
              <div style={{ position: "absolute", bottom: "10px", left: "10px", width: "18px", height: "18px", border: `2px solid rgba(${studio.colorRgb},0.5)`, borderRight: "none", borderTop: "none", borderRadius: "2px" }} />
              <div style={{ position: "absolute", bottom: "10px", right: "10px", width: "18px", height: "18px", border: `2px solid rgba(${studio.colorRgb},0.5)`, borderLeft: "none", borderTop: "none", borderRadius: "2px" }} />

              <div style={{ width: "80px", height: "80px", borderRadius: "20px", background: `rgba(${studio.colorRgb},0.15)`, border: `2px solid rgba(${studio.colorRgb},0.4)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", margin: "0 auto 20px" }}>
                {studio.icon}
              </div>
              <p style={{ margin: "0 0 6px", fontSize: "12px", letterSpacing: "0.18em", color: `rgba(${studio.colorRgb},0.7)`, fontWeight: 700 }}>YOUR STARTUP STUDIO</p>
              <h2 style={{ margin: "0 0 8px", fontSize: "32px", fontWeight: 900, color: studio.color }}>{studio.name}</h2>
              <p style={{ margin: "0 0 20px", fontSize: "14px", fontStyle: "italic", color: "rgba(255,255,255,0.4)" }}>&quot;{studio.tagline}&quot;</p>
              <p style={{ margin: "0 0 24px", fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>{studio.description}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                {studio.themes.map(t => (
                  <span key={t} style={{ padding: "4px 12px", borderRadius: "100px", background: `rgba(${studio.colorRgb},0.12)`, border: `1px solid rgba(${studio.colorRgb},0.3)`, color: studio.color, fontSize: "11px", fontWeight: 700 }}>{t}</span>
                ))}
              </div>
            </div>

            {/* What happens next */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "24px" }}>
              <p style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>What happens next</p>
              {[
                { icon: "\uD83C\uDFE2", text: "Your Studio is your team \u2014 compete on the leaderboard and earn studio XC together" },
                { icon: "\uD83D\uDCB0", text: "Stake XC in your Studio pool and earn returns as the studio grows" },
                { icon: "\uD83D\uDCC8", text: "Higher Evo Ranks unlock bigger stake percentages and studio leadership abilities" },
                { icon: "\uD83C\uDFC6", text: "Studios compete every season \u2014 corporate tax is deducted at the end of each season" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "18px", flexShrink: 0 }}>{item.icon}</span>
                  <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{item.text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push("/player")}
              style={{ padding: "20px", borderRadius: "14px", border: "none", cursor: "pointer", background: `linear-gradient(90deg, ${studio.color}, #a78bfa)`, color: "#fff", fontSize: "16px", fontWeight: 900, letterSpacing: "0.06em", boxShadow: `0 0 24px rgba(${studio.colorRgb},0.4)` }}>
              ENTER THE ECOSYSTEM &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
