"use client";
import { useEffect, useState } from "react";
import {
  mockTransactions, mockUsers, mockSubmissions,
  mockStudioInvestments, getStatusScore,
} from "../lib/data";

const TICKER_DATE_KEY = "pflx_ticker_date";

/** Returns "YYYY-MM-DD" for today in local time. */
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Milliseconds until the next local midnight. */
function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

interface TickerEvent {
  text: string;
  color: string;
  icon: string;
  date: string;
}

function buildTickerEvents(): TickerEvent[] {
  // Only include events from the current calendar day (resets at midnight)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const cutoff = startOfToday.getTime();

  const players = mockUsers.filter(u => u.role === "player");
  const events: TickerEvent[] = [];

  // ── Transactions: XC earned, fines, purchases ──────────────────
  mockTransactions.forEach(tx => {
    const user = players.find(u => u.id === tx.userId);
    const handle = user ? `@${user.brandName || user.name}` : "A player";

    if (tx.type === "pflx_tax") {
      events.push({
        icon: "🔴",
        color: "#ef4444",
        text: `FINE ISSUED — ${handle} penalised -${tx.amount.toLocaleString()} XC: ${tx.description}`,
        date: tx.createdAt,
      });
    } else if (tx.type === "earned" || tx.type === "admin_grant") {
      if (tx.currency === "digitalBadge") {
        events.push({
          icon: "🏅",
          color: "#f5c842",
          text: `BADGE AWARDED — ${handle} earned a Digital Badge: ${tx.description}`,
          date: tx.createdAt,
        });
      } else {
        events.push({
          icon: "🟢",
          color: "#4ade80",
          text: `XC EARNED — ${handle} +${tx.amount.toLocaleString()} XC · ${tx.description}`,
          date: tx.createdAt,
        });
      }
    } else if (tx.type === "investment_stake") {
      events.push({
        icon: "📈",
        color: "#00d4ff",
        text: `STUDIO STAKE — ${handle} invested ${tx.amount.toLocaleString()} XC into their studio`,
        date: tx.createdAt,
      });
    } else if (tx.type === "investment_return") {
      events.push({
        icon: "💰",
        color: "#4ade80",
        text: `STUDIO RETURN — ${handle} received +${tx.amount.toLocaleString()} XC from studio pool`,
        date: tx.createdAt,
      });
    } else if (tx.type === "spent") {
      events.push({
        icon: "🛒",
        color: "#a78bfa",
        text: `MARKETPLACE — ${handle} purchased: ${tx.description}`,
        date: tx.createdAt,
      });
    }
  });

  // ── Submissions: task/job approvals + badge awards ─────────────
  mockSubmissions.forEach(sub => {
    const user = players.find(u => u.id === (sub.playerId ?? sub.userId));
    const handle = user ? `@${user.brandName || user.name}` : "A player";

    if (sub.status === "approved") {
      if (sub.coinType) {
        events.push({
          icon: "🏅",
          color: "#f5c842",
          text: `BADGE EARNED — ${handle} received "${sub.coinType}"${sub.amount > 1 ? ` ×${sub.amount}` : ""}${sub.reason ? ` · ${sub.reason}` : ""}`,
          date: sub.reviewedAt || sub.submittedAt,
        });
      } else {
        events.push({
          icon: "✅",
          color: "#4ade80",
          text: `TASK APPROVED — ${handle} had a submission approved${sub.reason ? ` · ${sub.reason}` : ""}`,
          date: sub.reviewedAt || sub.submittedAt,
        });
      }
    } else if (sub.status === "rejected") {
      events.push({
        icon: "❌",
        color: "#ef4444",
        text: `SUBMISSION RETURNED — ${handle}'s submission needs revision${sub.reason ? ` · ${sub.reason}` : ""}`,
        date: sub.reviewedAt || sub.submittedAt,
      });
    }
  });

  // ── Studio investments ─────────────────────────────────────────
  mockStudioInvestments.forEach(inv => {
    const user = players.find(u => u.id === inv.userId);
    const handle = user ? `@${user.brandName || user.name}` : "A player";
    if (inv.status === "active") {
      events.push({
        icon: "🏢",
        color: "#06b6d4",
        text: `ACTIVE STAKE — ${handle} has ${(inv.stakeXC ?? 0).toLocaleString()} XC staked in their studio (${inv.stakePercent ?? 0}% of pool)`,
        date: inv.createdAt || "2026-03-01",
      });
    }
  });

  // ── Current #1 leader ──────────────────────────────────────────
  if (players.length > 0) {
    try {
      const leader = [...players].sort((a, b) => getStatusScore(b) - getStatusScore(a))[0];
      if (leader) {
        events.push({
          icon: "🏆",
          color: "#f5c842",
          text: `CURRENT #1 — @${leader.brandName || leader.name} leads the PFLX Leaderboard with a Status Score of ${getStatusScore(leader).toLocaleString()} · ${(leader.totalXcoin ?? 0).toLocaleString()} lifetime XC · ${leader.digitalBadges ?? 0} badges`,
          date: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn("[Ticker] Error computing leader:", e);
    }
  }

  // Filter to today only (events without a valid date are excluded except #1 which always has now())
  // Sort newest first, cap at 40
  return events
    .filter(e => e.text.trim() && new Date(e.date).getTime() >= cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 40);
}

export default function Ticker() {
  const [events, setEvents] = useState<TickerEvent[]>([]);

  useEffect(() => {
    // ── Initial load ──────────────────────────────────────────────
    const today = todayString();
    const stored = localStorage.getItem(TICKER_DATE_KEY);
    if (stored !== today) {
      // New day — record today's date and start fresh
      localStorage.setItem(TICKER_DATE_KEY, today);
    }
    setEvents(buildTickerEvents());

    // ── Refresh every 60 s to pick up new activity ────────────────
    const refreshInterval = setInterval(() => {
      setEvents(buildTickerEvents());
    }, 60_000);

    // ── Schedule a reset exactly at midnight ──────────────────────
    const midnightTimeout = setTimeout(() => {
      localStorage.setItem(TICKER_DATE_KEY, todayString());
      setEvents(buildTickerEvents());
    }, msUntilMidnight());

    return () => {
      clearInterval(refreshInterval);
      clearTimeout(midnightTimeout);
    };
  }, []);

  if (events.length === 0) {
    // No activity yet today — show a placeholder so the ticker bar still renders
    return (
      <div style={{
        position: "fixed", bottom: 0, left: 0, width: "100%",
        background: "rgba(8,8,14,0.97)",
        borderTop: "1px solid rgba(0,212,255,0.15)",
        zIndex: 99999, height: "28px", display: "flex", alignItems: "center",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          flexShrink: 0, padding: "0 10px", height: "100%",
          display: "flex", alignItems: "center",
          background: "rgba(0,212,255,0.08)",
          borderRight: "1px solid rgba(0,212,255,0.15)",
          fontSize: "8px", fontWeight: 900, letterSpacing: "0.14em", color: "#00d4ff",
        }}>⚡ LIVE</div>
        <span style={{ fontSize: "11px", color: "rgba(0,212,255,0.3)", marginLeft: "16px", letterSpacing: "0.06em" }}>
          No activity yet today · Resets daily at midnight
        </span>
      </div>
    );
  }

  // Build the ticker string with colored segments via spans — we render the text once and duplicate it
  const separator = "      ◆      ";

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, width: "100%",
      background: "rgba(8,8,14,0.97)",
      borderTop: "1px solid rgba(0,212,255,0.3)",
      zIndex: 99999, overflow: "hidden", whiteSpace: "nowrap",
      backdropFilter: "blur(12px)",
      height: "28px", display: "flex", alignItems: "center",
    }}>
      <style>{`
        @keyframes pflx-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .pflx-ticker-track {
          display: inline-flex;
          align-items: center;
          animation: pflx-ticker ${Math.max(40, events.length * 4)}s linear infinite;
        }
        .pflx-ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Live badge */}
      <div style={{
        flexShrink: 0, padding: "0 10px", height: "100%",
        display: "flex", alignItems: "center",
        background: "rgba(0,212,255,0.12)",
        borderRight: "1px solid rgba(0,212,255,0.25)",
        fontSize: "8px", fontWeight: 900, letterSpacing: "0.14em",
        color: "#00d4ff",
      }}>
        ⚡ LIVE
      </div>

      <div style={{ overflow: "hidden", flex: 1 }}>
        <div className="pflx-ticker-track">
          {/* Render items twice so the loop is seamless */}
          {[...events, ...events].map((ev, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "11px" }}>{ev.icon}</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: ev.color, letterSpacing: "0.02em" }}>
                {ev.text}
              </span>
              <span style={{ color: "rgba(0,212,255,0.3)", fontSize: "10px", margin: "0 4px" }}>{separator}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
