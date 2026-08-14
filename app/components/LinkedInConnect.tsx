"use client";
// Phase-2 LinkedIn widget for the wallet: connect via OAuth, then
// one-click post the player's latest badge to their own LinkedIn feed.
// Hidden entirely until LINKEDIN_CLIENT_ID is configured on Vercel.
import { useEffect, useState } from "react";

interface Props {
  playerId: string;
  latestBadge?: string;   // most recent approved badge name
  brandName?: string;
}

export default function LinkedInConnect({ playerId, latestBadge, brandName }: Props) {
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/linkedin/post?playerId=${encodeURIComponent(playerId)}`)
      .then(r => r.json())
      .then(d => { setConfigured(!!d.configured); setConnected(!!d.connected); })
      .catch(() => {});
    // surface ?linkedin=connected|denied|error from the OAuth bounce
    try {
      const q = new URLSearchParams(window.location.search).get("linkedin");
      if (q === "connected") { setConnected(true); setMsg("✓ LinkedIn connected"); }
      else if (q === "denied") setMsg("LinkedIn access was declined.");
      else if (q === "error") setMsg("LinkedIn connection failed — try again.");
    } catch { /* ignore */ }
  }, [playerId]);

  if (!configured) return null;

  async function postLatest() {
    if (!latestBadge) { setMsg("No approved badge to post yet."); return; }
    setBusy(true);
    setMsg("");
    try {
      const badgeUrl = `${window.location.origin}/badge/${playerId}?b=${encodeURIComponent(latestBadge)}`;
      const text =
        `🏅 I just earned the "${latestBadge}" Digital Badge on PFLX — The Tomorrow Teacher's gamified learning platform!` +
        (brandName ? `\n\nEarned as ${brandName}.` : "") +
        `\n\nVerify it here: ${badgeUrl}\n\n#PFLX #FutureOfLearning #DigitalBadge`;
      const res = await fetch("/api/linkedin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, text, url: badgeUrl }),
      });
      const d = await res.json();
      if (d.ok) setMsg("✓ Posted to your LinkedIn feed!");
      else if (res.status === 401) { setConnected(false); setMsg("Connection expired — reconnect below."); }
      else setMsg(d.error || "Post failed.");
    } catch {
      setMsg("Post failed — network error.");
    }
    setBusy(false);
  }

  const btn: React.CSSProperties = {
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px",
    padding: "6px 14px", borderRadius: "8px", textDecoration: "none", cursor: "pointer",
    border: "1px solid rgba(10,102,194,0.45)", background: "rgba(10,102,194,0.14)", color: "#6cb2ff",
    display: "inline-flex", alignItems: "center", gap: "5px",
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
      {connected ? (
        <button onClick={postLatest} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>
          {busy ? "⟳ POSTING…" : "⚡ POST LATEST BADGE"}
        </button>
      ) : (
        <a
          href={`/api/linkedin/auth?playerId=${encodeURIComponent(playerId)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={btn}
        >
          in CONNECT LINKEDIN
        </a>
      )}
      {msg && <span style={{ fontSize: "10px", color: msg.startsWith("✓") ? "#22c55e" : "#f59e0b" }}>{msg}</span>}
    </span>
  );
}
