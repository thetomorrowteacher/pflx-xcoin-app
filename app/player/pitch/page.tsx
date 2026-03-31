"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import {
  User, mockUsers, ProjectPitch, mockProjectPitches, isHostUser,
} from "../../lib/data";
import { saveProjectPitches } from "../../lib/store";
import { saveAndToast } from "../../lib/saveToast";
import { playClick, playSuccess, playError, playModalOpen, playModalClose } from "../../lib/sounds";
import { applyPlayerImages } from "../../lib/playerImages";

const PATHWAYS = [
  { slug: "professional-entrepreneur", label: "Professional Entrepreneur", icon: "📖" },
  { slug: "content-creator", label: "Content Creator", icon: "🎬" },
  { slug: "digital-artist", label: "Digital Artist", icon: "🎨" },
  { slug: "3d-modeler", label: "3D Modeler", icon: "🧊" },
  { slug: "cs-ai-specialist", label: "CS / AI Specialist", icon: "🤖" },
  { slug: "sound-designer", label: "Sound Designer", icon: "🎵" },
  { slug: "game-designer", label: "Game Designer", icon: "🎮" },
];

const CYAN = "#00d4ff";

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  draft:        { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", text: "rgba(255,255,255,0.5)" },
  submitted:    { bg: "rgba(79,142,247,0.12)",  border: "rgba(79,142,247,0.4)",   text: "#4f8ef7" },
  under_review: { bg: "rgba(245,200,66,0.1)",   border: "rgba(245,200,66,0.4)",   text: "#f5c842" },
  approved:     { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.4)",    text: "#22c55e" },
  rejected:     { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.4)",    text: "#ef4444" },
  live:         { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.4)",  text: "#a78bfa" },
};

const inputSx: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
  color: "white", fontSize: "14px", fontWeight: 500, outline: "none", boxSizing: "border-box",
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</p>
    {children}
  </div>
);

