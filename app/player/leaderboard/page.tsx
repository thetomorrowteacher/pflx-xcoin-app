"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "../../components/SideNav";
import {
  User, mockUsers, getCurrentRank,
  getBadgeBreakdown, getStatusScore, BadgeBreakdown,
  mockStartupStudios, mockStudioInvestments,
} from "../../lib/data";
import { applyPlayerImages } from "../../lib/playerImages";
import Link from "next/link";

// ─── Badge colour palette ──────────────────────────────────────────────────
const BADGE_COLORS = {
  signature: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
  executive:  { color: "#f5c842", bg: "rgba(245,200,66,0.1)",  border: "rgba(245,200,66,0.3)" },
  premium:    { color: "#a78bfa", bg: "rgba(167,139,250,0.12)",border: "rgba(167,139,250,0.3)" },
  primary:    { color: "#4f8ef7", bg: "rgba(79,142,247,0.12)", border: "rgba(79,142,247,0.3)" },
} as const;
type BadgeKey = keyof typeof BADGE_COLORS;

const RANK_TIERS = [
  { key: "foundation",     label: "🥉 Foundation", levels: [1, 2, 3] },
  { key: "production",     label: "🎬 Production",  levels: [4, 5] },
  { key: "leadership",     label: "🎖 Leadership",  levels: [6, 7, 8] },
  { key: "executive_tier", label: "🏆 Executive",   levels: [9, 10] },
];

const rankEmojis = ["🥇", "🥈", "🥉"];

type SortKey     = "status" | "xcoin" | "totalXcoin" | "digitalBadge" | "name";
type BadgeFilter = "all" | BadgeKey;
type TierFilter  = "all" | "foundation" | "production" | "leadership" | "executive_tier";

