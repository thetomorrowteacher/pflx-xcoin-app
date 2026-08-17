"use client";
import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════════
// X-Coin profile page — REMOVED in favor of the Console's in-app
// Universal Portfolio Viewer (v1.71+, pflxOpenPlayerPortfolio).
//
// v1.73.1 (Ennis: "It should open directly with no middle ground.") —
// this used to postMessage a `pflx_navigate` request that sent the WHOLE
// Console shell to its legacy `/<brand>` public-portfolio page. That page
// is gated behind Publish ("Publish is for viewing outside of PFLX" —
// Ennis's original v1.71 spec), so it dead-ended in "Portfolio not
// found" for the very common case of a player who's never published.
// That's backwards: viewing a portfolio FROM INSIDE PFLX was always
// supposed to need no publish step at all.
//
// Now, when this route is reached inside the Console iframe (the normal
// case — every "view portfolio" click across X-Coin's Leaderboard,
// Player Management, and side nav still routes here), it asks the
// PARENT shell to open the player directly in the no-publish-required
// modal instead — one hop, no interstitial screens. Standalone visits
// (this route hit directly, outside the Console iframe — rare, but the
// player record isn't guaranteed to exist on this device to resolve a
// brand for) get a plain, honest pointer back to the Platform instead
// of a dead-end.
//
// The legacy implementation (project add/edit, publish, etc. — ~1000
// lines) lived here before. See git history if you ever need it. Don't
// rebuild it — the canonical portfolio lives in
// pflx-platform-check/preview.html now.
// ═══════════════════════════════════════════════════════════════════

const CONSOLE_ORIGIN = "https://www.prototypeflx.com";

export default function PlayerProfileRedirect({ params }: { params: { id: string } }) {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.parent !== window) {
        // Iframed inside the Console — ask the parent shell to open this
        // player's portfolio directly. The Console resolves the id itself
        // (it has the full player roster); no brand lookup needed here.
        window.parent.postMessage(JSON.stringify({
          type: "pflx_open_portfolio",
          playerId: params.id,
        }), "*");
      } else {
        setStandalone(true);
      }
    } catch {
      setStandalone(true);
    }
  }, [params.id]);

  // Iframed: the parent takes over instantly (opens its modal, this iframe
  // stays wherever it was) — nothing needs to render here.
  if (!standalone) return null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      background: "linear-gradient(135deg, #02060f 0%, #0a1228 60%, #0f1830 100%)",
      fontFamily: "Orbitron, monospace", color: "#e0e6ff", zIndex: 2147483647,
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, maxWidth: 460, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>📁</div>
        <div style={{ color: "#00f0ff", fontSize: 18, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>
          Portfolio moved
        </div>
        <div style={{ color: "#8a92b0", fontSize: 13, lineHeight: 1.6, fontFamily: "Rajdhani, sans-serif" }}>
          Portfolio viewing now lives inside the PFLX Platform. Open the Platform and click the player's name to view it there.
        </div>
        <a href={CONSOLE_ORIGIN} style={{
          marginTop: 8, padding: "12px 28px",
          background: "linear-gradient(135deg,#00d4ff,#7c3aed)",
          color: "#fff", textDecoration: "none", borderRadius: 10,
          fontFamily: "Orbitron, sans-serif", fontSize: 12, letterSpacing: 2, fontWeight: 700,
          boxShadow: "0 4px 24px rgba(0,212,255,0.35)",
        }}>OPEN PFLX PLATFORM →</a>
      </div>
    </div>
  );
}
