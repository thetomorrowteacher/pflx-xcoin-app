"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import {
  User, mockUsers, isHostUser,
  StartupStudio, mockStartupStudios,
  mockStudioInvestments, getCurrentRank,
  getStudioMaxStakePercent,
} from "../../lib/data";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avatarInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ModalMode = "members" | "reassign" | "tax" | null;

interface ModalState {
  mode: ModalMode;
  studioId: string;
}

export default function StudiosPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [studios, setStudios] = useState<StartupStudio[]>([...mockStartupStudios]);
  const [players, setPlayers] = useState<User[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);

  // Reassign state
  const [reassignPlayerId, setReassignPlayerId] = useState<string>("");
  const [reassignTargetStudioId, setReassignTargetStudioId] = useState<string>("");

  // Tax override state
  const [taxRateInput, setTaxRateInput] = useState<string>("");

  // Hover states
  const [hoveredStudio, setHoveredStudio] = useState<string | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const user: User = JSON.parse(stored);
    if (!isHostUser(user)) { router.push("/player"); return; }
    setCurrentUser(user);
    setPlayers(mockUsers.filter(u => u.role === "player" && !u.isHost));
  }, [router]);

  if (!currentUser) return null;

  // ── Derived helpers ──────────────────────────────────────────────────────
  const getStudioMembers = (studioId: string) =>
    players.filter(p => p.studioId === studioId);

  const getActiveStudio = () =>
    modal ? studios.find(s => s.id === modal.studioId) ?? null : null;

  const totalXCInSystem = studios.reduce((sum, s) => sum + s.xcPool, 0);
  const totalMembers = players.filter(p => p.studioId).length;
  const unassigned = players.filter(p => !p.studioId).length;

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleReassign = () => {
    if (!reassignPlayerId || !reassignTargetStudioId) return;
    const playerIdx = mockUsers.findIndex(u => u.id === reassignPlayerId);
    if (playerIdx === -1) return;
    const oldStudioId = mockUsers[playerIdx].studioId;

    // Remove from old studio members
    if (oldStudioId) {
      const oldStudio = mockStartupStudios.find(s => s.id === oldStudioId);
      if (oldStudio) oldStudio.members = oldStudio.members.filter(id => id !== reassignPlayerId);
    }
    // Add to new studio members
    const newStudio = mockStartupStudios.find(s => s.id === reassignTargetStudioId);
    if (newStudio && !newStudio.members.includes(reassignPlayerId)) {
      newStudio.members.push(reassignPlayerId);
    }

    // Update player
    mockUsers[playerIdx].studioId = reassignTargetStudioId;

    // Sync localStorage if this is the current logged-in player
    const stored = localStorage.getItem("pflx_user");
    if (stored) {
      const lu: User = JSON.parse(stored);
      if (lu.id === reassignPlayerId) {
        localStorage.setItem("pflx_user", JSON.stringify({ ...lu, studioId: reassignTargetStudioId }));
      }
    }

    setStudios([...mockStartupStudios]);
    setPlayers(mockUsers.filter(u => u.role === "player" && !u.isHost));
    setModal(null);
    setReassignPlayerId("");
    setReassignTargetStudioId("");
  };

  const handleTaxUpdate = () => {
    const rate = parseFloat(taxRateInput);
    if (isNaN(rate) || rate < 0 || rate > 50) return;
    const studio = mockStartupStudios.find(s => s.id === modal?.studioId);
    if (studio) {
      studio.corporateTaxRate = rate / 100;
      setStudios([...mockStartupStudios]);
    }
    setModal(null);
    setTaxRateInput("");
  };

  const openTaxModal = (studioId: string) => {
    const studio = studios.find(s => s.id === studioId);
    if (studio) setTaxRateInput(String(Math.round(studio.corporateTaxRate * 100)));
    setModal({ mode: "tax", studioId });
  };

  // ── Design tokens ─────────────────────────────────────────────────────────
  const BG = "#06090d";
  const CARD_BG = "rgba(8,14,20,0.97)";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: BG, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <SideNav user={currentUser} />

      <main style={{ flex: 1, padding: "32px", overflowY: "auto", position: "relative" }}>
        {/* Background grid */}
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: `linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: "1280px", margin: "0 auto" }}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <span style={{ fontSize: "28px" }}>🏢</span>
              <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 900, color: "#fff", letterSpacing: "0.05em" }}>
                STARTUP STUDIOS
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.03em" }}>
              Manage studio membership, XC pools, corporate tax rates, and player assignments
            </p>
          </div>

          {/* ── System Stats Row ─────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "32px" }}>
            {[
              { label: "TOTAL STUDIOS", value: "4", icon: "🏢", color: "#00d4ff" },
              { label: "ASSIGNED PLAYERS", value: String(totalMembers), icon: "👥", color: "#a78bfa" },
              { label: "UNASSIGNED", value: String(unassigned), icon: "⏳", color: "#f59e0b" },
              { label: "TOTAL XC IN POOLS", value: totalXCInSystem.toLocaleString(), icon: "⚡", color: "#4ade80" },
            ].map(stat => (
              <div key={stat.label} style={{
                background: CARD_BG,
                border: `1px solid rgba(0,212,255,0.12)`,
                borderRadius: "12px",
                padding: "16px 18px",
                display: "flex", alignItems: "center", gap: "12px",
              }}>
                <span style={{ fontSize: "22px" }}>{stat.icon}</span>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Studio Cards Grid ────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "32px" }}>
            {studios.map(studio => {
              const members = getStudioMembers(studio.id);
              const investments = mockStudioInvestments.filter(i => i.studioId === studio.id && i.status === "active");
              const totalStaked = investments.reduce((s, i) => s + i.stakeXC, 0);
              const isHovered = hoveredStudio === studio.id;

              return (
                <div
                  key={studio.id}
                  onMouseEnter={() => setHoveredStudio(studio.id)}
                  onMouseLeave={() => setHoveredStudio(null)}
                  style={{
                    background: CARD_BG,
                    border: `1px solid rgba(${studio.colorRgb},${isHovered ? "0.35" : "0.18"})`,
                    borderRadius: "16px",
                    padding: "22px",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: isHovered
                      ? `0 0 30px rgba(${studio.colorRgb},0.12), inset 0 0 20px rgba(${studio.colorRgb},0.04)`
                      : `0 0 16px rgba(${studio.colorRgb},0.06)`,
                    transition: "all 0.25s ease",
                  }}
                >
                  {/* Bracket corners */}
                  {[
                    { top: 0, left: 0, borderTop: `2px solid rgba(${studio.colorRgb},0.5)`, borderLeft: `2px solid rgba(${studio.colorRgb},0.5)` },
                    { top: 0, right: 0, borderTop: `2px solid rgba(${studio.colorRgb},0.5)`, borderRight: `2px solid rgba(${studio.colorRgb},0.5)` },
                    { bottom: 0, left: 0, borderBottom: `2px solid rgba(${studio.colorRgb},0.5)`, borderLeft: `2px solid rgba(${studio.colorRgb},0.5)` },
                    { bottom: 0, right: 0, borderBottom: `2px solid rgba(${studio.colorRgb},0.5)`, borderRight: `2px solid rgba(${studio.colorRgb},0.5)` },
                  ].map((s, i) => (
                    <div key={i} style={{ position: "absolute", width: "14px", height: "14px", ...s }} />
                  ))}

                  {/* Studio header */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
                    <div style={{
                      width: "52px", height: "52px", borderRadius: "14px", flexShrink: 0,
                      background: `rgba(${studio.colorRgb},0.15)`,
                      border: `1px solid rgba(${studio.colorRgb},0.35)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "24px",
                      boxShadow: `0 0 12px rgba(${studio.colorRgb},0.2)`,
                    }}>
                      {studio.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "2px" }}>
                        {studio.name}
                      </div>
                      <div style={{ fontSize: "11px", color: `rgba(${studio.colorRgb},0.8)`, fontStyle: "italic" }}>
                        {studio.tagline}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
                    {[
                      { label: "XC POOL", value: studio.xcPool.toLocaleString(), icon: "⚡" },
                      { label: "MEMBERS", value: String(members.length), icon: "👥" },
                      { label: "TAX RATE", value: `${Math.round(studio.corporateTaxRate * 100)}%`, icon: "🏛" },
                    ].map(stat => (
                      <div key={stat.label} style={{
                        background: `rgba(${studio.colorRgb},0.07)`,
                        border: `1px solid rgba(${studio.colorRgb},0.15)`,
                        borderRadius: "8px",
                        padding: "10px 8px",
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: "11px", marginBottom: "2px" }}>{stat.icon}</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: studio.color }}>{stat.value}</div>
                        <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.1em" }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Staking summary */}
                  <div style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    marginBottom: "16px",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.45)",
                    display: "flex", justifyContent: "space-between",
                  }}>
                    <span>Active stakes: <strong style={{ color: "rgba(255,255,255,0.7)" }}>{investments.length}</strong></span>
                    <span>Total staked: <strong style={{ color: studio.color }}>{totalStaked.toLocaleString()} XC</strong></span>
                  </div>

                  {/* Member preview */}
                  <div style={{ marginBottom: "18px" }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", marginBottom: "8px" }}>
                      MEMBERS ({members.length})
                    </div>
                    {members.length === 0 ? (
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>No members assigned yet</div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {members.slice(0, 6).map(m => (
                          <div key={m.id} title={m.brandName || m.name} style={{
                            width: "32px", height: "32px", borderRadius: "8px",
                            background: m.image ? "transparent" : `rgba(${studio.colorRgb},0.25)`,
                            border: `1px solid rgba(${studio.colorRgb},0.3)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: m.image ? "0" : "9px", fontWeight: 800, color: studio.color,
                            overflow: "hidden",
                          }}>
                            {m.image
                              ? <img src={m.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : avatarInitials(m.brandName || m.name)}
                          </div>
                        ))}
                        {members.length > 6 && (
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "8px",
                            background: "rgba(255,255,255,0.06)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)",
                          }}>+{members.length - 6}</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[
                      { label: "View Members", key: `members-${studio.id}`, onClick: () => setModal({ mode: "members", studioId: studio.id }) },
                      { label: "Reassign", key: `reassign-${studio.id}`, onClick: () => setModal({ mode: "reassign", studioId: studio.id }) },
                      { label: "Set Tax", key: `tax-${studio.id}`, onClick: () => openTaxModal(studio.id) },
                    ].map(btn => (
                      <button
                        key={btn.key}
                        onMouseEnter={() => setHoveredBtn(btn.key)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={btn.onClick}
                        style={{
                          flex: 1, padding: "8px 4px",
                          background: hoveredBtn === btn.key ? `rgba(${studio.colorRgb},0.18)` : `rgba(${studio.colorRgb},0.08)`,
                          border: `1px solid rgba(${studio.colorRgb},0.3)`,
                          borderRadius: "7px",
                          color: studio.color,
                          fontSize: "10px", fontWeight: 700,
                          letterSpacing: "0.06em", textTransform: "uppercase",
                          cursor: "pointer", transition: "all 0.15s",
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Unassigned Players ───────────────────────────────────────── */}
          {unassigned > 0 && (
            <div style={{
              background: CARD_BG,
              border: "1px solid rgba(245,158,11,0.25)",
              borderRadius: "14px",
              padding: "20px 22px",
              marginBottom: "24px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <span style={{ fontSize: "18px" }}>⚠️</span>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#f59e0b" }}>Unassigned Players ({unassigned})</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>These players haven't completed the diagnostic yet</div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {players.filter(p => !p.studioId).map(p => (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    background: "rgba(245,158,11,0.07)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: "8px",
                    padding: "6px 10px",
                  }}>
                    <div style={{
                      width: "24px", height: "24px", borderRadius: "6px",
                      background: "rgba(245,158,11,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "10px", fontWeight: 700, color: "#f59e0b",
                    }}>
                      {avatarInitials(p.brandName || p.name)}
                    </div>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>{p.brandName || p.name}</span>
                    <button
                      onClick={() => setModal({ mode: "reassign", studioId: "studio-emagination" }) || setReassignPlayerId(p.id)}
                      style={{
                        background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
                        borderRadius: "5px", color: "#f59e0b", fontSize: "9px", fontWeight: 700,
                        padding: "2px 6px", cursor: "pointer", letterSpacing: "0.08em",
                      }}
                    >
                      ASSIGN
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}
      {modal && (
        <div
          onClick={() => { setModal(null); setReassignPlayerId(""); setReassignTargetStudioId(""); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 999, backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0a1018",
              border: `1px solid rgba(${getActiveStudio()?.colorRgb ?? "0,212,255"},0.3)`,
              borderRadius: "16px", padding: "28px",
              width: "480px", maxWidth: "95vw", maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            }}
          >
            {/* Members modal */}
            {modal.mode === "members" && (() => {
              const studio = getActiveStudio()!;
              const members = getStudioMembers(studio.id);
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                    <span style={{ fontSize: "24px" }}>{studio.icon}</span>
                    <div>
                      <div style={{ fontSize: "17px", fontWeight: 800, color: studio.color }}>{studio.name}</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{members.length} member{members.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {members.length === 0 && (
                      <div style={{ textAlign: "center", padding: "24px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
                        No members assigned to this studio yet
                      </div>
                    )}
                    {members.map(m => {
                      const rank = getCurrentRank(m.totalXcoin);
                      const stakeInfo = mockStudioInvestments.find(i => i.playerId === m.id && i.studioId === studio.id && i.status === "active");
                      const maxStake = getStudioMaxStakePercent(m.rank);
                      return (
                        <div key={m.id} style={{
                          display: "flex", alignItems: "center", gap: "12px",
                          background: `rgba(${studio.colorRgb},0.06)`,
                          border: `1px solid rgba(${studio.colorRgb},0.15)`,
                          borderRadius: "10px", padding: "12px 14px",
                        }}>
                          <div style={{
                            width: "38px", height: "38px", borderRadius: "9px",
                            background: m.image ? "transparent" : `rgba(${studio.colorRgb},0.2)`,
                            border: `1px solid rgba(${studio.colorRgb},0.3)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: 700, color: studio.color,
                            overflow: "hidden", flexShrink: 0,
                          }}>
                            {m.image
                              ? <img src={m.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : avatarInitials(m.brandName || m.name)}
                          </div>
                          <div style={{ flex: 1, overflow: "hidden" }}>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{m.brandName || m.name}</div>
                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
                              {rank.label} · LV {m.level} · {m.xcoin.toLocaleString()} XC · Max stake: {maxStake}%
                            </div>
                          </div>
                          {stakeInfo && (
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: "12px", fontWeight: 700, color: studio.color }}>{stakeInfo.stakeXC.toLocaleString()} XC</div>
                              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>{stakeInfo.stakePercent}% stake</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setModal(null)}
                    style={{
                      marginTop: "20px", width: "100%", padding: "11px",
                      background: `rgba(${studio.colorRgb},0.1)`,
                      border: `1px solid rgba(${studio.colorRgb},0.3)`,
                      borderRadius: "8px", color: studio.color,
                      fontSize: "12px", fontWeight: 700, cursor: "pointer",
                      letterSpacing: "0.1em", textTransform: "uppercase",
                    }}
                  >
                    Close
                  </button>
                </>
              );
            })()}

            {/* Reassign modal */}
            {modal.mode === "reassign" && (() => {
              const studio = getActiveStudio()!;
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                    <span style={{ fontSize: "22px" }}>🔄</span>
                    <div>
                      <div style={{ fontSize: "17px", fontWeight: 800, color: "#fff" }}>Reassign Player</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>Override automatic studio placement</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(0,212,255,0.7)", letterSpacing: "0.12em", marginBottom: "7px" }}>
                      SELECT PLAYER
                    </label>
                    <select
                      value={reassignPlayerId}
                      onChange={e => setReassignPlayerId(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: "8px",
                        background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.2)",
                        color: "rgba(255,255,255,0.8)", fontSize: "13px", cursor: "pointer",
                      }}
                    >
                      <option value="">— Choose a player —</option>
                      {players.map(p => {
                        const currentStudio = studios.find(s => s.id === p.studioId);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.brandName || p.name} {currentStudio ? `(→ ${currentStudio.name})` : "(unassigned)"}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div style={{ marginBottom: "22px" }}>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(0,212,255,0.7)", letterSpacing: "0.12em", marginBottom: "7px" }}>
                      ASSIGN TO STUDIO
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {studios.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setReassignTargetStudioId(s.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: "12px",
                            padding: "12px 14px", borderRadius: "10px",
                            background: reassignTargetStudioId === s.id ? `rgba(${s.colorRgb},0.18)` : "rgba(255,255,255,0.03)",
                            border: `1px solid ${reassignTargetStudioId === s.id ? `rgba(${s.colorRgb},0.5)` : "rgba(255,255,255,0.08)"}`,
                            cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                          }}
                        >
                          <span style={{ fontSize: "20px" }}>{s.icon}</span>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: reassignTargetStudioId === s.id ? s.color : "rgba(255,255,255,0.7)" }}>
                              {s.name}
                            </div>
                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
                              {getStudioMembers(s.id).length} members · {s.xcPool.toLocaleString()} XC pool
                            </div>
                          </div>
                          {reassignTargetStudioId === s.id && (
                            <div style={{ marginLeft: "auto", color: s.color, fontSize: "16px" }}>✓</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => { setModal(null); setReassignPlayerId(""); setReassignTargetStudioId(""); }}
                      style={{
                        flex: 1, padding: "11px", borderRadius: "8px",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                        color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 700,
                        cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReassign}
                      disabled={!reassignPlayerId || !reassignTargetStudioId}
                      style={{
                        flex: 2, padding: "11px", borderRadius: "8px",
                        background: (reassignPlayerId && reassignTargetStudioId) ? "linear-gradient(135deg, #00d4ff, #7c3aed)" : "rgba(255,255,255,0.06)",
                        border: "none",
                        color: (reassignPlayerId && reassignTargetStudioId) ? "#fff" : "rgba(255,255,255,0.2)",
                        fontSize: "12px", fontWeight: 800,
                        cursor: (reassignPlayerId && reassignTargetStudioId) ? "pointer" : "default",
                        letterSpacing: "0.1em", textTransform: "uppercase",
                      }}
                    >
                      Confirm Reassignment
                    </button>
                  </div>
                </>
              );
            })()}

            {/* Tax override modal */}
            {modal.mode === "tax" && (() => {
              const studio = getActiveStudio()!;
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                    <span style={{ fontSize: "24px" }}>{studio.icon}</span>
                    <div>
                      <div style={{ fontSize: "17px", fontWeight: 800, color: studio.color }}>{studio.name}</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>Set corporate tax rate for this studio</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "rgba(0,212,255,0.7)", letterSpacing: "0.12em", marginBottom: "7px" }}>
                      TAX RATE (%)
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="number"
                        min="0" max="50" step="1"
                        value={taxRateInput}
                        onChange={e => setTaxRateInput(e.target.value)}
                        style={{
                          flex: 1, padding: "12px 14px", borderRadius: "8px",
                          background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.25)",
                          color: "#fff", fontSize: "18px", fontWeight: 700, textAlign: "center",
                        }}
                      />
                      <span style={{ fontSize: "18px", color: "rgba(255,255,255,0.4)" }}>%</span>
                    </div>
                    <div style={{ marginTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                      Deducted from studio pool each season. Recommended: 10%
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => setModal(null)}
                      style={{
                        flex: 1, padding: "11px", borderRadius: "8px",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                        color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 700,
                        cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleTaxUpdate}
                      style={{
                        flex: 2, padding: "11px", borderRadius: "8px",
                        background: `rgba(${studio.colorRgb},0.15)`,
                        border: `1px solid rgba(${studio.colorRgb},0.4)`,
                        color: studio.color,
                        fontSize: "12px", fontWeight: 800,
                        cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
                      }}
                    >
                      Update Tax Rate
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
