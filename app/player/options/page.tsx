"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import {
  User, mockUsers, DiagnosticResult, mockStartupStudios,
  assignStudioFromVisionText,
} from "../../lib/data";
import { mergePlayerStats } from "../../lib/playerStats";
import { saveUsers } from "../../lib/store";
import { saveAndToast } from "../../lib/saveToast";

const CYAN = "#00d4ff";

const brandTypes: Record<string, { name: string; description: string; traits: string[] }> = {
  "technical-builder": { name: "Technical Builder", description: "You excel at turning ideas into working systems through hands-on technical execution.", traits: ["Detail-oriented", "Problem-solver", "Systems thinker", "Implementation-focused"] },
  "creative-director": { name: "Creative Director", description: "You thrive on big-picture thinking and guiding creative vision through compelling narratives.", traits: ["Visionary", "Strategic", "Story-driven", "Leadership-oriented"] },
  "experience-designer": { name: "Experience Designer", description: "You bring ideas to life through hands-on creation of emotionally engaging experiences.", traits: ["Hands-on creator", "Empathetic", "User-focused", "Narrative-driven"] },
  "digital-innovator": { name: "Digital Innovator", description: "You push boundaries by envisioning and architecting cutting-edge technical solutions.", traits: ["Forward-thinking", "Technical expert", "Innovation-focused", "System architect"] },
};

const pathwayLabels: Record<string, { name: string; icon: string }> = {
  "content-creator": { name: "Content Creator", icon: "🎬" },
  "3d-modeler": { name: "3D Modeler", icon: "🎮" },
  "sound-designer": { name: "Sound Designer", icon: "🎵" },
  "digital-artist": { name: "Digital Artist", icon: "🎨" },
  "computer-programmer": { name: "Computer Programmer", icon: "💻" },
  "game-designer": { name: "Game Designer", icon: "🎯" },
};