export default function PlayerPitchPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pitches, setPitches] = useState<ProjectPitch[]>([]);
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState<Partial<ProjectPitch>>({});
  const [mediaLinks, setMediaLinks] = useState<string[]>([""]);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "player") { router.push("/admin"); return; }
    if (!u.onboardingComplete) { router.push("/diagnostic"); return; }
    setUser(u);
    setPitches(mockProjectPitches.filter(p => p.creatorId === u.id));
  }, [router]);

  if (!user) return null;

  const openNew = () => {
    playModalOpen();
    setEditing({
      creatorId: user.id,
      title: "",
      description: "",
      pathway: user.pathway || "professional-entrepreneur",
      badgeName: "",
      xcValue: 500,
      mediaLinks: [],
      prerequisites: [],
      estimatedTime: "",
      residualPercent: 12,
      status: "draft",
    });
    setMediaLinks([""]);
    setEditModal(true);
  };

  const openEdit = (pitch: ProjectPitch) => {
    if (pitch.status !== "draft" && pitch.status !== "rejected") return;
    playModalOpen();
    setEditing({ ...pitch });
    setMediaLinks([...(pitch.mediaLinks || []), ""]);
    setEditModal(true);
  };

  const handleSave = (submit: boolean) => {
    if (!editing.title?.trim()) { playError(); return; }
    if (!editing.description?.trim()) { playError(); return; }
    if (!editing.pathway) { playError(); return; }
    if (!editing.badgeName?.trim()) { playError(); return; }

    const isNew = !editing.id;
    const cleanLinks = mediaLinks.filter(l => l.trim());

    const saved: ProjectPitch = {
      id: editing.id || `pitch_${Date.now()}`,
      creatorId: user.id,
      title: editing.title || "",
      description: editing.description || "",
      pathway: editing.pathway || "professional-entrepreneur",
      badgeName: editing.badgeName || "",
      xcValue: editing.xcValue || 500,
      mediaLinks: cleanLinks,
      prerequisites: editing.prerequisites || [],
      estimatedTime: editing.estimatedTime || "",
      courseUrl: editing.courseUrl || "",
      image: editing.image,
      residualPercent: Math.min(15, Math.max(10, editing.residualPercent || 12)),
      status: submit ? "submitted" : "draft",
      submittedAt: submit ? new Date().toISOString() : editing.submittedAt,
      totalResidualEarned: editing.totalResidualEarned || 0,
      completionCount: editing.completionCount || 0,
    };

    let next: ProjectPitch[];
    if (isNew) {
      next = [...pitches, saved];
      mockProjectPitches.push(saved);
    } else {
      next = pitches.map(p => p.id === saved.id ? saved : p);
      const idx = mockProjectPitches.findIndex(p => p.id === saved.id);
      if (idx >= 0) mockProjectPitches[idx] = saved;
      else mockProjectPitches.push(saved);
    }
    setPitches(next);
    playSuccess();
    saveAndToast([saveProjectPitches], submit ? "Pitch submitted for review ✓" : "Draft saved ✓");
    setEditModal(false);
  };

  const handleDelete = (id: string) => {
    const pitch = pitches.find(p => p.id === id);
    if (!pitch || (pitch.status !== "draft" && pitch.status !== "rejected")) return;
    if (!confirm("Delete this pitch?")) return;
    const next = pitches.filter(p => p.id !== id);
    setPitches(next);
    const idx = mockProjectPitches.findIndex(p => p.id === id);
    if (idx >= 0) mockProjectPitches.splice(idx, 1);
    saveAndToast([saveProjectPitches], "Pitch deleted ✓");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditing(p => ({ ...p, image: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const myPitches = pitches.sort((a, b) => {
    const order = { live: 0, approved: 1, under_review: 2, submitted: 3, draft: 4, rejected: 5 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#08080f" }}>
      <SideNav user={user} />
      <main style={{ flex: 1, padding: "32px", maxWidth: "900px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 900, color: "#f0f0ff" }}>
            💡 Project Pitch
          </h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
            Pitch your own projects and courses. When approved, they become pathway nodes — and you earn residual XC every time someone completes them.
          </p>
        </div>

        {/* Residual earnings summary */}
        {myPitches.some(p => (p.totalResidualEarned || 0) > 0) && (
          <div style={{
            padding: "16px 20px", borderRadius: "14px", marginBottom: "24px",
            background: "linear-gradient(135deg, rgba(167,139,250,0.1), rgba(79,142,247,0.08))",
            border: "1px solid rgba(167,139,250,0.2)",
          }}>
            <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, color: "rgba(167,139,250,0.6)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Your Residual Earnings</p>
            <div style={{ display: "flex", gap: "24px", alignItems: "baseline" }}>
              <span style={{ fontSize: "28px", fontWeight: 900, color: "#a78bfa" }}>
                {myPitches.reduce((s, p) => s + (p.totalResidualEarned || 0), 0).toLocaleString()} XC
              </span>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                from {myPitches.reduce((s, p) => s + (p.completionCount || 0), 0)} total completions
              </span>
            </div>
          </div>
        )}

        {/* New Pitch button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
            {myPitches.length} pitch{myPitches.length !== 1 ? "es" : ""}
          </p>
          <button onClick={openNew} style={{
            padding: "10px 22px", borderRadius: "10px", fontSize: "13px", fontWeight: 800, cursor: "pointer",
            background: "linear-gradient(135deg, #a78bfa, #7c3aed)", border: "none", color: "white",
            boxShadow: "0 0 20px rgba(167,139,250,0.3)",
          }}>＋ New Pitch</button>
        </div>

        {/* Pitch cards */}
        {myPitches.length === 0 ? (
          <div style={{
            padding: "60px 32px", textAlign: "center", borderRadius: "16px",
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>💡</div>
            <h3 style={{ color: "#f0f0ff", margin: "0 0 8px" }}>No Pitches Yet</h3>
            <p style={{ color: "rgba(255,255,255,0.35)", margin: 0, fontSize: "14px" }}>
              Got an idea for a course or project? Pitch it and earn XC when others complete it!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {myPitches.map(pitch => {
              const pw = PATHWAYS.find(p => p.slug === pitch.pathway);
              const sc = statusColors[pitch.status] || statusColors.draft;
              const canEdit = pitch.status === "draft" || pitch.status === "rejected";
              return (
                <div key={pitch.id} style={{
                  padding: "20px", borderRadius: "14px",
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${sc.border}`,
                  cursor: canEdit ? "pointer" : "default",
                  transition: "border-color 0.15s",
                }} onClick={() => canEdit && openEdit(pitch)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <span style={{
                          padding: "3px 12px", borderRadius: "20px", fontSize: "10px", fontWeight: 700,
                          background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text,
                          textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>{pitch.status.replace("_", " ")}</span>
                        {pw && <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{pw.icon} {pw.label}</span>}
                      </div>
                      <h3 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: 800, color: "#f0f0ff" }}>{pitch.title}</h3>
                      <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                        {pitch.description.length > 120 ? pitch.description.slice(0, 120) + "..." : pitch.description}
                      </p>
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
                        <span>🏅 {pitch.badgeName}</span>
                        <span>💎 {pitch.xcValue} XC</span>
                        <span>📊 {pitch.residualPercent}% residual</span>
                        {pitch.estimatedTime && <span>⏱ {pitch.estimatedTime}</span>}
                      </div>
                    </div>
                    {pitch.image && (
                      <img src={pitch.image} alt="" style={{
                        width: "72px", height: "72px", borderRadius: "12px", objectFit: "cover",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }} />
                    )}
                  </div>

                  {/* Residual stats for live pitches */}
                  {pitch.status === "live" && (
                    <div style={{
                      marginTop: "12px", padding: "10px 14px", borderRadius: "10px",
                      background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)",
                      display: "flex", gap: "20px", fontSize: "12px",
                    }}>
                      <span style={{ color: "#a78bfa", fontWeight: 700 }}>💰 {(pitch.totalResidualEarned || 0).toLocaleString()} XC earned</span>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>{pitch.completionCount || 0} completion{(pitch.completionCount || 0) !== 1 ? "s" : ""}</span>
                    </div>
                  )}

                  {/* Rejection feedback */}
                  {pitch.status === "rejected" && pitch.reviewNotes && (
                    <div style={{
                      marginTop: "12px", padding: "10px 14px", borderRadius: "10px",
                      background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                      fontSize: "12px", color: "rgba(239,68,68,0.8)",
                    }}>
                      <strong>Feedback:</strong> {pitch.reviewNotes}
                    </div>
                  )}

                  {/* Actions for drafts/rejected */}
                  {canEdit && (
                    <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(pitch); }} style={{
                        padding: "6px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                        background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.25)", color: "#4f8ef7",
                      }}>Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(pitch.id); }} style={{
                        padding: "6px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444",
                      }}>Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ══════════════════ PITCH MODAL ══════════════════ */}
      {editModal && (
        <div onClick={() => { playModalClose(); setEditModal(false); }} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "linear-gradient(135deg, #0c0c1e 0%, #0a0a16 100%)",
            border: "1px solid rgba(167,139,250,0.25)", borderRadius: "20px",
            maxWidth: "680px", width: "100%", maxHeight: "90vh", overflow: "auto",
            boxShadow: "0 0 60px rgba(167,139,250,0.15)",
          }}>
            <div style={{ padding: "32px" }}>
              <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 900, color: "#f0f0ff" }}>
                {editing.id ? "Edit Pitch" : "New Project Pitch"} 💡
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <Field label="Project / Course Title *">
                  <input value={editing.title || ""} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Intro to 3D Character Modeling" style={inputSx} />
                </Field>

                <Field label="Description *">
                  <textarea value={editing.description || ""} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
                    placeholder="Describe your project/course: what will students learn? What will they create?"
                    rows={4} style={{ ...inputSx, resize: "vertical" }} />
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <Field label="Target Pathway *">
                    <select value={editing.pathway || ""} onChange={e => setEditing(p => ({ ...p, pathway: e.target.value }))}
                      style={{ ...inputSx, cursor: "pointer" }}>
                      {PATHWAYS.map(pw => (
                        <option key={pw.slug} value={pw.slug}>{pw.icon} {pw.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Badge Name *">
                    <input value={editing.badgeName || ""} onChange={e => setEditing(p => ({ ...p, badgeName: e.target.value }))}
                      placeholder="e.g. 3D Character Pro" style={inputSx} />
                  </Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                  <Field label="XC Value">
                    <input type="number" value={editing.xcValue || 500} onChange={e => setEditing(p => ({ ...p, xcValue: parseInt(e.target.value) || 0 }))}
                      min={100} max={5000} style={inputSx} />
                  </Field>
                  <Field label="Residual %">
                    <input type="number" value={editing.residualPercent || 12} onChange={e => setEditing(p => ({ ...p, residualPercent: Math.min(15, Math.max(10, parseInt(e.target.value) || 12)) }))}
                      min={10} max={15} style={inputSx} />
                    <p style={{ margin: "2px 0 0", fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>10-15% of XC value per completion</p>
                  </Field>
                  <Field label="Est. Time">
                    <input value={editing.estimatedTime || ""} onChange={e => setEditing(p => ({ ...p, estimatedTime: e.target.value }))}
                      placeholder="e.g. 2 hours" style={inputSx} />
                  </Field>
                </div>

                <Field label="Course / Content URL">
                  <input value={editing.courseUrl || ""} onChange={e => setEditing(p => ({ ...p, courseUrl: e.target.value }))}
                    placeholder="https://... link to the course content" style={inputSx} />
                </Field>

                <Field label={`Media Links (${mediaLinks.filter(l => l.trim()).length})`}>
                  {mediaLinks.map((link, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                      <input value={link} onChange={e => {
                        const next = [...mediaLinks];
                        next[i] = e.target.value;
                        if (i === mediaLinks.length - 1 && e.target.value.trim()) next.push("");
                        setMediaLinks(next);
                      }} placeholder="YouTube, portfolio, demo link..." style={{ ...inputSx, flex: 1 }} />
                      {mediaLinks.length > 1 && (
                        <button onClick={() => setMediaLinks(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: "8px", color: "#ef4444", cursor: "pointer", padding: "0 10px", fontSize: "14px" }}>×</button>
                      )}
                    </div>
                  ))}
                </Field>

                {/* Cover image */}
                <Field label="Cover Image (optional)">
                  <input ref={imgRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {editing.image ? (
                      <div style={{ position: "relative" }}>
                        <img src={editing.image} alt="" style={{ width: "80px", height: "80px", borderRadius: "12px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
                        <button onClick={() => setEditing(p => ({ ...p, image: undefined }))} style={{
                          position: "absolute", top: -6, right: -6, width: "20px", height: "20px", borderRadius: "50%",
                          background: "#ef4444", border: "none", color: "white", fontSize: "11px", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>×</button>
                      </div>
                    ) : null}
                    <button onClick={() => imgRef.current?.click()} style={{
                      padding: "10px 18px", borderRadius: "10px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)",
                    }}>{editing.image ? "Change Image" : "Upload Image"}</button>
                  </div>
                </Field>

                {/* Info box */}
                <div style={{
                  padding: "12px 16px", borderRadius: "10px",
                  background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)",
                  fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6,
                }}>
                  <strong style={{ color: "#a78bfa" }}>How it works:</strong> Submit your pitch and the host will review it. Once approved, your project becomes a node on the Pathway Portal. Every time another player completes your course, you earn <strong style={{ color: "#a78bfa" }}>{editing.residualPercent || 12}% of {editing.xcValue || 500} XC = {Math.round((editing.xcValue || 500) * (editing.residualPercent || 12) / 100)} XC</strong> as residual income.
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                <button onClick={() => { playClick(); setEditModal(false); }}
                  style={{ padding: "11px 24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "10px", color: "rgba(255,255,255,0.6)", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={() => handleSave(false)}
                  style={{ padding: "11px 22px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "10px", color: "rgba(255,255,255,0.7)", fontWeight: 700, cursor: "pointer" }}>Save Draft</button>
                <button onClick={() => handleSave(true)}
                  style={{ padding: "11px 28px", background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                    border: "none", borderRadius: "10px", color: "white", fontWeight: 800, cursor: "pointer",
                    boxShadow: "0 0 20px rgba(167,139,250,0.3)", fontSize: "14px" }}>
                  Submit for Review 🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
