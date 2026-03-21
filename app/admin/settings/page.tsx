"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import { User, mockPflxRanks, PFLXRank, mockGamePeriods, GamePeriod, isHostUser, COIN_CATEGORIES,
} from "../../lib/data";
import { getSoundSettings, saveSoundSettings, SoundSettings, playClick, playNav, playSuccess, playReward, playAlert, playError } from "../../lib/sounds";

export default function AdminSettings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"seasons" | "ranks" | "sound">("seasons");
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(getSoundSettings());

  const [ranks, setRanks] = useState<PFLXRank[]>(mockPflxRanks);
  const [periods, setPeriods] = useState<GamePeriod[]>(mockGamePeriods);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const periodFileInputRef = useRef<HTMLInputElement>(null);
  const [editingRank, setEditingRank] = useState<PFLXRank | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<GamePeriod | null>(null);
  const [newSeasonTitle, setNewSeasonTitle] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pflx_user");
      if (!stored) { router.push("/"); return; }
      const u = JSON.parse(stored) as User;
      if (!isHostUser(u)) { router.push("/player"); return; }
      setUser(u);
    } catch {
      localStorage.removeItem("pflx_user");
      router.push("/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveRank = (updatedRank: PFLXRank) => {
    const updated = ranks.map(r => r.level === updatedRank.level ? updatedRank : r);
    setRanks(updated);
    const rankIndex = mockPflxRanks.findIndex(r => r.level === updatedRank.level);
    if (rankIndex >= 0) mockPflxRanks[rankIndex] = updatedRank;
    showToast("Rank updated successfully!", "success");
    setEditingRank(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !editingRank) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setEditingRank({ ...editingRank, image: base64, icon: undefined });
    };
    reader.readAsDataURL(file);
  };

  const handlePeriodImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !editingPeriod) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setEditingPeriod({ ...editingPeriod, image: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleSavePeriod = (updatedPeriod: GamePeriod) => {
    const updated = periods.map(p => p.id === updatedPeriod.id ? updatedPeriod : p);
    setPeriods(updated);
    const index = mockGamePeriods.findIndex(p => p.id === updatedPeriod.id);
    if (index >= 0) mockGamePeriods[index] = updatedPeriod;
    showToast("Season updated!", "success");
    setEditingPeriod(null);
  };

  const handleAddSeason = () => {
    if (!newSeasonTitle.trim()) return;
    const newSeason: GamePeriod = {
      id: `s-${Date.now()}`,
      type: "season",
      title: newSeasonTitle.trim(),
      isActive: false,
    };
    const updated = [...periods, newSeason];
    setPeriods(updated);
    mockGamePeriods.push(newSeason);
    setNewSeasonTitle("");
    showToast("Season created!", "success");
  };

  const toggleSeasonActive = (id: string) => {
    const updated = periods.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p);
    setPeriods(updated);
    const index = mockGamePeriods.findIndex(p => p.id === id);
    if (index >= 0) mockGamePeriods[index].isActive = !mockGamePeriods[index].isActive;
    showToast("Season status updated.", "success");
  };

  const deleteSeason = (id: string) => {
    setPeriods(periods.filter(p => p.id !== id));
    const index = mockGamePeriods.findIndex(p => p.id === id);
    if (index >= 0) mockGamePeriods.splice(index, 1);
    showToast("Season deleted.", "success");
  };

    if (!user) return (
    <div style={{ minHeight: "100vh", background: "#06090d", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#00d4ff", fontSize: "14px", letterSpacing: "0.1em", fontFamily: "monospace" }}>LOADING...</div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <SideNav user={user} />

      <main style={{ flex: 1, padding: "32px", overflow: "auto" }}>
        {toast && (
          <div style={{
            position: "fixed", top: "24px", right: "24px", zIndex: 9999,
            padding: "12px 20px", borderRadius: "12px",
            background: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: toast.type === "success" ? "#22c55e" : "#ef4444",
            fontSize: "13px", fontWeight: 600, backdropFilter: "blur(10px)"
          }}>{toast.msg}</div>
        )}

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))"
          }}>⚙️ SETTINGS</h1>
          <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>[ MANAGE GAME SEASONS, RANKINGS & SOUND ]</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "32px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "16px" }}>
          {(["seasons", "ranks", "sound"] as const).map(tab => {
            const tabColors: Record<string, string> = { seasons: "#f5c842", ranks: "#4f8ef7", sound: "#22c55e" };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => { playNav && playNav(); setActiveTab(tab); }}
                style={{
                  background: isActive ? `${tabColors[tab]}18` : "transparent",
                  color: isActive ? tabColors[tab] : "rgba(255,255,255,0.4)",
                  border: "none", padding: "10px 20px", borderRadius: "10px",
                  fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                  borderBottom: isActive ? `2px solid ${tabColors[tab]}` : "2px solid transparent",
                }}
              >
                {tab === "seasons" ? "🗓️ Seasons" : tab === "ranks" ? "⚡ Evolution Rankings" : "🔊 Sound Settings"}
              </button>
            );
          })}
        </div>

        {/* ── SEASONS TAB ── */}
        {activeTab === "seasons" && (
          <div>
            {/* Info callout */}
            <div style={{
              background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.18)",
              borderRadius: "12px", padding: "14px 18px", marginBottom: "28px",
              display: "flex", alignItems: "flex-start", gap: "12px"
            }}>
              <span style={{ fontSize: "18px", lineHeight: 1 }}>💡</span>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "#f5c842" }}>
                  Seasons are the big-picture containers for your game arc.
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                  Each Season (e.g. "Season 1: Origins") holds multiple <strong style={{ color: "rgba(255,255,255,0.7)" }}>Checkpoints</strong> — the task sprints players complete.
                  To create and manage Checkpoints and their tasks, go to{" "}
                  <button
                    onClick={() => router.push("/admin/task-management")}
                    style={{ background: "none", border: "none", color: "#f5c842", fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, fontSize: "13px" }}
                  >
                    Task Management →
                  </button>
                </p>
              </div>
            </div>

            {/* Create new season */}
            <div style={{
              background: "rgba(22,22,31,0.6)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px", padding: "24px", marginBottom: "28px"
            }}>
              <h2 style={{ margin: "0 0 16px", fontSize: "17px", fontWeight: 700, color: "#f0f0ff" }}>Create New Season</h2>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder='e.g. "Season 2: The Ascent"'
                  value={newSeasonTitle}
                  onChange={e => setNewSeasonTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddSeason()}
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: "10px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#f0f0ff", fontSize: "14px", outline: "none"
                  }}
                />
                <button
                  onClick={handleAddSeason}
                  style={{
                    padding: "12px 28px", borderRadius: "10px", background: "#f5c842",
                    color: "black", fontSize: "14px", fontWeight: 700, border: "none", cursor: "pointer"
                  }}
                >
                  + Create
                </button>
              </div>
            </div>

            {/* Seasons list */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {periods.length === 0 && (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px", textAlign: "center", padding: "32px 0" }}>
                  No seasons yet — create one above.
                </p>
              )}
              {periods.map(p => (
                <div key={p.id} style={{
                  background: "rgba(22,22,31,0.9)",
                  border: p.isActive ? "1px solid rgba(245,200,66,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "14px", padding: "18px 20px",
                  display: "flex", alignItems: "center", gap: "14px"
                }}>
                  {/* Season image / icon */}
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "10px", flexShrink: 0,
                    background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "22px", overflow: "hidden"
                  }}>
                    {p.image
                      ? <img src={p.image} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : "🗓️"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#f0f0ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: p.isActive ? "#f5c842" : "rgba(255,255,255,0.35)" }}>
                      {p.isActive ? "● Active" : "○ Inactive"}
                      {p.durationString && <span style={{ marginLeft: "8px", color: "rgba(255,255,255,0.3)" }}>{p.durationString}</span>}
                      {p.startDate && <span style={{ marginLeft: "8px", color: "rgba(255,255,255,0.3)" }}>{p.startDate} → {p.endDate}</span>}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    <button
                      onClick={() => setEditingPeriod({ ...p })}
                      style={{ padding: "6px 12px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                    >✏️ Edit</button>
                    <button
                      onClick={() => toggleSeasonActive(p.id)}
                      style={{
                        padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", border: "none",
                        background: p.isActive ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                        color: p.isActive ? "#ef4444" : "#22c55e"
                      }}
                    >{p.isActive ? "Deactivate" : "Activate"}</button>
                    <button
                      onClick={() => deleteSeason(p.id)}
                      style={{ padding: "6px 10px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)", fontSize: "12px", cursor: "pointer" }}
                    >🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SOUND TAB ── */}
        {activeTab === "sound" && (
          <div style={{ maxWidth: "600px" }}>
            <p style={{ margin: "0 0 28px", color: "rgba(255,255,255,0.5)", fontSize: "14px", lineHeight: 1.6 }}>
              Configure audio feedback for the PFLX HUD interface. All sounds are synthesized in-browser — no external files required.
            </p>

            {/* Master enable */}
            <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "16px", padding: "22px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: "#f0f0ff" }}>Master Sound</p>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Enable or disable all audio system-wide</p>
              </div>
              <button
                onClick={() => {
                  const updated = { ...soundSettings, enabled: !soundSettings.enabled };
                  setSoundSettings(updated);
                  saveSoundSettings(updated);
                  if (updated.enabled) playSuccess();
                }}
                style={{
                  width: "60px", height: "32px", borderRadius: "16px", border: "none", cursor: "pointer",
                  background: soundSettings.enabled ? "#22c55e" : "rgba(255,255,255,0.1)",
                  position: "relative", transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute", top: "4px",
                  left: soundSettings.enabled ? "32px" : "4px",
                  width: "24px", height: "24px", borderRadius: "12px",
                  background: "white", transition: "left 0.2s",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                }} />
              </button>
            </div>

            {/* Volume slider */}
            <div style={{ background: "rgba(10,10,26,0.9)", border: "1px solid rgba(79,142,247,0.12)", borderRadius: "16px", padding: "22px", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 700, color: "#f0f0ff" }}>🔊 Volume</p>
                  <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Master volume level</p>
                </div>
                <span style={{ fontSize: "18px", fontWeight: 800, color: "#4f8ef7", minWidth: "48px", textAlign: "right" }}>
                  {Math.round(soundSettings.volume * 100)}%
                </span>
              </div>
              <input
                type="range" min="0" max="1" step="0.05"
                value={soundSettings.volume}
                onChange={e => {
                  const updated = { ...soundSettings, volume: parseFloat(e.target.value) };
                  setSoundSettings(updated);
                  saveSoundSettings(updated);
                }}
                style={{ width: "100%", accentColor: "#4f8ef7", cursor: "pointer" }}
              />
            </div>

            {/* Individual toggles */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              {([
                { key: "clicks",  label: "UI Clicks & Navigation",     desc: "Button taps, tab switches, modal opens",      icon: "🖱️", color: "#4f8ef7", preview: () => playClick() },
                { key: "rewards", label: "Badge & XC Award Sounds",     desc: "Success chimes and reward fanfares",          icon: "🏅", color: "#f5c842", preview: () => playReward() },
                { key: "alerts",  label: "Alert & Error Tones",         desc: "Warning pings and error buzz sounds",         icon: "⚠️", color: "#ef4444", preview: () => playAlert() },
                { key: "ambient", label: "Ambient HUD Hum",             desc: "Low-frequency background atmosphere",         icon: "🌐", color: "#22c55e", preview: () => {} },
              ] as const).map(({ key, label, desc, icon, color, preview }) => {
                const isOn = soundSettings[key as keyof SoundSettings] as boolean;
                return (
                  <div key={key} style={{ background: "rgba(10,10,26,0.9)", border: `1px solid ${isOn ? color + "25" : "rgba(255,255,255,0.06)"}`, borderRadius: "14px", padding: "18px", display: "flex", alignItems: "center", gap: "16px", transition: "border-color 0.2s" }}>
                    <span style={{ fontSize: "24px", flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: isOn ? "#f0f0ff" : "rgba(255,255,255,0.45)" }}>{label}</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>{desc}</p>
                    </div>
                    <button
                      onClick={() => { preview(); }}
                      style={{ padding: "5px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                    >
                      ▶ Test
                    </button>
                    <button
                      onClick={() => {
                        const updated = { ...soundSettings, [key]: !isOn };
                        setSoundSettings(updated);
                        saveSoundSettings(updated);
                      }}
                      style={{
                        width: "52px", height: "28px", borderRadius: "14px", border: "none", cursor: "pointer", flexShrink: 0,
                        background: isOn ? color : "rgba(255,255,255,0.08)",
                        position: "relative", transition: "background 0.2s",
                      }}
                    >
                      <div style={{
                        position: "absolute", top: "3px",
                        left: isOn ? "26px" : "3px",
                        width: "22px", height: "22px", borderRadius: "11px",
                        background: "white", transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Test all button */}
            <button
              onClick={() => { playSuccess(); setTimeout(playReward, 700); }}
              style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, rgba(79,142,247,0.2), rgba(139,92,246,0.2))", border: "1px solid rgba(79,142,247,0.3)", borderRadius: "12px", color: "#4f8ef7", fontWeight: 800, fontSize: "14px", cursor: "pointer", letterSpacing: "0.05em" }}
            >
              🎵 Test Sound System
            </button>
          </div>
        )}

        {/* ── RANKS TAB ── */}
        {activeTab === "ranks" && (
          <div>
            <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>
              Edit the criteria for each Evolution Rank. Players are promoted when they meet the XC threshold, checkpoint count, and badge requirements.
            </p>
            {/* Tier group headers */}
            {[
              { label: "🥉 Foundation", levels: [1, 2, 3] },
              { label: "🥈 Production", levels: [4, 5] },
              { label: "🥇 Leadership", levels: [6, 7, 8] },
              { label: "🏆 Executive", levels: [9, 10] },
            ].map(group => (
              <div key={group.label} style={{ marginBottom: "32px" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{group.label}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                  {ranks.filter(r => group.levels.includes(r.level)).map(r => {
                    const badgeColors: Record<string, string> = { Primary: "#00d4ff", Premium: "#a78bfa", Executive: "#f5c842", Signature: "#ef4444" };
                    return (
                      <div key={r.level} style={{
                        background: "rgba(22,22,31,0.6)", border: "1px solid rgba(79,142,247,0.15)",
                        borderRadius: "16px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#4f8ef7", background: "rgba(79,142,247,0.1)", padding: "3px 8px", borderRadius: "6px" }}>TIER {r.level}</span>
                          <button onClick={() => setEditingRank({ ...r })} style={{ background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.2)", color: "#4f8ef7", cursor: "pointer", fontSize: "11px", fontWeight: 700, borderRadius: "6px", padding: "4px 10px" }}>✏️ Edit</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <div style={{ width: "56px", height: "56px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", overflow: "hidden", flexShrink: 0 }}>
                            {r.image ? <img src={r.image} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (r.icon || "🛡️")}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 800, color: "#f0f0ff" }}>{r.name}</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#f5c842", background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)", padding: "2px 7px", borderRadius: "5px" }}>⚡ Unlock: {r.xcoinUnlock.toLocaleString()} XC</span>
                              {r.xcoinMaintain > 0 && <span style={{ fontSize: "11px", fontWeight: 700, color: "#00d4ff", background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", padding: "2px 7px", borderRadius: "5px" }}>🔒 Maintain: {r.xcoinMaintain.toLocaleString()} XC</span>}
                              {r.checkpointsRequired > 0 && <span style={{ fontSize: "11px", fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)", padding: "2px 7px", borderRadius: "5px" }}>📍 {r.checkpointsRequired} Checkpoints</span>}
                            </div>
                            {r.badgeTypeRequirements.length > 0 && (
                              <div style={{ display: "flex", gap: "4px", marginTop: "5px", flexWrap: "wrap" }}>
                                {r.badgeTypeRequirements.map(bt => (
                                  <span key={bt} style={{ fontSize: "10px", fontWeight: 700, color: badgeColors[bt] || "white", background: `${badgeColors[bt] || "rgba(255,255,255,0.1)"}15`, border: `1px solid ${badgeColors[bt] || "rgba(255,255,255,0.2)"}40`, padding: "1px 6px", borderRadius: "4px" }}>{bt}</span>
                                ))}
                              </div>
                            )}
                            {r.specificBadgeRequirements && r.specificBadgeRequirements.length > 0 && (
                              <p style={{ margin: "5px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>Req: {r.specificBadgeRequirements.join(", ")}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── RANK EDIT MODAL ── */}
      {editingRank && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "24px" }}>
          <div style={{ background: "#12121a", border: "1px solid rgba(79,142,247,0.3)", borderRadius: "20px", padding: "28px", width: "520px", maxWidth: "95vw", boxShadow: "0 0 60px rgba(79,142,247,0.15)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#f0f0ff" }}>Edit Tier {editingRank.level}: {editingRank.name}</h2>
                <p style={{ margin: "3px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Evolution Rankings · Level {editingRank.level} of 10</p>
              </div>
              <button onClick={() => setEditingRank(null)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px", lineHeight: 1 }}>×</button>
            </div>

            {/* Image + Name + Icon row */}
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "18px" }}>
              <div onClick={() => fileInputRef.current?.click()} style={{ width: "76px", height: "76px", flexShrink: 0, borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px", cursor: "pointer", overflow: "hidden", position: "relative" }}>
                {editingRank.image ? <img src={editingRank.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (editingRank.icon || "🖼️")}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.75)", color: "white", fontSize: "9px", textAlign: "center", padding: "3px 0", fontWeight: 700 }}>📷 UPLOAD</div>
              </div>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 72px", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Rank Name</label>
                  <input type="text" value={editingRank.name} onChange={e => setEditingRank({ ...editingRank, name: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: "14px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Icon</label>
                  <input type="text" value={editingRank.icon || ""} onChange={e => setEditingRank({ ...editingRank, icon: e.target.value })} placeholder="🛡️" style={{ width: "100%", padding: "9px 8px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: "22px", textAlign: "center", boxSizing: "border-box" }} />
                </div>
              </div>
            </div>

            {/* XC Thresholds */}
            <div style={{ marginBottom: "16px", padding: "14px", borderRadius: "10px", background: "rgba(245,200,66,0.04)", border: "1px solid rgba(245,200,66,0.12)" }}>
              <label style={{ display: "block", marginBottom: "10px", fontSize: "10px", fontWeight: 700, color: "#f5c842", textTransform: "uppercase", letterSpacing: "0.06em" }}>⚡ XC Thresholds</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Unlock (minimum to reach)</label>
                  <input type="number" value={editingRank.xcoinUnlock} onChange={e => setEditingRank({ ...editingRank, xcoinUnlock: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", borderRadius: "7px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(245,200,66,0.25)", color: "white", fontSize: "13px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Maintain (minimum to keep)</label>
                  <input type="number" value={editingRank.xcoinMaintain} onChange={e => setEditingRank({ ...editingRank, xcoinMaintain: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", borderRadius: "7px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(0,212,255,0.2)", color: "white", fontSize: "13px", boxSizing: "border-box" }} />
                </div>
              </div>
            </div>

            {/* Checkpoints */}
            <div style={{ marginBottom: "16px", padding: "14px", borderRadius: "10px", background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.12)" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "10px", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em" }}>📍 Checkpoints Required</label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <input type="number" min="0" max="25" value={editingRank.checkpointsRequired} onChange={e => setEditingRank({ ...editingRank, checkpointsRequired: Number(e.target.value) })} style={{ width: "90px", padding: "8px 12px", borderRadius: "7px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(167,139,250,0.25)", color: "white", fontSize: "16px", fontWeight: 700, textAlign: "center" }} />
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>checkpoints completed to qualify for this tier</span>
              </div>
            </div>

            {/* Badge Type Requirements */}
            <div style={{ marginBottom: "16px", padding: "14px", borderRadius: "10px", background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.1)" }}>
              <label style={{ display: "block", marginBottom: "10px", fontSize: "10px", fontWeight: 700, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.06em" }}>🏅 Badge Type Requirements</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {(["Primary", "Premium", "Executive", "Signature"] as const).map(bt => {
                  const colors: Record<string, string> = { Primary: "#00d4ff", Premium: "#a78bfa", Executive: "#f5c842", Signature: "#ef4444" };
                  const active = (editingRank.badgeTypeRequirements || []).includes(bt);
                  return (
                    <button key={bt} onClick={() => {
                      const curr = editingRank.badgeTypeRequirements || [];
                      const next = active ? curr.filter(x => x !== bt) : [...curr, bt];
                      setEditingRank({ ...editingRank, badgeTypeRequirements: next });
                    }} style={{
                      padding: "7px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                      background: active ? `${colors[bt]}1a` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? colors[bt] + "80" : "rgba(255,255,255,0.1)"}`,
                      color: active ? colors[bt] : "rgba(255,255,255,0.3)",
                      transition: "all 0.15s"
                    }}>
                      {active ? "✓ " : ""}{bt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Specific Badges — multi-select with grouped dropdown */}
            <div style={{ marginBottom: "22px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "10px", fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.06em" }}>🎖️ Specific Badge Requirements</label>

              {/* Selected pills */}
              {(editingRank.specificBadgeRequirements || []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                  {(editingRank.specificBadgeRequirements || []).map(badge => (
                    <span key={badge} style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      padding: "4px 10px", borderRadius: "20px",
                      background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
                      color: "#22c55e", fontSize: "11px", fontWeight: 700
                    }}>
                      {badge}
                      <span
                        onClick={() => setEditingRank({ ...editingRank, specificBadgeRequirements: (editingRank.specificBadgeRequirements || []).filter(b => b !== badge) })}
                        style={{ cursor: "pointer", opacity: 0.6, fontSize: "12px", lineHeight: 1, marginLeft: "2px" }}
                        title="Remove"
                      >×</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Grouped dropdown */}
              <select
                value=""
                onChange={e => {
                  const val = e.target.value;
                  if (!val) return;
                  const current = editingRank.specificBadgeRequirements || [];
                  if (!current.includes(val)) {
                    setEditingRank({ ...editingRank, specificBadgeRequirements: [...current, val] });
                  }
                }}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: "8px",
                  background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.2)",
                  color: (editingRank.specificBadgeRequirements || []).length === 0 ? "rgba(255,255,255,0.35)" : "white",
                  fontSize: "12px", cursor: "pointer", boxSizing: "border-box"
                }}
              >
                <option value="">+ Add a badge requirement…</option>
                {COIN_CATEGORIES.map(cat => (
                  <optgroup key={cat.name} label={cat.name}>
                    {cat.coins.map(coin => (
                      <option
                        key={coin.name}
                        value={coin.name}
                        disabled={(editingRank.specificBadgeRequirements || []).includes(coin.name)}
                        style={{ color: (editingRank.specificBadgeRequirements || []).includes(coin.name) ? "rgba(255,255,255,0.25)" : "white" }}
                      >
                        {coin.name} · {coin.xc.toLocaleString()} XC
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p style={{ margin: "6px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>
                Select badges one at a time. Leave empty if no specific badge is required for this tier.
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setEditingRank(null)} style={{ flex: 1, padding: "11px", borderRadius: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}>Cancel</button>
              <button onClick={() => handleSaveRank(editingRank!)} style={{ flex: 2, padding: "11px", borderRadius: "10px", background: "linear-gradient(135deg, #4f8ef7, #7c3aed)", border: "none", color: "white", fontWeight: 800, cursor: "pointer", fontSize: "13px", boxShadow: "0 4px 15px rgba(79,142,247,0.3)" }}>💾 Save Rank Updates</button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: "none" }} />
          </div>
        </div>
      )}

      {/* ── SEASON EDIT MODAL ── */}
      {editingPeriod && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#16161f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "32px", width: "450px", maxWidth: "90vw" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 800, color: "#f0f0ff" }}>Edit Season</h2>
            <div style={{ marginBottom: "16px", display: "flex", gap: "16px", alignItems: "center" }}>
              <div onClick={() => periodFileInputRef.current?.click()} style={{ width: "100px", height: "80px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", cursor: "pointer", overflow: "hidden", position: "relative" }}>
                {editingPeriod.image ? <img src={editingPeriod.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🖼️"}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.7)", color: "white", fontSize: "10px", textAlign: "center", padding: "2px 0", fontWeight: 600 }}>Upload</div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", margin: "0 0 4px", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Season Title</label>
                <input type="text" value={editingPeriod.title} onChange={e => setEditingPeriod({ ...editingPeriod, title: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", margin: "0 0 4px", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Start Date</label>
                <input type="date" value={editingPeriod.startDate || ""} onChange={e => setEditingPeriod({ ...editingPeriod, startDate: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", colorScheme: "dark" }} />
              </div>
              <div>
                <label style={{ display: "block", margin: "0 0 4px", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>End Date</label>
                <input type="date" value={editingPeriod.endDate || ""} onChange={e => setEditingPeriod({ ...editingPeriod, endDate: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", colorScheme: "dark" }} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", margin: "0 0 4px", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Duration Label (Optional)</label>
                <input type="text" placeholder='e.g. "1st Semester (4 Months)"' value={editingPeriod.durationString || ""} onChange={e => setEditingPeriod({ ...editingPeriod, durationString: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setEditingPeriod(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "white", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleSavePeriod(editingPeriod)} style={{ flex: 1, padding: "12px", borderRadius: "8px", background: "#f5c842", border: "none", color: "black", fontWeight: 700, cursor: "pointer" }}>Save Updates</button>
            </div>
            <input type="file" ref={periodFileInputRef} onChange={handlePeriodImageUpload} accept="image/*" style={{ display: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
}
