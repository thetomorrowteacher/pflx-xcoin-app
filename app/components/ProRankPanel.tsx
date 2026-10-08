"use client";

import { useEffect, useState } from "react";
import { User, getPlayerRankReport, PflxRankReport, PflxRankSlim } from "../lib/data";

/**
 * ProRankPanel — game-style ranked panel for the X-Coin player home.
 * Progress ring + emblem, the 10-rank ladder, and a checklist of what the player
 * has already obtained / still needs for the next rank (lifetime XC, checkpoints,
 * badge types and specific badges, with "A or B" alternatives).
 */

function rankColor(r?: PflxRankSlim | null): string {
  const c = r?.color || "";
  return c && c.charAt(0) === "#" ? c : "#00d4ff";
}

function Emblem({ rank, size, locked = false, glow = false }: { rank: PflxRankSlim; size: number; locked?: boolean; glow?: boolean }) {
  const [stage, setStage] = useState(0); // 0 local png, 1 remote image, 2 emoji
  const color = rankColor(rank);
  const local = `/pro-ranks/rank-${rank.level}.png`;
  const src = stage === 0 ? local : stage === 1 && rank.image && /^(https?:|data:)/.test(rank.image) ? rank.image : "";
  return (
    <div style={{
      position: "relative", width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      filter: locked ? "grayscale(1) brightness(0.45)" : "none",
      transition: "filter .3s",
    }}>
      {glow && !locked && (
        <div style={{ position: "absolute", inset: -size * 0.12, borderRadius: "50%", background: `radial-gradient(circle, ${color}55 0%, transparent 65%)`, animation: "prPulse 2.6s ease-in-out infinite" }} />
      )}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={rank.name} width={size} height={size}
          onError={() => setStage(s => s + 1)}
          style={{ position: "relative", width: size, height: size, objectFit: "contain", filter: locked ? "none" : `drop-shadow(0 0 ${Math.round(size / 9)}px ${color}88)` }} />
      ) : (
        <span style={{ position: "relative", fontSize: size * 0.55 }}>{rank.icon || "🏆"}</span>
      )}
      {locked && (
        <span style={{ position: "absolute", right: -2, bottom: -2, fontSize: Math.max(10, size * 0.28), filter: "none" }}>🔒</span>
      )}
    </div>
  );
}

