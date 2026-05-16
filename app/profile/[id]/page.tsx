"use client";
import { useEffect, useState } from "react";
import { mockUsers } from "../../lib/data";

// ═══════════════════════════════════════════════════════════════════
// X-Coin profile page — REMOVED in favor of the Console portfolio.
// The Console (prototypeflx.com) now owns the unified portfolio surface
// at prototypeflx.com/<brand>. Visiting this old X-Coin route now
// redirects to the equivalent Console portfolio URL.
//
// The legacy implementation (project add/edit, publish, etc. — ~1000
// lines) lived here before. See git history if you ever need it. Don't
// rebuild it — the canonical portfolio lives in
// pflx-platform-check/preview.html now.
// ═══════════════════════════════════════════════════════════════════

const CONSOLE_ORIGIN = "https://www.prototypeflx.com";

function slugifyBrand(b: string): string {
  return String(b || "").trim().replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "player";
}

export default function PlayerProfileRedirect({ params }: { params: { id: string } }) {
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let brand = "";
    try {
      const u = mockUsers.find(m => m.id === params.id);
      if (u && (u.brandName || u.name)) {
        brand = String(u.brandName || u.name);
      } else {
        const cached = localStorage.getItem("pflx_user");
        if (cached) {
          const cu = JSON.parse(cached);
          if (cu && cu.id === params.id) brand = String(cu.brandName || cu.name || "");
        }
      }
    } catch {}

    if (brand) {
      const url = CONSOLE_ORIGIN + "/" + encodeURIComponent(slugifyBrand(brand));
      setTarget(url);
      // If we're iframed inside the Console, post a navigation request to the
      // parent so the WHOLE shell navigates rather than just this iframe.
      try {
        if (window.parent !== window) {
          window.parent.postMessage(JSON.stringify({
            type: "pflx_navigate",
            url: url,
            target: "self",
          }), "*");
        } else {
          // Standalone — hard-redirect.
          window.location.replace(url);
        }
      } catch {}
    } else {
      setReason("This portfolio view has moved to the PFLX Platform. The player record couldn't be resolved on this device.");
    }
  }, [params.id]);

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
          {reason || "The unified portfolio now lives on the PFLX Platform. Redirecting…"}
        </div>
        {target && (
          <a href={target} style={{
            marginTop: 8, padding: "12px 28px",
            background: "linear-gradient(135deg,#00d4ff,#7c3aed)",
            color: "#fff", textDecoration: "none", borderRadius: 10,
            fontFamily: "Orbitron, sans-serif", fontSize: 12, letterSpacing: 2, fontWeight: 700,
            boxShadow: "0 4px 24px rgba(0,212,255,0.35)",
          }}>OPEN PORTFOLIO →</a>
        )}
        {!target && (
          <a href={CONSOLE_ORIGIN} style={{
            marginTop: 8, padding: "12px 28px",
            background: "linear-gradient(135deg,#00d4ff,#7c3aed)",
            color: "#fff", textDecoration: "none", borderRadius: 10,
            fontFamily: "Orbitron, sans-serif", fontSize: 12, letterSpacing: 2, fontWeight: 700,
          }}>OPEN PFLX PLATFORM →</a>
        )}
      </div>
    </div>
  );
}
