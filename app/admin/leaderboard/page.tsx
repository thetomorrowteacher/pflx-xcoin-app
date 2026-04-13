"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SideNav from "../../components/SideNav";
import {
  User, mockUsers, getCurrentRank, getXCProgress,
  getMockCohorts, isHostUser, getBadgeBreakdown, getStatusScore, BadgeBreakdown,
  mockStartupStudios, mockStudioInvestments,
  CohortGroup, mockCohortGroups,
} from "../../lib/data";
import { applyPlayerImages } from "../../lib/playerImages";

type SortKey     = "status" | "xcoin" | "totalXcoin" | "digitalBadge";
type BadgeFilter = "all" | "signature" | "executive" | "premium" | "primary";
type TierFilter  = "all" | "foundation" | "production" | "leadership" | "executive_tier";

const CYAN = "#00d4ff";
const BADGE_COLORS = {
  signature: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)",   label: "🟥 SIG",  full: "Signature" },
  executive:  { color: "#f5c842", bg: "rgba(245,200,66,0.12)",  border: "rgba(245,200,66,0.3)",  label: "🟨 EXEC", full: "Executive" },
  premium:    { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", label: "🟪 PREM", full: "Premium" },
  primary:    { color: "#4f8ef7", bg: "rgba(79,142,247,0.12)",  border: "rgba(79,142,247,0.3)",  label: "🟦 PRI",  full: "Primary" },
} as const;
type BadgeKey = keyof typeof BADGE_COLORS;

const RANK_TIERS = [
  { key: "foundation"     as TierFilter, label: "🥉 Foundation", levels: [1,2,3] },
  { key: "production"     as TierFilter, label: "🎬 Production",  levels: [4,5] },
  { key: "leadership"     as TierFilter, label: "🎖 Leadership",  levels: [6,7,8] },
  { key: "executive_tier" as TierFilter, label: "🏆 Executive",   levels: [9,10] },
];

const rankColors = ["#f5c842","#94a3b8","#cd7c2f"];
const rankEmojis = ["🥇","🥈","🥉"];

function BadgePill({ count, type }: { count: number; type: BadgeKey }) {
  const c = BADGE_COLORS[type];
  if (count === 0) return (
    <span style={{
      padding: "2px 7px", borderRadius: "5px", fontSize: "10px", fontWeight: 700,
      color: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)", letterSpacing: "0.04em", fontFamily: "monospace"
    }}>
      {c.label.split(" ")[1]} ·0
    </span>
  );
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: 800,
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      letterSpacing: "0.04em", fontFamily: "monospace",
      boxShadow: `0 0 6px ${c.bg}`
    }}>
      {c.label} ·{count}
    </span>
  );
}