function Ring({ pct, color, size, children }: { pct: number; color: string; size: number; children: React.ReactNode }) {
  const stroke = Math.round(size * 0.07);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, pct));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="prRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#prRingGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`} style={{ transition: "stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)", filter: `drop-shadow(0 0 6px ${color}99)` }} />
      </svg>
      <div style={{ position: "absolute", inset: stroke * 1.6, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

const fmt = (n: number) => Math.round(n).toLocaleString();

export default function ProRankPanel({ user }: { user: User }) {
  const [report, setReport] = useState<PflxRankReport>(() => getPlayerRankReport(user));

  useEffect(() => {
    const refresh = () => setReport(getPlayerRankReport(user));
    refresh();
    window.addEventListener("pflx-rank-updated", refresh);
    // Ask the Console (when we're inside the Platform) for the authoritative checklist.
    try {
      if (window.parent !== window) window.parent.postMessage(JSON.stringify({ type: "pflx_rank_get", playerId: user.id, all: true }), "*");
    } catch { /* ignore */ }
    return () => window.removeEventListener("pflx-rank-updated", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.totalXcoin]);

  const cur = report.current;
  if (!cur) return null;
  const next = report.next;
  const color = rankColor(cur);
  const checks = report.checks || [];
  const live = checks.filter(c => c.enforced);
  const metCount = live.filter(c => c.met).length;
  const pct = report.master ? 1 : next ? report.progress : 1;
  const pctLabel = Math.round(pct * 100);

  return (
    <div style={{ marginBottom: 28, borderRadius: 20, overflow: "hidden", position: "relative",
      background: `linear-gradient(135deg, rgba(14,16,30,0.97) 0%, rgba(26,20,48,0.95) 55%, ${color}22 100%)`,
      border: `1px solid ${color}55`, boxShadow: `0 0 40px ${color}22, inset 0 0 60px rgba(0,0,0,0.35)` }}>
      <style>{`
        @keyframes prPulse { 0%,100% { opacity:.55; transform:scale(.96);} 50% { opacity:1; transform:scale(1.06);} }
        @keyframes prShine { 0% { transform:translateX(-120%);} 100% { transform:translateX(220%);} }
        .pr-req { transition: transform .15s ease, box-shadow .15s ease; }
        .pr-req:hover { transform: translateY(-2px); }
        .pr-ladder::-webkit-scrollbar { height: 6px; } .pr-ladder::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
      `}</style>
      {/* diagonal accent stripes */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5,
        background: "repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,0.018) 22px 44px)" }} />

      {/* Header */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.22em", color: "#ffffffcc", textTransform: "uppercase" }}>⚔ Pro Rank</div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: color, textTransform: "uppercase" }}>
          {report.master ? "Master Host" : `Tier ${cur.level} of ${report.ladder.length}`}
        </div>
      </div>

      {/* Hero */}
      <div style={{ position: "relative", display: "flex", gap: 28, padding: "24px 26px 8px", alignItems: "center", flexWrap: "wrap" }}>
        <Ring pct={pct} color={color} size={170}>
          {report.master ? (
            <span style={{ fontSize: 54 }}>👁️</span>
          ) : (
            <Emblem rank={cur} size={88} glow />
          )}
          <div style={{ marginTop: 2, fontSize: 18, fontWeight: 900, color: "#fff", textShadow: `0 0 10px ${color}` }}>{report.master ? "MASTER" : `${pctLabel}%`}</div>
        </Ring>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
            {cur.group ? `${cur.group} · ` : ""}Current rank
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.05, color: "#fff", textTransform: "uppercase", letterSpacing: "0.02em", textShadow: `0 0 18px ${color}88` }}>
            {report.master ? "Master Admin" : cur.name}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={chip("#00d4ff")}>⚡ {fmt(report.lifetimeXc)} lifetime XC</span>
            <span style={chip("#a78bfa")}>📍 {report.checkpointsDone} checkpoints</span>
            {report.bypassed && <span style={chip("#f5c842")}>Requirements bypassed by host</span>}
            {report.overridden && <span style={chip("#f5c842")}>Rank set by host</span>}
          </div>
          {report.master ? (
            <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>This rank sits outside the ladder and belongs only to the Master Host accounts.</div>
          ) : next ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Emblem rank={next} size={34} locked />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Next rank</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", textTransform: "uppercase" }}>{next.name}</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Requirements</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: metCount === live.length ? "#4ade80" : "#00d4ff" }}>{metCount} / {live.length}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12, fontSize: 13, fontWeight: 800, color: "#4ade80" }}>★ Top of the ladder — maximum rank reached</div>
          )}
        </div>
      </div>

      {/* Ladder */}
      <div className="pr-ladder" style={{ position: "relative", display: "flex", gap: 6, padding: "16px 22px 6px", overflowX: "auto" }}>
        {report.ladder.map(r => {
          const isCur = r.current;
          const col = rankColor(r);
          return (
            <div key={r.id || r.level} title={`${r.name} — ${fmt(r.xcoinUnlock)} XC`} style={{
              minWidth: 74, flex: "1 0 74px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px 8px", borderRadius: 12,
              background: isCur ? `${col}22` : "rgba(255,255,255,0.03)",
              border: `1px solid ${isCur ? col : "rgba(255,255,255,0.06)"}`,
              boxShadow: isCur ? `0 0 18px ${col}55` : "none", position: "relative", overflow: "hidden",
            }}>
              {isCur && <div style={{ position: "absolute", top: 0, bottom: 0, width: "40%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)", animation: "prShine 3.4s linear infinite" }} />}
              <Emblem rank={r} size={44} locked={!r.unlocked} glow={isCur} />
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.06em", textAlign: "center", color: r.unlocked ? "#fff" : "rgba(255,255,255,0.35)", textTransform: "uppercase", lineHeight: 1.15 }}>{r.name}</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>{r.xcoinUnlock >= 1000 ? `${fmt(r.xcoinUnlock / 1000)}K` : r.xcoinUnlock} XC</div>
            </div>
          );
        })}
      </div>

      {/* Requirements checklist */}
      {!report.master && next && (
        <div style={{ position: "relative", padding: "14px 22px 22px" }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 10 }}>
            To reach {next.name} · stacked requirements
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {checks.map((c, i) => {
              const done = c.met;
              const skipped = !c.enforced;
              const bar = c.kind === "xc" || c.kind === "checkpoints";
              const tone = done ? "#4ade80" : skipped ? "#94a3b8" : "#f5c842";
              const barPct = Math.min(100, Math.round((c.have / (c.need || 1)) * 100));
              return (
                <div key={i} className="pr-req" style={{
                  padding: "10px 12px", borderRadius: 12, display: "flex", flexDirection: "column", gap: 6,
                  background: done ? "rgba(74,222,128,0.07)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${done ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.08)"}`,
                  boxShadow: done ? "0 0 14px rgba(74,222,128,0.12)" : "none", opacity: skipped ? 0.6 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900,
                      background: done ? "#4ade80" : "transparent", color: done ? "#052e16" : tone, border: done ? "none" : `2px solid ${tone}` }}>
                      {done ? "✓" : skipped ? "–" : "!"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#f0f0ff", lineHeight: 1.2 }}>{c.label}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: tone, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {skipped ? "Bypassed" : done ? "Obtained" : "Needed"}
                        {c.kind === "badge" && done && c.via && c.alts && c.alts.length > 1 ? ` · via ${c.via}` : ""}
                      </div>
                    </div>
                  </div>
                  {bar && (
                    <div>
                      <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{ width: `${barPct}%`, height: "100%", borderRadius: 4, background: done ? "#4ade80" : "linear-gradient(90deg,#00d4ff,#a78bfa)", transition: "width .6s ease" }} />
                      </div>
                      <div style={{ marginTop: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{fmt(c.have)} / {fmt(c.need)}{c.kind === "xc" ? " XC" : ""}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function chip(color: string): React.CSSProperties {
  return { fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999, color, background: `${color}1a`, border: `1px solid ${color}44` };
}

/** Compact widget version: ring + rank + next-rank requirement count. Click to open the full panel on the player home. */
export function ProRankWidget({ user, href = "/player" }: { user: User; href?: string }) {
  const [report, setReport] = useState<PflxRankReport>(() => getPlayerRankReport(user));
  useEffect(() => {
    const refresh = () => setReport(getPlayerRankReport(user));
    refresh();
    window.addEventListener("pflx-rank-updated", refresh);
    return () => window.removeEventListener("pflx-rank-updated", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.totalXcoin]);
  const cur = report.current;
  if (!cur) return null;
  const color = rankColor(cur);
  const live = (report.checks || []).filter(c => c.enforced);
  const met = live.filter(c => c.met).length;
  const pct = report.master || !report.next ? 1 : report.progress;
  return (
    <a href={href} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14, textDecoration: "none",
      background: `linear-gradient(135deg, rgba(14,16,30,0.95), ${color}22)`, border: `1px solid ${color}55`, boxShadow: `0 0 16px ${color}22`,
    }}>
      <Ring pct={pct} color={color} size={58}>
        {report.master ? <span style={{ fontSize: 22 }}>👁️</span> : <Emblem rank={cur} size={30} />}
      </Ring>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>Pro Rank</div>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{report.master ? "Master" : cur.name}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: report.next && !report.master ? "#00d4ff" : "#4ade80" }}>
          {report.master ? "Master Host" : report.next ? `${Math.round(pct * 100)}% → ${report.next.name} · ${met}/${live.length}` : "Max rank"}
        </div>
      </div>
    </a>
  );
}