// ─── Compact dropdown ─────────────────────────────────────────────────────
function ChipSelect<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const active = value !== "all";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          background: active ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${active ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "7px",
          color: active ? "#a78bfa" : "rgba(255,255,255,0.45)",
          fontSize: "11px", fontWeight: 600, padding: "3px 6px",
          cursor: "pointer", outline: "none",
        }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key} style={{ background: "#12121c" }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Grid template shared between header and rows ────────────────────────
// STATUS | avatar | PLAYER | STUDIO | EVO RANK | SIG | EXEC | PREM | PRI | TOTAL | XC | SCORE
const GRID = "72px 36px 1fr 110px 115px 78px 78px 78px 78px 70px 90px 82px";

// ─── Studio logo helper — tries image, falls back to emoji ────────────────
function StudioLogo({ studioId, icon, color, colorRgb, size = 56 }: {
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

export default function PlayerLeaderboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"players" | "studios">("players");
  const [sortBy,       setSortBy]       = useState<SortKey>("status");
  const [sortDir,      setSortDir]      = useState<"desc" | "asc">("desc");
  const [badgeFilter,  setBadgeFilter]  = useState<BadgeFilter>("all");
  const [tierFilter,   setTierFilter]   = useState<TierFilter>("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [studioFilter, setStudioFilter] = useState<string>("all");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pflx_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored) as User;
    if (u.role !== "player") { router.push("/admin"); return; }
    if (!u.onboardingComplete) { router.push("/diagnostic"); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;

  const allPlayers = applyPlayerImages(mockUsers).filter((u) => u.role === "player");
  const cohorts    = Array.from(new Set(allPlayers.map((p) => p.cohort).filter(Boolean))) as string[];

  const filtered = allPlayers.filter((p) => {
    const b    = getBadgeBreakdown(p);
    const rank = getCurrentRank(p.totalXcoin, p);
    const tier = RANK_TIERS.find((t) => t.levels.includes(rank.level));
    if (cohortFilter !== "all" && p.cohort !== cohortFilter) return false;
    if (tierFilter   !== "all" && tier?.key !== tierFilter)  return false;
    if (badgeFilter  !== "all" && b[badgeFilter as BadgeKey] === 0) return false;
    if (studioFilter !== "all" && p.studioId !== studioFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortBy === "status")       diff = getStatusScore(b) - getStatusScore(a);
    else if (sortBy === "xcoin")        diff = b.xcoin - a.xcoin;
    else if (sortBy === "totalXcoin")   diff = b.totalXcoin - a.totalXcoin;
    else if (sortBy === "digitalBadge") diff = b.digitalBadges - a.digitalBadges;
    else if (sortBy === "name")         diff = (a.brandName ?? a.name).localeCompare(b.brandName ?? b.name);
    return sortDir === "asc" ? -diff : diff;
  });

  const topThree = sorted.slice(0, 3);

  // ── Studios data (used by studios view) ───────────────────────────────
  const allPlayersForStudios = applyPlayerImages(mockUsers).filter(u => u.role === "player");
  const studiosRanked = [...mockStartupStudios].sort((a, b) => b.xcPool - a.xcPool).map((s, idx) => {
    const members = allPlayersForStudios.filter(p => p.studioId === s.id);
    const stakes = mockStudioInvestments.filter(i => i.studioId === s.id && i.status === "active");
    const totalStaked = stakes.reduce((sum, i) => sum + i.stakeXC, 0);
    const topMember = [...members].sort((a, b) => b.totalXcoin - a.totalXcoin)[0];
    const isMyStudio = user?.studioId === s.id;
    return { ...s, members, stakes, totalStaked, topMember, rank: idx + 1, isMyStudio };
  });
  const studiosTotalXC = studiosRanked.reduce((s, st) => s + st.xcPool, 0);
  const studiosTotalMembers = studiosRanked.reduce((s, st) => s + st.members.length, 0);

  const posColor = (n: number) => n === 1 ? "#f5c842" : n === 2 ? "#94a3b8" : n === 3 ? "#cd7c2f" : "rgba(255,255,255,0.35)";
  const posLabel = (n: number) => n === 1 ? "🥇" : n === 2 ? "🥈" : n === 3 ? "🥉" : `#${n}`;

  // ── Column dropdown helper ─────────────────────────────────────────────
  const ColDropdown = ({ id, label, color = "rgba(255,255,255,0.25)", isActive, options }: {
    id: string; label: string; color?: string; isActive: boolean;
    options: { label: string; active: boolean; onSelect: () => void }[];
  }) => {
    const isOpen = openDropdown === id;
    return (
      <div style={{ position: "relative" }}>
        {isOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={() => setOpenDropdown(null)} />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setOpenDropdown(isOpen ? null : id); }}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
            color: isActive ? "#a78bfa" : color,
            display: "flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap",
          }}
        >
          {label}
          <span style={{ fontSize: "9px", opacity: isOpen ? 1 : 0.5, transform: isOpen ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▾</span>
        </button>
        {isOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 99,
            background: "#151520", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "10px", padding: "4px", minWidth: "160px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
          }}>
            {options.map((opt, i) => (
              <button key={i} onClick={() => { opt.onSelect(); setOpenDropdown(null); }} style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "7px 12px", borderRadius: "7px",
                background: opt.active ? "rgba(167,139,250,0.15)" : "none",
                border: "none", cursor: "pointer",
                fontSize: "11px", fontWeight: opt.active ? 800 : 600,
                color: opt.active ? "#a78bfa" : "rgba(255,255,255,0.6)",
              }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Badge count cell — number + name
  const BadgeCell = ({ count, type }: { count: number; type: BadgeKey }) => {
    const c = BADGE_COLORS[type];
    const names: Record<BadgeKey, string> = { signature: "Signature", executive: "Executive", premium: "Premium", primary: "Primary" };
    return (
      <div>
        <p style={{ margin: "0 0 1px", fontSize: "13px", fontWeight: 800, fontFamily: "monospace",
          color: count > 0 ? c.color : "rgba(255,255,255,0.15)" }}>
          {count > 0 ? count : "—"}
        </p>
        <p style={{ margin: 0, fontSize: "10px", fontWeight: 600,
          color: count > 0 ? c.color + "88" : "rgba(255,255,255,0.1)" }}>
          {names[type]}
        </p>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <SideNav user={user} />
      <main style={{ flex: 1, padding: "28px 32px", overflow: "auto" }}>

        {/* ── Title + Toggle ───────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
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
              }}>
                {view === "players" ? "LEADERBOARD" : "STARTUP STUDIOS"}
              </span>
            </h1>
            <p style={{ margin: 0, color: "rgba(0,212,255,0.5)", fontSize: "13px", letterSpacing: "0.1em" }}>
              {view === "players"
                ? "[ STATUS STANDINGS · EVO RANK · XC BALANCE ]"
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
              { id: "players", label: "Players", icon: "👥" },
              { id: "studios", label: "Studios", icon: "🏢" },
            ] as const).map(tab => (
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

        {/* ── Podium — Top 3 ──────────────────────────────────────────── */}
        {view === "players" && topThree.length > 0 && (
          <div style={{ marginBottom: "28px" }}>
            <p style={{ margin: "0 0 14px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(167,139,250,0.55)" }}>
              [ TOP STATUS PERFORMERS ]
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: topThree.length === 3 ? "1fr 1.4fr 1fr" : topThree.length === 2 ? "1fr 1fr" : "1fr",
              gap: "12px", alignItems: "flex-end",
            }}>
              {(topThree.length === 3 ? [1, 0, 2] : topThree.map((_, i) => i)).map((idx) => {
                const player = topThree[idx];
                if (!player) return null;

                const is1st = idx === 0;
                const is2nd = idx === 1;
                const medalRgb = is1st ? "245,200,66" : is2nd ? "148,163,184" : "205,124,47";

                const cardH     = is1st ? "440px" : is2nd ? "350px" : "310px";
                const photoSize = is1st ? "180px" : is2nd ? "140px" : "120px";
                const nameSz    = is1st ? "22px"  : is2nd ? "17px"  : "15px";
                const medalBadge = is1st ? "2.6rem" : is2nd ? "2rem" : "1.8rem";

                const shadow = is1st
                  ? `0 0 70px rgba(${medalRgb},0.5), 0 0 25px rgba(${medalRgb},0.3), inset 0 0 40px rgba(${medalRgb},0.08)`
                  : `0 0 30px rgba(${medalRgb},0.22), inset 0 0 16px rgba(${medalRgb},0.04)`;
                const border = is1st
                  ? `2px solid rgba(${medalRgb},0.65)`
                  : `1px solid rgba(${medalRgb},0.35)`;

                const score = getStatusScore(player);
                const isMe  = player.id === user.id;

                return (
                  <div key={player.id} style={{
                    height: cardH,
                    background: `linear-gradient(170deg, rgba(${medalRgb},${is1st ? "0.16" : "0.08"}) 0%, rgba(10,10,15,0.95) 100%)`,
                    border: isMe ? `2px solid #a78bfa` : border,
                    borderRadius: "20px",
                    padding: "40px 20px 28px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: is1st ? "16px" : "12px",
                    textAlign: "center", position: "relative",
                    boxShadow: isMe
                      ? `${shadow}, 0 0 40px rgba(167,139,250,0.2)`
                      : shadow,
                  }}>
                    {/* Corner brackets */}
                    <div style={{ position: "absolute", top: "12px", left: "12px", width: "14px", height: "14px", border: `1.5px solid rgba(${medalRgb},0.5)`, borderRight: "none", borderBottom: "none", borderRadius: "2px" }} />
                    <div style={{ position: "absolute", top: "12px", right: "12px", width: "14px", height: "14px", border: `1.5px solid rgba(${medalRgb},0.5)`, borderLeft: "none", borderBottom: "none", borderRadius: "2px" }} />
                    {/* Rank label */}
                    <div style={{ position: "absolute", top: "13px", left: 0, right: 0, textAlign: "center", fontSize: "9px", fontWeight: 700, color: `rgba(${medalRgb},0.55)`, letterSpacing: "0.14em" }}>
                      {isMe ? "✨ YOU" : `STATUS #${idx + 1}`}
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
                      {/* Medal badge */}
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
                      <span style={{ fontSize: is1st ? "16px" : "12px", fontWeight: 900, color: "#a78bfa", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                        {score.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Table card (players view) ────────────────────────────────── */}
        {view === "players" && <div style={{
          background: "rgba(22,22,31,0.9)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "16px", overflow: "hidden",
        }}>

          {/* ── Toolbar ─────────────────────────────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.02)",
          }}>
            <ChipSelect<SortKey>
              label="SORT"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { key: "status",       label: "⭐ Status Score" },
                { key: "xcoin",        label: "🪙 XC Balance" },
                { key: "totalXcoin",   label: "📈 Total XC" },
                { key: "digitalBadge", label: "🏅 Badge Count" },
              ]}
            />
            <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.08)" }} />
            <ChipSelect<BadgeFilter>
              label="BADGE"
              value={badgeFilter}
              onChange={setBadgeFilter}
              options={[
                { key: "all",       label: "All types" },
                { key: "signature", label: "🟥 Signature" },
                { key: "executive", label: "🟨 Executive" },
                { key: "premium",   label: "🟪 Premium" },
                { key: "primary",   label: "🟦 Primary" },
              ]}
            />
            <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.08)" }} />
            <ChipSelect<TierFilter>
              label="TIER"
              value={tierFilter}
              onChange={setTierFilter}
              options={[
                { key: "all", label: "All tiers" },
                ...RANK_TIERS.map((t) => ({ key: t.key as TierFilter, label: t.label })),
              ]}
            />
            {cohorts.length > 0 && (
              <>
                <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.08)" }} />
                <ChipSelect<string>
                  label="COHORT"
                  value={cohortFilter}
                  onChange={setCohortFilter}
                  options={[
                    { key: "all", label: "All cohorts" },
                    ...cohorts.map((c) => ({ key: c, label: c })),
                  ]}
                />
              </>
            )}
          </div>

          {/* ── Scrollable headers + rows ────────────────────────────── */}
          <div style={{ overflowX: "auto" }}>

            {/* Column headers */}
            <div style={{
              display: "grid", gridTemplateColumns: GRID,
              gap: "0 6px", alignItems: "center",
              padding: "8px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.015)",
            }}>
              <ColDropdown id="status" label="STATUS" isActive={sortBy === "status"} options={[
                { label: "⬇ Score High → Low", active: sortBy === "status" && sortDir === "desc", onSelect: () => { setSortBy("status"); setSortDir("desc"); } },
                { label: "⬆ Score Low → High", active: sortBy === "status" && sortDir === "asc",  onSelect: () => { setSortBy("status"); setSortDir("asc"); } },
              ]} />
              <div />
              <ColDropdown id="player" label="PLAYER" isActive={sortBy === "name"} options={[
                { label: "A → Z",  active: sortBy === "name" && sortDir === "desc", onSelect: () => { setSortBy("name"); setSortDir("desc"); } },
                { label: "Z → A",  active: sortBy === "name" && sortDir === "asc",  onSelect: () => { setSortBy("name"); setSortDir("asc"); } },
              ]} />
              <ColDropdown id="studio" label="STUDIO" isActive={studioFilter !== "all"} options={[
                { label: "All Studios", active: studioFilter === "all", onSelect: () => setStudioFilter("all") },
                ...mockStartupStudios.map(s => ({ label: s.icon + " " + s.name, active: studioFilter === s.id, onSelect: () => setStudioFilter(s.id) })),
              ]} />
              <ColDropdown id="evorank" label="EVO RANK" isActive={tierFilter !== "all"} options={[
                { label: "All Tiers", active: tierFilter === "all", onSelect: () => setTierFilter("all") },
                ...RANK_TIERS.map(t => ({ label: t.label, active: tierFilter === t.key, onSelect: () => setTierFilter(t.key as TierFilter) })),
              ]} />
              <ColDropdown id="sig" label="🟥 SIGNATURE" color="#ef4444" isActive={badgeFilter === "signature"} options={[
                { label: "All Players",       active: badgeFilter !== "signature", onSelect: () => setBadgeFilter("all") },
                { label: "Has Signature ✓",   active: badgeFilter === "signature", onSelect: () => setBadgeFilter("signature") },
              ]} />
              <ColDropdown id="exec" label="🟨 EXECUTIVE" color="#f5c842" isActive={badgeFilter === "executive"} options={[
                { label: "All Players",       active: badgeFilter !== "executive", onSelect: () => setBadgeFilter("all") },
                { label: "Has Executive ✓",   active: badgeFilter === "executive", onSelect: () => setBadgeFilter("executive") },
              ]} />
              <ColDropdown id="prem" label="🟪 PREMIUM" color="#a78bfa" isActive={badgeFilter === "premium"} options={[
                { label: "All Players",     active: badgeFilter !== "premium", onSelect: () => setBadgeFilter("all") },
                { label: "Has Premium ✓",   active: badgeFilter === "premium", onSelect: () => setBadgeFilter("premium") },
              ]} />
              <ColDropdown id="pri" label="🟦 PRIMARY" color="#4f8ef7" isActive={badgeFilter === "primary"} options={[
                { label: "All Players",     active: badgeFilter !== "primary", onSelect: () => setBadgeFilter("all") },
                { label: "Has Primary ✓",   active: badgeFilter === "primary", onSelect: () => setBadgeFilter("primary") },
              ]} />
              <ColDropdown id="total" label="TOTAL" isActive={sortBy === "digitalBadge"} options={[
                { label: "⬇ Most Badges",   active: sortBy === "digitalBadge" && sortDir === "desc", onSelect: () => { setSortBy("digitalBadge"); setSortDir("desc"); } },
                { label: "⬆ Fewest Badges", active: sortBy === "digitalBadge" && sortDir === "asc",  onSelect: () => { setSortBy("digitalBadge"); setSortDir("asc"); } },
              ]} />
              <ColDropdown id="xc" label="XC BALANCE" isActive={sortBy === "xcoin"} options={[
                { label: "⬇ Highest XC",  active: sortBy === "xcoin" && sortDir === "desc", onSelect: () => { setSortBy("xcoin"); setSortDir("desc"); } },
                { label: "⬆ Lowest XC",   active: sortBy === "xcoin" && sortDir === "asc",  onSelect: () => { setSortBy("xcoin"); setSortDir("asc"); } },
              ]} />
              <ColDropdown id="score" label="SCORE" isActive={sortBy === "totalXcoin"} options={[
                { label: "⬇ Highest Score", active: sortBy === "totalXcoin" && sortDir === "desc", onSelect: () => { setSortBy("totalXcoin"); setSortDir("desc"); } },
                { label: "⬆ Lowest Score",  active: sortBy === "totalXcoin" && sortDir === "asc",  onSelect: () => { setSortBy("totalXcoin"); setSortDir("asc"); } },
              ]} />
            </div>

            {/* Rows */}
            {sorted.length === 0 && (
              <p style={{ padding: "32px", textAlign: "center", color: "rgba(255,255,255,0.3)", margin: 0 }}>
                No players match the current filters.
              </p>
            )}
            {sorted.map((p, i) => {
              const isMe  = p.id === user.id;
              const pos   = i + 1;
              const rank  = getCurrentRank(p.totalXcoin, p);
              const b     = getBadgeBreakdown(p);
              const score = getStatusScore(p);
              const total = b.signature + b.executive + b.premium + b.primary;
              return (
                <div key={p.id} style={{
                  display: "grid", gridTemplateColumns: GRID,
                  gap: "0 6px", alignItems: "center",
                  padding: "11px 14px",
                  background: isMe ? "rgba(79,142,247,0.05)" : i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent",
                  borderLeft: isMe ? "3px solid #4f8ef7" : "3px solid transparent",
                  borderBottom: i < sorted.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>

                  {/* Status position */}
                  <div style={{
                    width: "34px", height: "30px", borderRadius: "7px",
                    background: pos <= 3 ? `${posColor(pos)}18` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${pos <= 3 ? posColor(pos) + "35" : "rgba(255,255,255,0.06)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: pos <= 3 ? "15px" : "11px", fontWeight: 800,
                    color: posColor(pos),
                  }}>
                    {posLabel(pos)}
                  </div>

                  {/* Avatar */}
                  <div style={{
                    width: "32px", height: "32px", overflow: "hidden",
                    borderRadius: p.image ? "50%" : "8px",
                    background: p.image ? "transparent" : isMe ? "linear-gradient(135deg,#4f8ef7,#8b5cf6)" : "linear-gradient(135deg,#2a2a3a,#3a3a4a)",
                    border: p.image ? `1px solid ${isMe ? "rgba(79,142,247,0.5)" : "rgba(255,255,255,0.15)"}` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: 700, color: "white",
                    flexShrink: 0,
                  }}>
                    {p.image ? <img src={p.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : p.avatar}
                  </div>

                  {/* Name + pathway */}
                  <div style={{ minWidth: 0 }}>
                    <p
                      onClick={() => router.push(`/profile/${p.id}`)}
                      style={{
                        margin: "0 0 1px", fontSize: "13px",
                        fontWeight: isMe ? 700 : 600,
                        color: isMe ? "#4f8ef7" : "#f0f0ff",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(240,240,255,0.2)",
                      }}
                    >
                      {isMe ? user.name : (p.brandName || p.name)}
                      {isMe && (
                        <span style={{
                          fontSize: "9px", fontWeight: 700, color: "#4f8ef7",
                          background: "rgba(79,142,247,0.15)", border: "1px solid rgba(79,142,247,0.3)",
                          borderRadius: "4px", padding: "1px 5px", marginLeft: "6px",
                        }}>YOU</span>
                      )}
                    </p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.pathway}
                    </p>
                  </div>

                  {/* Studio */}
                  {(() => {
                    const studio = mockStartupStudios.find(s => s.id === p.studioId);
                    if (!studio) return <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)" }}>—</div>;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                        <div style={{
                          width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0,
                          background: `rgba(${studio.colorRgb},0.85)`,
                          border: `1px solid rgba(${studio.colorRgb},0.4)`,
                          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                        }}>
                          <img
                            src={`/studio-${studio.id.replace("studio-", "")}.png`}
                            alt={studio.name}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextSibling as HTMLElement).style.display = "block"; }}
                            style={{ width: "80%", height: "80%", objectFit: "contain", filter: "brightness(0) invert(1)" }}
                          />
                          <span style={{ fontSize: "10px", display: "none" }}>{studio.icon}</span>
                        </div>
                        <span style={{
                          fontSize: "10px", fontWeight: 700,
                          color: studio.color,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>{studio.name}</span>
                      </div>
                    );
                  })()}

                  {/* Evo Rank */}
                  <div>
                    <p style={{ margin: "0 0 1px", fontSize: "12px", fontWeight: 700, color: "#e0e0ff", whiteSpace: "nowrap" }}>
                      {rank.icon} {rank.name}
                    </p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                      Lv {rank.level}
                    </p>
                  </div>

                  {/* Signature */}
                  <BadgeCell count={b.signature} type="signature" />

                  {/* Executive */}
                  <BadgeCell count={b.executive} type="executive" />

                  {/* Premium */}
                  <BadgeCell count={b.premium} type="premium" />

                  {/* Primary */}
                  <BadgeCell count={b.primary} type="primary" />

                  {/* Total Badges */}
                  <div>
                    <p style={{ margin: "0 0 1px", fontSize: "13px", fontWeight: 800, color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>
                      {total}
                    </p>
                    <p style={{ margin: 0, fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.25)" }}>Total</p>
                  </div>

                  {/* XC Balance */}
                  <div>
                    <p style={{ margin: "0 0 1px", fontSize: "13px", fontWeight: 800, color: "#f5c842", fontFamily: "monospace" }}>
                      🪙 {p.xcoin.toLocaleString()}
                    </p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>Balance</p>
                  </div>

                  {/* Score */}
                  <div style={{
                    padding: "4px 10px", borderRadius: "8px",
                    background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
                    display: "inline-flex", alignItems: "center",
                  }}>
                    <span style={{ fontSize: "12px", fontWeight: 900, color: "#a78bfa", fontFamily: "monospace" }}>
                      {score.toLocaleString()}
                    </span>
                  </div>

                </div>
              );
            })}

          </div>{/* end scroll wrapper */}

          {/* ── Score legend (footer) ────────────────────────────────── */}
          <div style={{
            padding: "8px 14px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.01)",
            display: "flex", flexWrap: "wrap", gap: "6px 16px",
            fontSize: "10px", color: "rgba(255,255,255,0.3)",
          }}>
            <span>🎖 Evo Rank ×100k</span>
            <span style={{ color: "#ef4444" }}>🟥 Sig ×10k</span>
            <span style={{ color: "#f5c842" }}>🟨 Exec ×1k</span>
            <span style={{ color: "#a78bfa" }}>🟪 Prem ×100</span>
            <span style={{ color: "#4f8ef7" }}>🟦 Pri ×10</span>
            <span>🪙 XC ÷100</span>
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
                background: s.isMyStudio ? `rgba(${s.colorRgb},0.07)` : "rgba(12,16,22,0.97)",
                border: `1px solid rgba(${s.colorRgb},${s.isMyStudio ? "0.45" : "0.2"})`,
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
                      {s.isMyStudio && (
                        <span style={{
                          fontSize: "9px", fontWeight: 700, padding: "2px 8px",
                          background: `rgba(${s.colorRgb},0.2)`, border: `1px solid rgba(${s.colorRgb},0.4)`,
                          borderRadius: "4px", color: s.color, letterSpacing: "0.12em",
                        }}>✦ YOUR STUDIO</span>
                      )}
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
                      { label: "TAX RATE", value: `💼 ${s.corporateTaxRate}%`, color: "#f59e0b" },
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