// ─── Compact dropdown chip ────────────────────────────────────────────────
function ChipSelect<T extends string>({
  label, value, options, onChange, activeColor = CYAN,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  activeColor?: string;
}) {
  const isFiltered = value !== "all";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          background: isFiltered ? `${activeColor}14` : "rgba(255,255,255,0.04)",
          border: `1px solid ${isFiltered ? activeColor + "50" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "7px",
          color: isFiltered ? activeColor : "rgba(255,255,255,0.45)",
          fontSize: "11px", fontWeight: 700, padding: "3px 7px",
          cursor: "pointer", outline: "none", letterSpacing: "0.04em",
        }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key} style={{ background: "#10101e" }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Studio logo helper ────────────────────────────────────────────────────
function StudioLogo({ studioId, icon, color, colorRgb, size = 52 }: {
  studioId: string; icon: string; color: string; colorRgb: string; size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const slug = studioId.replace("studio-", "");
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: `${Math.round(size * 0.25)}px`,
      overflow: "hidden", flexShrink: 0,
      background: imgFailed ? `rgba(${colorRgb},0.18)` : color,
      border: `1.5px solid rgba(${colorRgb},0.5)`,
      boxShadow: `0 0 16px rgba(${colorRgb},0.3)`,
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

export default function AdminLeaderboard() {
  const router = useRouter();
  const [user, setUser]               = useState<User | null>(null);
  const [view, setView]               = useState<"players" | "studios">("players");
  const [sortBy, setSortBy]           = useState<SortKey>("status");
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>("all");
  const [tierFilter, setTierFilter]   = useState<TierFilter>("all");
  const [cohortFilter, setCohortFilter] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    try {
      const u = JSON.parse(stored) as User;
      // When Platform has toggled to host mode, allow player users on admin pages
      const activeRole = localStorage.getItem("pflx_active_role");
      if (!isHostUser(u) && activeRole !== "host") { router.push("/player"); return; }
      setUser(u);
    } catch { router.push("/"); }
  }, []);

  if (!user) return null;

  const cohorts = getMockCohorts();

  // Sort
  const allPlayers = [...applyPlayerImages(mockUsers).filter(u => u.role === "player")].sort((a, b) => {
    if (sortBy === "status")       return getStatusScore(b) - getStatusScore(a);
    if (sortBy === "xcoin")        return b.xcoin - a.xcoin;
    if (sortBy === "totalXcoin")   return b.totalXcoin - a.totalXcoin;
    return b.digitalBadges - a.digitalBadges;
  });

  // Filter
  const players = allPlayers.filter(p => {
    if (cohortFilter.length > 0 && !cohortFilter.includes(p.cohort)) return false;
    if (badgeFilter  !== "all") {
      const b = getBadgeBreakdown(p);
      if (b[badgeFilter as keyof BadgeBreakdown] === 0) return false;
    }
    if (tierFilter !== "all") {
      const tier = RANK_TIERS.find(t => t.key === tierFilter);
      const rl   = getCurrentRank(p.totalXcoin, p).level;
      if (!tier || !tier.levels.includes(rl)) return false;
    }
    return true;
  });

  const topThree = players.slice(0, 3);
  const hasFilters = badgeFilter !== "all" || tierFilter !== "all" || cohortFilter.length > 0;

  // ── Studios data ──────────────────────────────────────────────────────
  const allPlayersForStudios = applyPlayerImages(mockUsers).filter(u => u.role === "player");
  const studiosRanked = [...mockStartupStudios].sort((a, b) => b.xcPool - a.xcPool).map((s, idx) => {
    const members = allPlayersForStudios.filter(p => p.studioId === s.id);
    const stakes = mockStudioInvestments.filter(i => i.studioId === s.id && i.status === "active");
    const totalStaked = stakes.reduce((sum, i) => sum + i.stakeXC, 0);
    const topMember = [...members].sort((a, b) => b.totalXcoin - a.totalXcoin)[0];
    return { ...s, members, stakes, totalStaked, topMember, rank: idx + 1 };
  });
  const studiosTotalXC = studiosRanked.reduce((s, st) => s + st.xcPool, 0);
  const studiosTotalMembers = studiosRanked.reduce((s, st) => s + st.members.length, 0);

  const colHead = (key: SortKey, label: string) => (
    <button onClick={() => setSortBy(key)} style={{
      background: "none", border: "none", cursor: "pointer", padding: 0,
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
      color: sortBy === key ? CYAN : "rgba(0,212,255,0.35)",
      display: "flex", alignItems: "center", gap: "3px",
    }}>
      {label}{sortBy === key && <span style={{ fontSize: "9px" }}> ▼</span>}
    </button>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#06090d" }}>
      <SideNav user={user} />
      <main style={{ flex: 1, padding: "32px", overflow: "auto" }}>

        {/* ── Header + Toggle ─────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{view === "players" ? "🏆" : "🏢"}</span>
              <span style={{
                background: view === "players"
                  ? "linear-gradient(90deg, #00d4ff, #a78bfa, #00d4ff)"
                  : "linear-gradient(90deg, #a78bfa, #00d4ff, #a78bfa)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 10px rgba(0,212,255,0.4))",
              }}>{view === "players" ? "LEADERBOARD" : "STARTUP STUDIOS"}</span>
            </h1>
            <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>
              {view === "players"
                ? "[ STATUS STANDINGS · HOST VIEW ]"
                : "[ STUDIO COMPETITION · XC POOLS · CORPORATE RANKINGS ]"}
            </p>
          </div>

          {/* Toggle pill */}
          <div style={{
            display: "flex",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px", padding: "4px", gap: "4px",
          }}>
            {([
              { id: "players" as const, label: "Players", icon: "👥" },
              { id: "studios" as const, label: "Studios", icon: "🏢" },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                style={{
                  padding: "8px 18px", borderRadius: "9px", border: "none",
                  cursor: "pointer", fontWeight: 700, fontSize: "13px",
                  display: "flex", alignItems: "center", gap: "6px",
                  transition: "all 0.2s",
                  background: view === tab.id
                    ? tab.id === "players" ? "rgba(0,212,255,0.15)" : "rgba(167,139,250,0.15)"
                    : "transparent",
                  color: view === tab.id
                    ? tab.id === "players" ? "#00d4ff" : "#a78bfa"
                    : "rgba(255,255,255,0.35)",
                  boxShadow: view === tab.id
                    ? tab.id === "players" ? "0 0 14px rgba(0,212,255,0.15)" : "0 0 14px rgba(167,139,250,0.15)"
                    : "none",
                  letterSpacing: "0.04em",
                }}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Podium — Top 3 ─────────────────────────────────────────── */}
        {view === "players" && topThree.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <p style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(0,212,255,0.5)" }}>
              [ TOP STATUS PERFORMERS ]
            </p>
            {/* Podium order: 2nd | 1st | 3rd — bottom-aligned so heights step up visually */}
            <div style={{
              display: "grid",
              gridTemplateColumns: topThree.length === 3 ? "1fr 1.4fr 1fr" : topThree.length === 2 ? "1fr 1fr" : "1fr",
              gap: "12px", alignItems: "flex-end",
            }}>
              {(topThree.length === 3 ? [1,0,2] : topThree.map((_,i)=>i)).map(idx => {
                const player  = topThree[idx];
                if (!player) return null;

                const is1st   = idx === 0;
                const is2nd   = idx === 1;
                const medalRgb = is1st ? "245,200,66" : is2nd ? "148,163,184" : "205,124,47";

                // Stepped card heights create the podium visual
                const cardH      = is1st ? "440px" : is2nd ? "350px" : "310px";
                // Photo dominates — takes ~55% of card height
                const photoSize  = is1st ? "180px" : is2nd ? "140px" : "120px";
                const nameSz     = is1st ? "22px"  : is2nd ? "17px"  : "15px";
                const medalBadge = is1st ? "2.6rem" : is2nd ? "2rem"  : "1.8rem";

                const shadow = is1st
                  ? `0 0 70px rgba(${medalRgb},0.5), 0 0 25px rgba(${medalRgb},0.3), inset 0 0 40px rgba(${medalRgb},0.08)`
                  : `0 0 30px rgba(${medalRgb},0.22), inset 0 0 16px rgba(${medalRgb},0.04)`;
                const border = is1st
                  ? `2px solid rgba(${medalRgb},0.65)`
                  : `1px solid rgba(${medalRgb},0.35)`;

                const score = getStatusScore(player);

                return (
                  <div key={player.id} style={{
                    height: cardH,
                    background: `linear-gradient(170deg, rgba(${medalRgb},${is1st ? "0.16" : "0.08"}) 0%, rgba(6,9,13,0.95) 100%)`,
                    border, borderRadius: "20px",
                    padding: "40px 20px 28px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: is1st ? "16px" : "12px",
                    textAlign: "center", position: "relative",
                    boxShadow: shadow,
                  }}>
                    {/* Corner brackets */}
                    <div style={{ position: "absolute", top: "12px", left: "12px", width: "14px", height: "14px", border: `1.5px solid rgba(${medalRgb},0.5)`, borderRight: "none", borderBottom: "none", borderRadius: "2px" }} />
                    <div style={{ position: "absolute", top: "12px", right: "12px", width: "14px", height: "14px", border: `1.5px solid rgba(${medalRgb},0.5)`, borderLeft: "none", borderBottom: "none", borderRadius: "2px" }} />
                    {/* Status label */}
                    <div style={{ position: "absolute", top: "13px", left: 0, right: 0, textAlign: "center", fontSize: "9px", fontWeight: 700, color: `rgba(${medalRgb},0.55)`, letterSpacing: "0.14em" }}>
                      STATUS #{idx + 1}
                    </div>

                    {/* ── Hero photo ── */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{
                        width: photoSize, height: photoSize, borderRadius: "50%",
                        overflow: "hidden",
                        border: `${is1st ? "4px" : "3px"} solid rgba(${medalRgb},${is1st ? "0.75" : "0.55"})`,
                        boxShadow: is1st
                          ? `0 0 50px rgba(${medalRgb},0.55), 0 0 100px rgba(${medalRgb},0.2), inset 0 0 20px rgba(${medalRgb},0.1)`
                          : `0 0 25px rgba(${medalRgb},0.35)`,
                        background: `radial-gradient(circle, rgba(${medalRgb},0.25) 0%, rgba(0,0,0,0.7) 100%)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: is1st ? "4rem" : is2nd ? "3rem" : "2.6rem",
                      }}>
                        {player.image
                          ? <img src={player.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : player.avatar}
                      </div>
                      {/* Medal badge pinned bottom-right of photo */}
                      <div style={{
                        position: "absolute", bottom: "-2px", right: "-6px",
                        fontSize: medalBadge, lineHeight: 1,
                        filter: `drop-shadow(0 0 ${is1st ? "12px" : "7px"} rgba(${medalRgb},${is1st ? "1" : "0.7"}))`,
                      }}>
                        {rankEmojis[idx]}
                      </div>
                    </div>

                    {/* Brand name */}
                    <div>
                      <p
                        onClick={() => router.push(`/profile/${player.id}`)}
                        style={{
                          margin: 0, fontWeight: 900, lineHeight: 1.2,
                          fontSize: nameSz,
                          color: `rgb(${medalRgb})`,
                          textShadow: `0 0 24px rgba(${medalRgb},0.7)`,
                          letterSpacing: "0.03em",
                          maxWidth: "100%", wordBreak: "break-word",
                          cursor: "pointer",
                        }}
                      >
                        {player.brandName || player.name}
                      </p>
                      {/* Subtle real name if different */}
                      {player.brandName && player.brandName !== player.name && (
                        <p style={{ margin: "4px 0 0", fontSize: "10px", color: `rgba(${medalRgb},0.45)`, fontWeight: 600, letterSpacing: "0.05em" }}>
                          {player.name}
                        </p>
                      )}
                    </div>

                    {/* Score chip */}
                    <div style={{
                      background: `rgba(${medalRgb},${is1st ? "0.18" : "0.1"})`,
                      border: `1px solid rgba(${medalRgb},0.45)`,
                      borderRadius: "12px",
                      padding: is1st ? "8px 28px" : "6px 20px",
                    }}>
                      <span style={{ fontSize: is1st ? "16px" : "12px", fontWeight: 900, color: CYAN, fontFamily: "monospace", letterSpacing: "0.05em" }}>
                        {score.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Full Status Table ────────────────────────────────────────── */}
        {view === "players" && <div style={{ background: "rgba(10,10,26,0.85)", border: "1px solid rgba(0,212,255,0.1)", borderRadius: "16px", overflow: "hidden" }}>

          {/* ── Toolbar row (filters + sort inside the card) ─────────── */}
          <div style={{
            display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
            padding: "10px 16px",
            borderBottom: "1px solid rgba(0,212,255,0.08)",
            background: "rgba(0,212,255,0.03)",
          }}>
            <ChipSelect<SortKey>
              label="SORT"
              value={sortBy}
              onChange={setSortBy}
              activeColor={CYAN}
              options={[
                { key: "status",       label: "⭐ Status Score" },
                { key: "xcoin",        label: "💎 XC Balance" },
                { key: "totalXcoin",   label: "⚡ Total XC" },
                { key: "digitalBadge", label: "🏅 Badge Count" },
              ]}
            />
            <div style={{ width: "1px", height: "16px", background: "rgba(0,212,255,0.1)" }} />
            <ChipSelect<BadgeFilter>
              label="BADGE"
              value={badgeFilter}
              onChange={setBadgeFilter}
              activeColor="#ef4444"
              options={[
                { key: "all",       label: "All types" },
                { key: "signature", label: "🟥 Signature" },
                { key: "executive", label: "🟨 Executive" },
                { key: "premium",   label: "🟪 Premium" },
                { key: "primary",   label: "🟦 Primary" },
              ]}
            />
            <div style={{ width: "1px", height: "16px", background: "rgba(0,212,255,0.1)" }} />
            <ChipSelect<TierFilter>
              label="TIER"
              value={tierFilter}
              onChange={setTierFilter}
              activeColor="#b91fe8"
              options={[
                { key: "all", label: "All tiers" },
                ...RANK_TIERS.map(t => ({ key: t.key, label: t.label })),
              ]}
            />
            {cohorts.length > 0 && (
              <>
                <div style={{ width: "1px", height: "16px", background: "rgba(0,212,255,0.1)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>COHORT</span>
                  <button onClick={() => setCohortFilter([])}
                    style={{
                      padding: "3px 8px", borderRadius: "7px", fontSize: "11px", fontWeight: 700, cursor: "pointer", border: "1px solid",
                      background: cohortFilter.length === 0 ? `${CYAN}14` : "rgba(255,255,255,0.04)",
                      borderColor: cohortFilter.length === 0 ? `${CYAN}50` : "rgba(255,255,255,0.1)",
                      color: cohortFilter.length === 0 ? CYAN : "rgba(255,255,255,0.45)",
                    }}>All</button>
                  {mockCohortGroups.map(g => {
                    const allIn = g.cohorts.length > 0 && g.cohorts.every(c => cohortFilter.includes(c));
                    const gc = g.color || "#a78bfa";
                    return (
                      <button key={g.id} onClick={() => {
                        if (allIn) {
                          setCohortFilter(prev => prev.filter(c => !g.cohorts.includes(c)));
                        } else {
                          setCohortFilter(prev => [...new Set([...prev, ...g.cohorts])]);
                        }
                      }} style={{
                        padding: "3px 8px", borderRadius: "7px", fontSize: "11px", fontWeight: 700, cursor: "pointer", border: "1px solid",
                        background: allIn ? `${gc}20` : "rgba(255,255,255,0.04)",
                        borderColor: allIn ? `${gc}60` : "rgba(255,255,255,0.1)",
                        color: allIn ? gc : "rgba(255,255,255,0.45)",
                      }}>📁{g.name}{allIn && " ✓"}</button>
                    );
                  })}
                  {cohorts.map(c => {
                    const on = cohortFilter.includes(c);
                    return (
                      <button key={c} onClick={() => setCohortFilter(prev => on ? prev.filter(x => x !== c) : [...prev, c])}
                        style={{
                          padding: "3px 8px", borderRadius: "7px", fontSize: "11px", fontWeight: 700, cursor: "pointer", border: "1px solid",
                          background: on ? `${CYAN}14` : "rgba(255,255,255,0.04)",
                          borderColor: on ? `${CYAN}50` : "rgba(255,255,255,0.1)",
                          color: on ? CYAN : "rgba(255,255,255,0.45)",
                        }}>{c}{on && " ✓"}</button>
                    );
                  })}
                </div>
              </>
            )}
            <div style={{ flex: 1 }} />
            {/* Live count */}
            <span style={{ fontSize: "11px", fontWeight: 700, color: hasFilters ? "#b91fe8" : "rgba(0,212,255,0.35)", letterSpacing: "0.06em" }}>
              {players.length} PLAYER{players.length !== 1 ? "S" : ""}
              {hasFilters && (
                <button onClick={() => { setBadgeFilter("all"); setTierFilter("all"); setCohortFilter([]); }} style={{
                  marginLeft: "8px", fontSize: "10px", color: "rgba(185,31,232,0.6)",
                  background: "none", border: "none", cursor: "pointer", textDecoration: "underline"
                }}>clear</button>
              )}
            </span>
          </div>

          {/* scroll wrapper — toolbar stays pinned, headers+rows scroll horizontally */}
          <div style={{ overflowX: "auto" }}>

          {/* ── Column headers (clickable sort) ──────────────────────── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "56px minmax(140px,1fr) 100px 110px 80px 80px 80px 80px 72px 90px 82px",
            padding: "9px 16px", gap: "0 6px", alignItems: "center",
            borderBottom: "1px solid rgba(0,212,255,0.08)",
            background: "rgba(0,212,255,0.02)",
          }}>
            {colHead("status", "STATUS")}
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(0,212,255,0.35)" }}>PLAYER</span>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(0,212,255,0.35)" }}>STUDIO</span>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(0,212,255,0.35)" }}>EVO RANK</span>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "#ef4444", opacity: 0.8 }}>🟥 SIGNATURE</span>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "#f5c842", opacity: 0.8 }}>🟨 EXECUTIVE</span>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "#a78bfa", opacity: 0.8 }}>🟪 PREMIUM</span>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "#4f8ef7", opacity: 0.8 }}>🟦 PRIMARY</span>
            {colHead("digitalBadge", "TOTAL BADGES")}
            {colHead("xcoin", "XC BALANCE")}
            {colHead("totalXcoin", "SCORE")}
          </div>

          {/* ── Rows ─────────────────────────────────────────────────── */}
          {players.length === 0 && (
            <div style={{ padding: "48px 40px", textAlign: "center" }}>
              <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: CYAN }}>NO PLAYERS MATCH FILTERS</p>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(0,212,255,0.4)" }}>Adjust your filters above or click clear.</p>
            </div>
          )}
          {players.map((p, i) => {
            const evRank   = getCurrentRank(p.totalXcoin, p);
            const b        = getBadgeBreakdown(p);
            const score    = getStatusScore(p);
            const medalRgb = i === 0 ? "245,200,66" : i === 1 ? "148,163,184" : i === 2 ? "205,124,47" : null;
            return (
              <div key={p.id} style={{
                display: "grid",
                gridTemplateColumns: "56px minmax(140px,1fr) 100px 110px 80px 80px 80px 80px 72px 90px 82px",
                padding: "12px 16px", gap: "0 8px", alignItems: "center",
                borderBottom: i < players.length - 1 ? "1px solid rgba(0,212,255,0.05)" : "none",
                background: i % 2 === 0 ? "transparent" : "rgba(0,212,255,0.015)",
              }}>

                {/* Status position */}
                <div style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  background: medalRgb ? `rgba(${medalRgb},0.14)` : "rgba(255,255,255,0.04)",
                  border: medalRgb ? `1px solid rgba(${medalRgb},0.35)` : "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: i < 3 ? "14px" : "11px", fontWeight: 800,
                  color: i < 3 ? rankColors[i] : "rgba(255,255,255,0.35)",
                  boxShadow: medalRgb ? `0 0 10px rgba(${medalRgb},0.18)` : "none",
                  flexShrink: 0,
                }}>
                  {i < 3 ? rankEmojis[i] : `#${i+1}`}
                </div>

                {/* Player name + pathway */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <div style={{
                    width: "34px", height: "34px", flexShrink: 0, overflow: "hidden",
                    borderRadius: p.image ? "50%" : "9px",
                    background: p.image ? "transparent" : "linear-gradient(135deg, rgba(0,212,255,0.1), rgba(185,31,232,0.1))",
                    border: `1px solid ${p.image ? "rgba(0,212,255,0.3)" : "rgba(0,212,255,0.15)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px",
                    boxShadow: p.image ? "0 0 10px rgba(0,212,255,0.2)" : "none",
                  }}>
                    {p.image ? <img src={p.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : p.avatar}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      onClick={() => router.push(`/profile/${p.id}`)}
                      style={{ margin: "0 0 1px", fontSize: "13px", fontWeight: 700, color: "#e0e0ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(224,224,255,0.25)" }}
                    >
                      {p.brandName || p.name}
                    </p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(0,212,255,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.pathway}
                    </p>
                  </div>
                </div>

                {/* Studio */}
                {(() => {
                  const studio = mockStartupStudios.find(s => s.id === p.studioId);
                  if (!studio) return <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)" }}>—</div>;
                  const slug = studio.id.replace("studio-", "");
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                      <div style={{
                        width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0,
                        background: studio.color, overflow: "hidden",
                        border: `1px solid rgba(${studio.colorRgb},0.4)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <img src={`/studio-${slug}.png`} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          style={{ width: "80%", height: "80%", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: studio.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {studio.name.replace(" Studios", "")}
                      </span>
                    </div>
                  );
                })()}

                {/* Evo Rank — actual rank name */}
                <div>
                  <p style={{ margin: "0 0 1px", fontSize: "12px", fontWeight: 700, color: "#e0e0ff", whiteSpace: "nowrap" }}>
                    {evRank.icon} {evRank.name}
                  </p>
                  <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                    Lv {evRank.level}
                  </p>
                </div>

                {/* Signature */}
                <div>
                  <p style={{ margin: "0 0 1px", fontSize: "14px", fontWeight: 800, color: b.signature > 0 ? "#ef4444" : "rgba(255,255,255,0.15)", fontFamily: "monospace" }}>
                    {b.signature > 0 ? b.signature : "—"}
                  </p>
                  <p style={{ margin: 0, fontSize: "10px", fontWeight: 600, color: b.signature > 0 ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.1)" }}>
                    Signature
                  </p>
                </div>

                {/* Executive */}
                <div>
                  <p style={{ margin: "0 0 1px", fontSize: "14px", fontWeight: 800, color: b.executive > 0 ? "#f5c842" : "rgba(255,255,255,0.15)", fontFamily: "monospace" }}>
                    {b.executive > 0 ? b.executive : "—"}
                  </p>
                  <p style={{ margin: 0, fontSize: "10px", fontWeight: 600, color: b.executive > 0 ? "rgba(245,200,66,0.55)" : "rgba(255,255,255,0.1)" }}>
                    Executive
                  </p>
                </div>

                {/* Premium */}
                <div>
                  <p style={{ margin: "0 0 1px", fontSize: "14px", fontWeight: 800, color: b.premium > 0 ? "#a78bfa" : "rgba(255,255,255,0.15)", fontFamily: "monospace" }}>
                    {b.premium > 0 ? b.premium : "—"}
                  </p>
                  <p style={{ margin: 0, fontSize: "10px", fontWeight: 600, color: b.premium > 0 ? "rgba(167,139,250,0.55)" : "rgba(255,255,255,0.1)" }}>
                    Premium
                  </p>
                </div>

                {/* Primary */}
                <div>
                  <p style={{ margin: "0 0 1px", fontSize: "14px", fontWeight: 800, color: b.primary > 0 ? "#4f8ef7" : "rgba(255,255,255,0.15)", fontFamily: "monospace" }}>
                    {b.primary > 0 ? b.primary : "—"}
                  </p>
                  <p style={{ margin: 0, fontSize: "10px", fontWeight: 600, color: b.primary > 0 ? "rgba(79,142,247,0.55)" : "rgba(255,255,255,0.1)" }}>
                    Primary
                  </p>
                </div>

                {/* Badge Total */}
                <div>
                  <p style={{ margin: "0 0 1px", fontSize: "14px", fontWeight: 800, color: "rgba(255,255,255,0.75)", fontFamily: "monospace" }}>
                    {b.signature + b.executive + b.premium + b.primary}
                  </p>
                  <p style={{ margin: 0, fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.25)" }}>
                    Total
                  </p>
                </div>

                {/* XC Balance */}
                <div>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "#a78bfa", fontFamily: "monospace" }}>
                    ⚡ {p.xcoin.toLocaleString()}
                  </p>
                  <p style={{ margin: "1px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
                    {p.totalXcoin.toLocaleString()} ttl
                  </p>
                </div>

                {/* Score */}
                <div style={{
                  padding: "4px 10px", borderRadius: "8px",
                  background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.12)",
                  display: "inline-flex", alignItems: "center"
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 900, color: CYAN, fontFamily: "monospace" }}>
                    {score.toLocaleString()}
                  </span>
                </div>

              </div>
            );
          })}

          </div>{/* end scroll wrapper */}

          {/* ── Score legend (card footer) ────────────────────────────── */}
          <div style={{
            padding: "8px 16px",
            borderTop: "1px solid rgba(0,212,255,0.08)",
            background: "rgba(0,212,255,0.02)",
            display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center",
          }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(0,212,255,0.3)", letterSpacing: "0.08em" }}>SCORE WEIGHTS:</span>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>Evo Rank ×100k</span>
            <BadgePill count={1} type="signature" /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>×10k</span>
            <BadgePill count={1} type="executive" /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>×1k</span>
            <BadgePill count={1} type="premium"   /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>×100</span>
            <BadgePill count={1} type="primary"   /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>×10</span>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>+ XC ÷100</span>
          </div>

        </div>}

        {/* ── Studios view ─────────────────────────────────────────────── */}
        {view === "studios" && (
          <div>
            {/* Stats banner */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "28px" }}>
              {[
                { label: "ACTIVE STUDIOS", value: "4", icon: "🏢", color: "#a78bfa", colorRgb: "167,139,250" },
                { label: "TOTAL MEMBERS", value: String(studiosTotalMembers), icon: "👥", color: "#00d4ff", colorRgb: "0,212,255" },
                { label: "TOTAL XC POOL", value: studiosTotalXC.toLocaleString(), icon: "⚡", color: "#f5c842", colorRgb: "245,200,66" },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: `rgba(${stat.colorRgb},0.05)`,
                  border: `1px solid rgba(${stat.colorRgb},0.15)`,
                  borderRadius: "12px", padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: "14px",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, rgba(${stat.colorRgb},0.4), transparent)` }} />
                  <span style={{ fontSize: "24px" }}>{stat.icon}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: stat.color, fontFamily: "monospace", lineHeight: 1 }}>{stat.value}</p>
                    <p style={{ margin: "3px 0 0", fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", fontWeight: 700 }}>{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Ranked studio cards */}
            {studiosRanked.map((s) => (
              <div key={s.id} style={{
                marginBottom: "16px",
                background: "rgba(12,16,22,0.97)",
                border: `1px solid rgba(${s.colorRgb},0.2)`,
                borderRadius: "16px", padding: "22px 24px",
                position: "relative", overflow: "hidden",
                boxShadow: s.rank === 1
                  ? `0 0 32px rgba(${s.colorRgb},0.12), inset 0 0 40px rgba(${s.colorRgb},0.03)`
                  : `0 0 12px rgba(${s.colorRgb},0.04)`,
              }}>
                {/* Bracket corners */}
                <div style={{ position: "absolute", top: "10px", left: "10px", width: "14px", height: "14px", borderTop: `2px solid rgba(${s.colorRgb},0.6)`, borderLeft: `2px solid rgba(${s.colorRgb},0.6)` }} />
                <div style={{ position: "absolute", top: "10px", right: "10px", width: "14px", height: "14px", borderTop: `2px solid rgba(${s.colorRgb},0.6)`, borderRight: `2px solid rgba(${s.colorRgb},0.6)` }} />
                <div style={{ position: "absolute", bottom: "10px", left: "10px", width: "14px", height: "14px", borderBottom: `2px solid rgba(${s.colorRgb},0.6)`, borderLeft: `2px solid rgba(${s.colorRgb},0.6)` }} />
                <div style={{ position: "absolute", bottom: "10px", right: "10px", width: "14px", height: "14px", borderBottom: `2px solid rgba(${s.colorRgb},0.6)`, borderRight: `2px solid rgba(${s.colorRgb},0.6)` }} />

                {/* Top row: logo + info + stats */}
                <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                  {/* Logo + rank badge */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <StudioLogo studioId={s.id} icon={s.icon} color={s.color} colorRgb={s.colorRgb} size={76} />
                    <div style={{
                      position: "absolute", bottom: "-6px", right: "-6px",
                      width: "26px", height: "26px", borderRadius: "50%",
                      background: "#06090d", border: `1.5px solid rgba(${s.colorRgb},0.5)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px",
                    }}>
                      {s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : "4️⃣"}
                    </div>
                  </div>

                  {/* Name + tagline + description */}
                  <div style={{ flex: 1, minWidth: "180px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "3px", flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "#fff", letterSpacing: "0.03em" }}>{s.name}</h3>
                    </div>
                    <p style={{ margin: "0 0 6px", fontSize: "12px", color: `rgba(${s.colorRgb},0.75)`, fontStyle: "italic" }}>{s.tagline}</p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)", lineHeight: 1.55, maxWidth: "500px" }}>{s.description}</p>
                  </div>

                  {/* Stat pills */}
                  <div style={{ display: "flex", gap: "10px", flexShrink: 0, flexWrap: "wrap" }}>
                    {[
                      { label: "XC POOL", value: `⚡ ${s.xcPool.toLocaleString()}`, color: s.color },
                      { label: "MEMBERS", value: `👥 ${s.members.length}`, color: "rgba(255,255,255,0.75)" },
                      { label: "STAKED", value: `📈 ${s.totalStaked.toLocaleString()}`, color: "#4ade80" },
                      { label: "TAX RATE", value: `💼 ${Math.round(s.corporateTaxRate * 100)}%`, color: "#f59e0b" },
                    ].map(stat => (
                      <div key={stat.label} style={{
                        background: `rgba(${s.colorRgb},0.06)`,
                        border: `1px solid rgba(${s.colorRgb},0.14)`,
                        borderRadius: "10px", padding: "10px 14px", textAlign: "center", minWidth: "82px",
                      }}>
                        <p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: 800, color: stat.color, fontFamily: "monospace" }}>{stat.value}</p>
                        <p style={{ margin: 0, fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", fontWeight: 700 }}>{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom row: top player + member avatars */}
                {s.topMember && (
                  <div style={{
                    marginTop: "16px", paddingTop: "14px",
                    borderTop: `1px solid rgba(${s.colorRgb},0.12)`,
                    display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em" }}>🏆 TOP PLAYER</span>
                      <div style={{
                        width: "26px", height: "26px", borderRadius: "50%", overflow: "hidden",
                        background: s.topMember.image ? "transparent" : `rgba(${s.colorRgb},0.3)`,
                        border: `1.5px solid rgba(${s.colorRgb},0.5)`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px",
                      }}>
                        {s.topMember.image
                          ? <img src={s.topMember.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : s.topMember.avatar}
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: s.color }}>{s.topMember.brandName || s.topMember.name}</span>
                      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>{s.topMember.totalXcoin.toLocaleString()} XC</span>
                    </div>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                      {s.members.slice(0, 10).map(m => (
                        <div key={m.id} title={m.brandName || m.name} style={{
                          width: "24px", height: "24px", borderRadius: "50%", overflow: "hidden",
                          background: m.image ? "transparent" : `rgba(${s.colorRgb},0.2)`,
                          border: `1px solid rgba(${s.colorRgb},0.3)`,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px",
                        }}>
                          {m.image
                            ? <img src={m.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : m.avatar}
                        </div>
                      ))}
                      {s.members.length > 10 && (
                        <div style={{
                          width: "24px", height: "24px", borderRadius: "50%",
                          background: `rgba(${s.colorRgb},0.1)`, border: `1px solid rgba(${s.colorRgb},0.2)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "8px", color: s.color, fontWeight: 700,
                        }}>+{s.members.length - 10}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
