"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import {
  User, PFLXModifier, mockModifiers,
  ModifierTrigger, ModifierEffect, triggerLabel, effectLabel
} from "../../lib/data";
import { playSuccess, playError, playClick, playDelete } from "../../lib/sounds";
import { saveModifiers } from "../../lib/store";
import { saveAndToast } from "../../lib/saveToast";

const TRIGGER_OPTIONS: ModifierTrigger[] = [
  "manual",
  "task_missed_deadline",
  "checkpoint_missed_deadline",
  "job_missed_deadline",
  "incomplete_submission",
  "task_approved",
  "checkpoint_completed",
];

const EFFECT_OPTIONS: ModifierEffect[] = [
  "xc_deduct", "xc_add", "xc_multiply",
  "badge_deduct", "badge_add",
  "deadline_extend", "freeze",
];

function effectValueLabel(e?: ModifierEffect): string {
  if (!e) return "Value";
  if (e === "xc_deduct" || e === "xc_add") return "XC Amount";
  if (e === "xc_multiply") return "Multiplier (e.g. 1.5)";
  if (e === "badge_deduct" || e === "badge_add") return "Badge Count";
  if (e === "deadline_extend") return "Hours to Extend";
  if (e === "freeze") return "Freeze Duration (hours)";
  return "Value";
}

