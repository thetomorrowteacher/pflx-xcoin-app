"use client";
import { useEffect, useState } from "react";

/**
 * PflxIframeGuard — Enforces that this app only renders when launched from
 * the PFLX Platform.
 *
 * Two states:
 *   1. NOT in iframe (standalone)        → permanent block screen with a
 *                                          link back to the Platform
 *   2. In iframe, identity not yet here  → "Syncing with Platform" overlay
 *   3. In iframe, identity received      → app renders
 *
 * The local login UI is effectively dead code now; identity comes solely
 * from the Platform via PflxBridge's pflx_identity_broadcast handler.
 */

const PLATFORM_URL = "https://www.prototypeflx.com/";

export default function PflxIframeGuard() {
  // null = checking, "blocked" = standalone, "syncing" = waiting for identity, "ready" = render
  const [state, setState] = useState<"checking" | "blocked" | "syncing" | "ready">("checking");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.parent === window) {
      setState("blocked"); // standalone access — block permanently
      return;
    }
    setState("syncing");
    let cleared = false;
    const reveal = () => {
      if (cleared) return;
      cleared = true;
      setState("ready");
    };
    window.addEventListener("pflx-identity-changed", reveal as EventListener);
    const timer = window.setTimeout(reveal, 6000); // safety: don't trap user forever
    return () => {
      window.removeEventListener("pflx-identity-changed", reveal as EventListener);
      window.clearTimeout(timer);
    };
  }, []);

  if (state === "ready") return null;
  if (state === "checking") return null; // brief gap before useEffect runs

  if (state === "blocked") {
    return (
      <div
        data-pflx-iframe-guard="blocked"
        style={blockStyle}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, maxWidth: 460, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>🛰️</div>
          <div style={{ color: "#00f0ff", fontSize: 18, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>
            Access via PFLX Platform
          </div>
          <div style={{ color: "#8a92b0", fontSize: 13, lineHeight: 1.6, fontFamily: "Rajdhani, sans-serif" }}>
            This app runs inside the PFLX Platform. Your profile, X-Coin, badges, and progress are all
            managed there. Open the Platform and launch this app from inside.
          </div>
          <a
            href={PLATFORM_URL}
            style={{
              marginTop: 8,
              padding: "12px 28px",
              background: "linear-gradient(135deg,#00d4ff,#7c3aed)",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 10,
              fontFamily: "Orbitron, sans-serif",
              fontSize: 12,
              letterSpacing: 2,
              fontWeight: 700,
              boxShadow: "0 4px 24px rgba(0,212,255,0.35)",
            }}
          >
            OPEN PFLX PLATFORM →
          </a>
        </div>
      </div>
    );
  }

  // syncing
  return (
    <div data-pflx-iframe-guard="syncing" style={blockStyle}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "2px solid rgba(0,240,255,0.18)",
            borderTopColor: "#00f0ff",
            animation: "pflx-iframe-spin 0.9s linear infinite",
          }}
        />
        <div style={{ color: "#00f0ff", fontSize: 11, letterSpacing: 3, textTransform: "uppercase" }}>
          Syncing with Platform
        </div>
        <div style={{ color: "#6a7290", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Loading your profile across all apps
        </div>
      </div>
      <style>{`@keyframes pflx-iframe-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const blockStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  background: "linear-gradient(135deg, #02060f 0%, #0a1228 60%, #0f1830 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  fontFamily: "Orbitron, 'Share Tech Mono', monospace",
  color: "#e0e6ff",
};
