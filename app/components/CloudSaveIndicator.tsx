"use client";
import { useEffect, useState } from "react";

/**
 * CloudSaveIndicator — fixed-position status pill that shows the current
 * cloud save state for the active session. Listens for `pflx_cloud_save`
 * and `pflx_cloud_save_ack` postMessages so any sub-app's save event
 * flickers the indicator from "saving..." to "saved" automatically.
 *
 * States:
 *   idle     → faint dot, text "Synced"
 *   saving   → pulsing cyan, text "Saving…"
 *   saved    → flash green, text "Saved ✓"
 *   error    → flash red, text "Save failed"
 *   offline  → amber, text "Offline — will sync"
 */

type SaveState = "idle" | "saving" | "saved" | "error" | "offline";

export default function CloudSaveIndicator() {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    function setOnline() { setState((s) => (s === "offline" ? "idle" : s)); }
    function setOffline() { setState("offline"); }
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    if (!navigator.onLine) setState("offline");

    function handleMessage(ev: MessageEvent) {
      try {
        const msg = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (!msg?.type) return;
        if (msg.type === "pflx_cloud_save") {
          setState("saving");
        } else if (msg.type === "pflx_cloud_save_ack" || msg.type === "pflx_saved_to_cloud") {
          setState("saved");
          setLastSaved(new Date().toLocaleTimeString());
          // Fade back to idle after 2s
          setTimeout(() => setState("idle"), 2000);
        } else if (msg.type === "pflx_cloud_save_error") {
          setState("error");
          setTimeout(() => setState("idle"), 4000);
        }
      } catch {}
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  const config: Record<SaveState, { bg: string; label: string; dot: string }> = {
    idle: { bg: "rgba(0,0,0,0.65)", label: lastSaved ? `Synced · ${lastSaved}` : "Synced", dot: "#00ff88" },
    saving: { bg: "rgba(0,212,255,0.25)", label: "Saving…", dot: "#00d4ff" },
    saved: { bg: "rgba(0,255,136,0.25)", label: "Saved ✓", dot: "#00ff88" },
    error: { bg: "rgba(239,68,68,0.25)", label: "Save failed", dot: "#ef4444" },
    offline: { bg: "rgba(245,158,11,0.25)", label: "Offline — will sync", dot: "#f59e0b" },
  };
  const c = config[state];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 18,
        right: 18,
        padding: "6px 12px",
        background: c.bg,
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 999,
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'Share Tech Mono', monospace",
        letterSpacing: "0.08em",
        zIndex: 9997,
        display: "flex",
        alignItems: "center",
        gap: 8,
        backdropFilter: "blur(8px)",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: c.dot,
          animation: state === "saving" ? "pflxPulse 1s ease-in-out infinite" : "none",
          boxShadow: `0 0 8px ${c.dot}`,
        }}
      />
      {c.label}
      <style>{`
        @keyframes pflxPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