export default function AdminModifiers() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"upgrades" | "taxes">("upgrades");
  const [modifiers, setModifiers] = useState<PFLXModifier[]>(mockModifiers);
  const [editingMod, setEditingMod] = useState<PFLXModifier | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "admin") { router.push("/player"); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;

  const currentList = modifiers.filter(m =>
    activeTab === "upgrades" ? m.type === "upgrade" : m.type === "tax"
  );

  const upgradeCount = modifiers.filter(m => m.type === "upgrade").length;
  const taxCount = modifiers.filter(m => m.type === "tax").length;
  const autoCount = modifiers.filter(m => m.autoApply).length;
  const manualCount = modifiers.filter(m => !m.autoApply).length;

  const saveModifier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMod) return;
    const existIdx = mockModifiers.findIndex(m => m.id === editingMod.id);
    if (existIdx !== -1) {
      mockModifiers[existIdx] = editingMod;
      setModifiers(modifiers.map(m => m.id === editingMod.id ? editingMod : m));
    } else {
      mockModifiers.push(editingMod);
      setModifiers([...modifiers, editingMod]);
    }
    playSuccess();
    saveAndToast([saveModifiers], "Modifier saved to cloud ✓");
    setEditingMod(null);
  };

  const deleteModifier = (id: string) => {
    if (confirm("Delete this modifier permanently?")) {
      playDelete();
      const idx = mockModifiers.findIndex(m => m.id === id);
      if (idx !== -1) mockModifiers.splice(idx, 1);
      setModifiers(modifiers.filter(m => m.id !== id));
      saveAndToast([saveModifiers], "Modifier deleted — saved to cloud ✓");
    }
  };

  const openNewMod = () => {
    setEditingMod({
      id: `mod-${Date.now()}`,
      type: activeTab === "upgrades" ? "upgrade" : "tax",
      name: "",
      description: "",
      costXcoin: 0,
      costBadge: 0,
      duration: "single-use",
      icon: activeTab === "upgrades" ? "✨" : "🚫",
      autoApply: false,
      triggerEvent: "manual",
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingMod) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditingMod({ ...editingMod, image: event.target?.result as string, isCustomImage: true });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <SideNav user={user} />
      <main style={{ flex: 1, padding: "32px", overflow: "auto", paddingBottom: "80px" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{
              fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
              background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
            }}>⚡ TAX & UPGRADES</h1>
            <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>
              [ MANAGE SYSTEM MODIFIERS THAT AFFECT PLAYERS ]
            </p>
          </div>
          <button onClick={openNewMod} className="btn-primary" style={{ padding: "12px 24px" }}>
            ➕ Create {activeTab === "upgrades" ? "Upgrade" : "Tax"}
          </button>
        </div>

        {/* Stat Pills */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}>
          {[
            { label: "Upgrades", value: upgradeCount, color: "#4f8ef7" },
            { label: "Taxes", value: taxCount, color: "#ef4444" },
            { label: "Auto-Apply", value: autoCount, color: "#00d4ff" },
            { label: "Manual", value: manualCount, color: "rgba(255,255,255,0.4)" },
          ].map(stat => (
            <div key={stat.label} style={{
              padding: "10px 20px", borderRadius: "12px",
              background: "rgba(22,22,31,0.8)", border: `1px solid ${stat.color}33`,
              display: "flex", flexDirection: "column", alignItems: "center", gap: "2px"
            }}>
              <span style={{ fontSize: "22px", fontWeight: 900, color: stat.color }}>{stat.value}</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Auto-Apply Engine Banner */}
        {autoCount > 0 && (
          <div style={{
            marginBottom: "28px", padding: "16px 20px", borderRadius: "16px",
            background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.25)",
            display: "flex", alignItems: "center", gap: "14px"
          }}>
            <span style={{ fontSize: "22px" }}>⚙️</span>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#00d4ff", letterSpacing: "0.06em", marginBottom: "2px" }}>
                AUTO-APPLY ENGINE ACTIVE
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>
                {autoCount} modifier{autoCount !== 1 ? "s" : ""} will fire automatically when their trigger conditions are met.
                Manual modifiers require the host to apply them.
              </div>
            </div>
            <div style={{
              marginLeft: "auto", padding: "6px 14px", borderRadius: "8px",
              background: "rgba(0,212,255,0.15)", color: "#00d4ff",
              fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", whiteSpace: "nowrap"
            }}>
              {autoCount} ACTIVE
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div style={{ display: "flex", gap: "24px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "32px" }}>
          <button
            onClick={() => setActiveTab("upgrades")}
            style={{
              padding: "12px 8px", background: "none", border: "none",
              color: activeTab === "upgrades" ? "#4f8ef7" : "rgba(255,255,255,0.3)",
              fontSize: "15px", fontWeight: 700, cursor: "pointer",
              borderBottom: activeTab === "upgrades" ? "2px solid #4f8ef7" : "2px solid transparent",
            }}
          >Marketplace Upgrades</button>
          <button
            onClick={() => setActiveTab("taxes")}
            style={{
              padding: "12px 8px", background: "none", border: "none",
              color: activeTab === "taxes" ? "#ef4444" : "rgba(255,255,255,0.3)",
              fontSize: "15px", fontWeight: 700, cursor: "pointer",
              borderBottom: activeTab === "taxes" ? "2px solid #ef4444" : "2px solid transparent",
            }}
          >PFLX Taxes & Fines</button>
        </div>

        {/* Modifier Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "20px" }}>
          {currentList.map(mod => (
            <div key={mod.id} style={{
              background: "rgba(22,22,31,0.6)",
              border: mod.autoApply
                ? "1px solid rgba(0,212,255,0.3)"
                : "1px solid rgba(255,255,255,0.06)",
              borderRadius: "20px", padding: "20px",
              display: "flex", flexDirection: "column", gap: "14px"
            }}>
              {/* Card Top Row */}
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{
                  width: "60px", height: "60px", borderRadius: "14px",
                  background: "rgba(255,255,255,0.05)", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: "26px",
                  overflow: "hidden", flexShrink: 0
                }}>
                  {mod.image
                    ? <img src={mod.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : mod.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#f0f0ff" }}>{mod.name}</h3>
                    {/* AUTO / MANUAL badge */}
                    <span style={{
                      padding: "3px 9px", borderRadius: "6px", fontSize: "10px", fontWeight: 800,
                      letterSpacing: "0.06em", flexShrink: 0, marginLeft: "8px",
                      background: mod.autoApply ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.07)",
                      color: mod.autoApply ? "#00d4ff" : "rgba(255,255,255,0.35)",
                      border: mod.autoApply ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(255,255,255,0.1)"
                    }}>
                      {mod.autoApply ? "⚡ AUTO" : "✋ MANUAL"}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
                    {mod.description}
                  </p>
                </div>
              </div>

              {/* Auto-Apply Info Panel */}
              {mod.autoApply && (mod.triggerEvent || mod.effectType) && (
                <div style={{
                  padding: "12px 14px", borderRadius: "12px",
                  background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)",
                  display: "flex", flexWrap: "wrap", gap: "10px"
                }}>
                  {mod.triggerEvent && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(0,212,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Trigger</span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#00d4ff" }}>{triggerLabel(mod.triggerEvent)}</span>
                    </div>
                  )}
                  {mod.triggerEvent && mod.effectType && (
                    <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "18px", alignSelf: "center" }}>›</div>
                  )}
                  {mod.effectType && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(124,58,237,0.6)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Effect</span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#a78bfa" }}>
                        {effectLabel(mod.effectType)}{mod.effectValue != null ? ` · ${mod.effectValue}` : ""}
                      </span>
                    </div>
                  )}
                  {mod.scope && (
                    <>
                      <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "18px", alignSelf: "center" }}>›</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Scope</span>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>{mod.scope}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Cost & Duration Row */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {mod.costXcoin > 0 && (
                  <span style={{ padding: "4px 10px", borderRadius: "8px", background: "rgba(79,142,247,0.1)", color: "#4f8ef7", fontSize: "11px", fontWeight: 700 }}>
                    ⚡ {mod.costXcoin} XP
                  </span>
                )}
                {mod.costBadge > 0 && (
                  <span style={{ padding: "4px 10px", borderRadius: "8px", background: "rgba(245,200,66,0.1)", color: "#f5c842", fontSize: "11px", fontWeight: 700 }}>
                    🪙 {mod.costBadge} XC
                  </span>
                )}
                <span style={{ padding: "4px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: 700 }}>
                  🕐 {mod.duration}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setEditingMod(mod)}
                  style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                >Edit</button>
                <button
                  onClick={() => deleteModifier(mod.id)}
                  style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                >Delete</button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Edit / Create Modal ────────────────────────────────────── */}
        {editingMod && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000, padding: "20px"
          }}>
            <div style={{
              background: "#16161f", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "28px", padding: "32px", width: "100%",
              maxWidth: "540px", maxHeight: "90vh", overflow: "auto"
            }}>
              <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 900, color: "#f0f0ff" }}>
                {editingMod.type === "upgrade" ? "✨ Edit Upgrade" : "⚡ Edit Tax / Fine"}
              </h2>

              {/* Icon / Image picker */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "80px", height: "80px", borderRadius: "16px",
                    background: "rgba(255,255,255,0.05)", border: "2px dashed rgba(255,255,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "32px", cursor: "pointer", overflow: "hidden", position: "relative"
                  }}
                >
                  {editingMod.image
                    ? <img src={editingMod.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : editingMod.icon}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "rgba(0,0,0,0.7)", fontSize: "9px",
                    color: "white", textAlign: "center", padding: "4px"
                  }}>UPLOAD</div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: "none" }} />
              </div>

              <form onSubmit={saveModifier} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

                {/* Emoji + Name row */}
                <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Emoji</label>
                    <input
                      value={editingMod.icon ?? ""}
                      onChange={e => setEditingMod({ ...editingMod, icon: e.target.value })}
                      className="input-field"
                      style={{ textAlign: "center", fontSize: "22px" }}
                      placeholder="✨"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Name</label>
                    <input required value={editingMod.name} onChange={e => setEditingMod({ ...editingMod, name: e.target.value })} className="input-field" placeholder="e.g. Late Penalty" />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Description</label>
                  <textarea required value={editingMod.description} onChange={e => setEditingMod({ ...editingMod, description: e.target.value })} className="input-field" style={{ minHeight: "72px" }} placeholder="What does this modifier do?" />
                </div>

                {/* XP Cost + XC Cost */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>XP {editingMod.type === "tax" ? "Fine" : "Cost"}</label>
                    <input type="number" min={0} value={editingMod.costXcoin} onChange={e => setEditingMod({ ...editingMod, costXcoin: parseInt(e.target.value) || 0 })} className="input-field" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>X-Coin {editingMod.type === "tax" ? "Fine" : "Cost"}</label>
                    <input type="number" min={0} value={editingMod.costBadge} onChange={e => setEditingMod({ ...editingMod, costBadge: parseInt(e.target.value) || 0 })} className="input-field" />
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Duration / Expiry</label>
                  <select value={editingMod.duration} onChange={e => setEditingMod({ ...editingMod, duration: e.target.value })} className="input-field">
                    <option value="single-use">Single Use</option>
                    <option value="immediate">Immediate (One-Time Charge)</option>
                    <option value="24h">24 Hours</option>
                    <option value="1w">1 Week</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>

                {/* ── Auto-Apply Engine Section ── */}
                <div style={{
                  padding: "18px", borderRadius: "16px",
                  background: "rgba(0,212,255,0.04)",
                  border: `1px solid ${editingMod.autoApply ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`
                }}>
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>
                      ⚙️ Auto-Apply Engine
                    </div>

                    {/* Toggle */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: editingMod.autoApply ? "#00d4ff" : "rgba(255,255,255,0.6)" }}>
                          {editingMod.autoApply ? "Auto-Apply ON" : "Auto-Apply OFF"}
                        </div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
                          {editingMod.autoApply ? "Fires automatically when trigger fires" : "Host must apply manually"}
                        </div>
                      </div>
                      {/* CSS Toggle Switch */}
                      <div
                        onClick={() => setEditingMod({ ...editingMod, autoApply: !editingMod.autoApply })}
                        style={{
                          width: "50px", height: "26px", borderRadius: "13px", cursor: "pointer",
                          background: editingMod.autoApply ? "#00d4ff" : "rgba(255,255,255,0.1)",
                          position: "relative", transition: "background 0.2s", flexShrink: 0
                        }}
                      >
                        <div style={{
                          position: "absolute", top: "3px",
                          left: editingMod.autoApply ? "27px" : "3px",
                          width: "20px", height: "20px", borderRadius: "50%",
                          background: "white", transition: "left 0.2s",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.4)"
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Conditional: trigger + effect fields */}
                  {editingMod.autoApply && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "14px", borderTop: "1px solid rgba(0,212,255,0.12)" }}>

                      {/* Trigger Event */}
                      <div>
                        <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(0,212,255,0.6)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Trigger Event</label>
                        <select
                          value={editingMod.triggerEvent ?? "manual"}
                          onChange={e => setEditingMod({ ...editingMod, triggerEvent: e.target.value as ModifierTrigger })}
                          className="input-field"
                          style={{ borderColor: "rgba(0,212,255,0.2)" }}
                        >
                          {TRIGGER_OPTIONS.filter(t => t !== "manual").map(t => (
                            <option key={t} value={t}>{triggerLabel(t)}</option>
                          ))}
                        </select>
                      </div>

                      {/* Effect Type */}
                      <div>
                        <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(167,139,250,0.7)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Effect Type</label>
                        <select
                          value={editingMod.effectType ?? ""}
                          onChange={e => setEditingMod({ ...editingMod, effectType: e.target.value as ModifierEffect })}
                          className="input-field"
                          style={{ borderColor: "rgba(167,139,250,0.2)" }}
                        >
                          <option value="">— Choose Effect —</option>
                          {EFFECT_OPTIONS.map(ef => (
                            <option key={ef} value={ef}>{effectLabel(ef)}</option>
                          ))}
                        </select>
                      </div>

                      {/* Effect Value */}
                      {editingMod.effectType && (
                        <div>
                          <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(167,139,250,0.7)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {effectValueLabel(editingMod.effectType)}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={editingMod.effectType === "xc_multiply" ? "0.1" : "1"}
                            value={editingMod.effectValue ?? ""}
                            onChange={e => setEditingMod({ ...editingMod, effectValue: parseFloat(e.target.value) || 0 })}
                            className="input-field"
                            placeholder="0"
                            style={{ borderColor: "rgba(167,139,250,0.2)" }}
                          />
                        </div>
                      )}

                      {/* Scope */}
                      <div>
                        <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Scope</label>
                        <select
                          value={editingMod.scope ?? "all"}
                          onChange={e => setEditingMod({ ...editingMod, scope: e.target.value as "task" | "job" | "checkpoint" | "all" })}
                          className="input-field"
                        >
                          <option value="all">All (Tasks, Jobs & Checkpoints)</option>
                          <option value="task">Tasks Only</option>
                          <option value="job">Jobs Only</option>
                          <option value="checkpoint">Checkpoints Only</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save / Cancel */}
                <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                  <button type="button" onClick={() => setEditingMod(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Modifier</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
