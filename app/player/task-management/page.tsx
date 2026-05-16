"use client";
import { useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════
// REMOVED — Task Management has moved to Mission Control.
// X-Coin's role is currency + badges + fines/tax + marketplace.
// Players manage tasks through the Console (prototypeflx.com).
// ═══════════════════════════════════════════════════════════════════

const CONSOLE_URL = "https://www.prototypeflx.com/";

export default function TaskManagementMoved() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.parent !== window) {
        window.parent.postMessage(JSON.stringify({
          type: "pflx_navigate",
          url: CONSOLE_URL,
          target: "self",
        }), "*");
      } else {
        window.location.replace(CONSOLE_URL);
      }
    } catch { /* noop */ }
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      background: "linear-gradient(135deg, #02060f 0%, #0a1228 60%, #0f1830 100%)",
      fontFamily: "Orbitron, monospace", color: "#e0e6ff", zIndex: 2147483647,
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, maxWidth: 480, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>📋</div>
        <div style={{ color: "#00f0ff", fontSize: 18, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>
          Task Management moved
        </div>
        <div style={{ color: "#8a92b0", fontSize: 13, lineHeight: 1.6, fontFamily: "Rajdhani, sans-serif" }}>
          Tasks now live in <b style={{ color: "#fff" }}>Mission Control</b> on the PFLX Platform.
          X-Coin handles currency, badges, fines, tax, and the marketplace — task workflow is
          centralized in MC so seasons, checkpoints, projects, and tasks all share one source of truth.
        </div>
        <a href={CONSOLE_URL} style={{
          marginTop: 8, padding: "12px 28px",
          background: "linear-gradient(135deg,#00d4ff,#7c3aed)",
          color: "#fff", textDecoration: "none", borderRadius: 10,
          fontFamily: "Orbitron, sans-serif", fontSize: 12, letterSpacing: 2, fontWeight: 700,
          boxShadow: "0 4px 24px rgba(0,212,255,0.35)",
        }}>OPEN MISSION CONTROL →</a>
      </div>
    </div>
  );
}
