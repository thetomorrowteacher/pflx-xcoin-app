"use client";
import { useEffect, useState } from "react";
import {
  mockTransactions, mockUsers, mockSubmissions,
  mockStudioInvestments, getStatusScore,
} from "../lib/data";

interface TickerEvent {
  text: string;
  color: string;
  icon: string;
  date: string;
}

function buildTickerEvents(): TickerEvent[] {
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
        text: `ACTIVE STAKE — ${handle} has ${inv.stakeXC.toLocaleString()} XC staked in their studio (${inv.stakePercent}% of pool)`,
        date: inv.createdAt || "2026-03-01",
      });
    }
  });

  // ── Current #1 leader ──────────────────────────────────────────
  if (players.length > 0) {
    const leader = [...players].sort((a, b) => getStatusScore(b) - getStatusScore(a))[0];
    events.push({
      icon: "🏆",
      color: "#f5c842",
      text: `CURRENT #1 — @${leader.brandName || leader.name} leads the PFLX Leaderboard with a Status Score of ${getStatusScore(leader).toLocaleString()} · ${leader.totalXcoin.toLocaleString()} lifetime XC · ${leader.digitalBadges} badges`,
      date: new Date().toISOString(),
    });
  }

  // Sort by date descending, deduplicate, cap at 40
  return events
    .filter(e => e.text.trim())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 40);
}

export default function Ticker() {
  const [events, setEvents] = useState<TickerEvent[]>([]);

  useEffect(() => {
    setEvents(buildTickerEvents());
  }, []);

  if (events.length === 0) return null;

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