// ─── Studio logo helper ────────────────────────────────────────────────────
function StudioLogo({ studioId, icon, color, colorRgb, size = 56 }: {
  studioId: string; icon: string; color: string; colorRgb: string; size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const slug = studioId.replace("studio-", "");
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: `${Math.round(size * 0.22)}px`,
      flexShrink: 0, overflow: "hidden",
      background: `rgba(${colorRgb},0.85)`,
      border: `1.5px solid rgba(${colorRgb},0.5)`,
      boxShadow: `0 0 20px rgba(${colorRgb},0.35)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {imgFailed ? (
        <span style={{ fontSize: `${Math.round(size * 0.46)}px` }}>{icon}</span>
      ) : (
        <img
          src={`/studio-${slug}.png`}
          alt={studioId}
          onError={() => setImgFailed(true)}
          style={{ width: "80%", height: "80%", objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
      )}
    </div>
  );
}

export default function PlayerOptions() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState<"onboarding" | "workethic" | null>("onboarding");
  const [editMode, setEditMode] = useState(false);
  const [editBrandType, setEditBrandType] = useState("");
  const [editPathways, setEditPathways] = useState<string[]>([]);
  const [editVision, setEditVision] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    let u = JSON.parse(stored) as User;
    if (u.role !== "player") { router.push("/admin"); return; }
    const fresh = mockUsers.find(mu => mu.id === u.id);
    if (fresh) {
      u = { ...u, ...fresh };
    }
    u = mergePlayerStats(u);
    setUser(u);
  }, [router]);

  if (!user) return null;

  const dr = user.diagnosticResult;
  const studio = mockStartupStudios.find(s => s.id === user.studioId);

  const startEdit = () => {
    if (!dr) return;
    setEditBrandType(dr.brandType);
    setEditPathways([...dr.topPathways]);
    const vs = dr.visionStatement;
    setEditVision(vs ? [vs.create, vs.impact, vs.perspective, vs.future].filter(Boolean).join(". ") : "");
    setEditMode(true);
  };

  const saveEdit = async () => {
    if (!user || !dr) return;
    setSaving(true);
    const newBrandType = (editBrandType || dr.brandType) as DiagnosticResult["brandType"];
    const newPathways = editPathways.length > 0 ? editPathways : dr.topPathways;
    const studioId = assignStudioFromVisionText(editVision || "creative experiences");

    const updatedResult: DiagnosticResult = {
      ...dr,
      brandType: newBrandType,
      topPathways: newPathways,
      visionStatement: { create: editVision, impact: "", perspective: "", future: "" },
    };
    const updatedUser: User = {
      ...user,
      diagnosticResult: updatedResult,
      studioId,
      pathway: pathwayLabels[newPathways[0]]?.name || user.pathway,
    };
    const idx = mockUsers.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      mockUsers[idx] = updatedUser;
      const sIdx = mockStartupStudios.findIndex(s => s.id === studioId);
      if (sIdx >= 0 && !mockStartupStudios[sIdx].members.includes(user.id)) {
        mockStartupStudios[sIdx].members.push(user.id);
      }
    }
    localStorage.setItem("pflx_user", JSON.stringify(updatedUser));
    await saveAndToast([saveUsers], "Onboarding results updated — saved to cloud ✓");
    setUser(updatedUser);
    setEditMode(false);
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <SideNav user={user} />
      <main style={{ flex: 1, padding: "32px", overflow: "auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚙️</span>
            <span style={{
              background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))",
            }}>OPTIONS</span>
          </h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>
            [ PLAYER SETTINGS & IDENTITY ]
          </p>
        </div>

        {/* Section buttons */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "28px", flexWrap: "wrap" }}>
          {[
            { id: "onboarding" as const, label: "Player Onboarding Results", icon: "🧬" },
            { id: "workethic" as const, label: "Work Ethic Mode", icon: "⚡" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(activeSection === tab.id ? null : tab.id)}
              style={{
                padding: "12px 20px", borderRadius: "12px", border: "none",
                cursor: "pointer", fontWeight: 700, fontSize: "13px",
                display: "flex", alignItems: "center", gap: "8px",
                transition: "all 0.2s",
                background: activeSection === tab.id ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                color: activeSection === tab.id ? CYAN : "rgba(255,255,255,0.45)",
                border: `1px solid ${activeSection === tab.id ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                boxShadow: activeSection === tab.id ? "0 0 16px rgba(0,212,255,0.1)" : "none",
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* ── Onboarding Results Section ─────────────────────────────────── */}
        {activeSection === "onboarding" && (
          <div style={{ maxWidth: "720px" }}>
            {!dr ? (
              <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px", padding: "40px", textAlign: "center",
              }}>
                <p style={{ margin: "0 0 12px", fontSize: "40px" }}>🔒</p>
                <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: CYAN }}>Onboarding Not Complete</p>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                  You haven&apos;t completed the Player Onboarding assessment yet.
                </p>
              </div>
            ) : editMode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ background: "rgba(245,200,66,0.05)", border: "1px solid rgba(245,200,66,0.2)", borderRadius: "18px", padding: "24px" }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 800, color: "#f5c842" }}>Edit Onboarding Results</h3>
                  <p style={{ margin: "0 0 20px", fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                    Update your results below. The AI will re-analyze your vision to match you with the best Startup Studio.
                  </p>

                  {/* Brand Type */}
                  <div style={{ marginBottom: "20px" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: CYAN, letterSpacing: "0.1em", textTransform: "uppercase" }}>Personality Brand Type</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {Object.entries(brandTypes).map(([key, bt]) => (
                        <button key={key} onClick={() => setEditBrandType(key)}
                          style={{ padding: "10px", borderRadius: "10px", border: `2px solid ${editBrandType === key ? CYAN : "rgba(255,255,255,0.08)"}`, background: editBrandType === key ? "rgba(0,212,255,0.08)" : "transparent", color: editBrandType === key ? CYAN : "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: 700, textAlign: "left", cursor: "pointer" }}>
                          {bt.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pathways */}
                  <div style={{ marginBottom: "20px" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: CYAN, letterSpacing: "0.1em", textTransform: "uppercase" }}>Top Pathways (select up to 3)</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {Object.entries(pathwayLabels).map(([key, pw]) => (
                        <button key={key} onClick={() => {
                          setEditPathways(prev => prev.includes(key) ? prev.filter(p => p !== key) : prev.length < 3 ? [...prev, key] : prev);
                        }}
                          style={{ padding: "10px", borderRadius: "10px", border: `2px solid ${editPathways.includes(key) ? "#a78bfa" : "rgba(255,255,255,0.08)"}`, background: editPathways.includes(key) ? "rgba(167,139,250,0.08)" : "transparent", color: editPathways.includes(key) ? "#a78bfa" : "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: 700, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>{pw.icon}</span> {pw.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vision Text */}
                  <div style={{ marginBottom: "16px" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: CYAN, letterSpacing: "0.1em", textTransform: "uppercase" }}>Vision Statement (AI will re-analyze)</p>
                    <textarea
                      value={editVision}
                      onChange={e => setEditVision(e.target.value)}
                      placeholder="Describe what you want to create, the impact you want to make..."
                      rows={4}
                      style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid rgba(0,212,255,0.2)", background: "rgba(0,212,255,0.04)", color: "#fff", fontSize: "13px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button onClick={() => setEditMode(false)}
                    style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={saveEdit} disabled={saving}
                    style={{ flex: 2, padding: "14px", borderRadius: "12px", border: "none", background: "linear-gradient(90deg,#f5c842,#f97316)", color: "#000", fontSize: "13px", fontWeight: 900, letterSpacing: "0.06em", cursor: "pointer" }}>
                    {saving ? "Saving..." : "Save & Re-Assign Studio"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                {/* Edit button */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={startEdit}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(0,212,255,0.25)", background: "rgba(0,212,255,0.06)", color: CYAN, fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    ✏️ Edit Results
                  </button>
                </div>

                {/* Studio Assignment */}
                {studio && (
                  <div style={{
                    background: `rgba(${studio.colorRgb},0.05)`,
                    border: `1px solid rgba(${studio.colorRgb},0.25)`,
                    borderRadius: "18px", padding: "24px",
                    display: "flex", alignItems: "center", gap: "20px",
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, rgba(${studio.colorRgb},0.5), transparent)` }} />
                    <StudioLogo studioId={studio.id} icon={studio.icon} color={studio.color} colorRgb={studio.colorRgb} size={64} />
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "10px", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>YOUR STARTUP STUDIO</p>
                      <p style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 900, color: studio.color }}>{studio.name}</p>
                      <p style={{ margin: 0, fontSize: "12px", color: `rgba(${studio.colorRgb},0.7)`, fontStyle: "italic" }}>{studio.tagline}</p>
                    </div>
                  </div>
                )}

                {/* Brand Type */}
                <div style={{
                  background: "rgba(0,212,255,0.04)", border: "2px solid rgba(0,212,255,0.2)",
                  borderRadius: "18px", padding: "28px", textAlign: "center",
                  position: "relative",
                }}>
                  <div style={{ position: "absolute", top: "10px", left: "10px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.35)", borderRight: "none", borderBottom: "none", borderRadius: "2px" }} />
                  <div style={{ position: "absolute", top: "10px", right: "10px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.35)", borderLeft: "none", borderBottom: "none", borderRadius: "2px" }} />
                  <div style={{ position: "absolute", bottom: "10px", left: "10px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.35)", borderRight: "none", borderTop: "none", borderRadius: "2px" }} />
                  <div style={{ position: "absolute", bottom: "10px", right: "10px", width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.35)", borderLeft: "none", borderTop: "none", borderRadius: "2px" }} />

                  <div style={{ fontSize: "40px", marginBottom: "10px" }}>✨</div>
                  <p style={{ margin: "0 0 4px", fontSize: "11px", letterSpacing: "0.15em", color: "rgba(0,212,255,0.5)", fontWeight: 700 }}>YOUR PERSONALITY BRAND</p>
                  <h2 style={{ margin: "0 0 12px", fontSize: "28px", fontWeight: 900, background: "linear-gradient(90deg,#00d4ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {brandTypes[dr.brandType]?.name ?? dr.brandType}
                  </h2>
                  <p style={{ margin: "0 0 18px", fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                    {brandTypes[dr.brandType]?.description}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {(brandTypes[dr.brandType]?.traits ?? []).map((t, i) => (
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
                    { label: "Maker", val: dr.scores.maker, max: 6, color: "#f5c842" },
                    { label: "Visionary", val: dr.scores.visionary, max: 6, color: "#a78bfa" },
                    { label: "Storyteller", val: dr.scores.storyteller, max: 6, color: "#f472b6" },
                    { label: "Technologist", val: dr.scores.technologist, max: 6, color: CYAN },
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
                  {dr.topPathways.map((pid, i) => {
                    const pw = pathwayLabels[pid] ?? { name: pid, icon: "📌" };
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

                {/* Vision Statement */}
                {dr.visionStatement && (dr.visionStatement.create || dr.visionStatement.impact || dr.visionStatement.perspective || dr.visionStatement.future) && (
                  <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: "18px", padding: "24px" }}>
                    <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 700, color: "rgba(167,139,250,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Your Vision Statement</p>
                    <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: 1.8, fontStyle: "italic" }}>
                      &quot;I want to create <strong style={{ color: "#a78bfa" }}>{dr.visionStatement.create}</strong> that will <strong style={{ color: "#a78bfa" }}>{dr.visionStatement.impact}</strong>. My unique perspective is <strong style={{ color: "#a78bfa" }}>{dr.visionStatement.perspective}</strong>. In two years, I&apos;ll be known for <strong style={{ color: "#a78bfa" }}>{dr.visionStatement.future}</strong>.&quot;
                    </p>
                  </div>
                )}

                {/* Completed date */}
                <div style={{ textAlign: "center", padding: "8px", color: "rgba(255,255,255,0.2)", fontSize: "11px" }}>
                  Completed on {new Date(dr.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Work Ethic Mode Section ──────────────────────────────────── */}
        {activeSection === "workethic" && (
          <div style={{ maxWidth: "720px" }}>
            <div style={{
              borderRadius: "18px", overflow: "hidden",
              background: "rgba(22,22,31,0.6)", border: "1px solid rgba(245,200,66,0.15)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            }}>
              <div style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <h2 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 900, color: "#f0f0ff" }}>⚡ Work Ethic Mode</h2>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  Choose how intensely your AI assistant chunks out suggestions and task breakdowns. Higher modes mean more detailed daily plans and tighter deadlines.
                </p>
              </div>
              <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {([
                  { mode: "high" as const, label: "HIGH", icon: "🔥", color: "#ef4444", desc: "Maximum output. Daily micro-tasks, aggressive deadlines, detailed step-by-step breakdowns. For players who want to move fast and ship constantly." },
                  { mode: "medium" as const, label: "MEDIUM", icon: "⚡", color: "#f5c842", desc: "Balanced pace. Weekly milestone focus with actionable suggestions. Good for steady, consistent progress." },
                  { mode: "low" as const, label: "LOW", icon: "🌿", color: "#22c55e", desc: "Relaxed pace. High-level guidance with flexible timelines. Focus on quality over quantity, bigger picture thinking." },
                ]).map(opt => {
                  const active = (user.workEthicMode || "medium") === opt.mode;
                  return (
                    <button key={opt.mode} onClick={async () => {
                      const updated = { ...user, workEthicMode: opt.mode };
                      const idx = mockUsers.findIndex(u => u.id === user.id);
                      if (idx >= 0) mockUsers[idx] = updated;
                      localStorage.setItem("pflx_user", JSON.stringify(updated));
                      setUser(updated);
                      await saveAndToast([saveUsers], `Work ethic set to ${opt.label} ✓`);
                    }} style={{
                      display: "flex", alignItems: "center", gap: "16px", padding: "18px 20px",
                      borderRadius: "14px", cursor: "pointer", textAlign: "left",
                      background: active ? `rgba(${opt.color === "#ef4444" ? "239,68,68" : opt.color === "#f5c842" ? "245,200,66" : "34,197,94"},0.1)` : "rgba(255,255,255,0.03)",
                      border: active ? `2px solid ${opt.color}` : "2px solid rgba(255,255,255,0.06)",
                      transition: "all 0.2s",
                    }}>
                      <span style={{ fontSize: "28px" }}>{opt.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 900, color: active ? opt.color : "rgba(255,255,255,0.6)", letterSpacing: "0.08em" }}>{opt.label}</span>
                          {active && <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "9px", fontWeight: 800, background: `${opt.color}22`, color: opt.color, letterSpacing: "0.1em" }}>ACTIVE</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
